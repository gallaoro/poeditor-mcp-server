import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { POEditorClient } from './client/poeditor.js';
import { checkConfigurationTool } from './tools/check-configuration.js';
import { listProjectsWithLanguagesTool } from './tools/list-projects-with-languages.js';
import { listTermsOfAProjectTool } from './tools/list-terms-of-a-project.js';
import { addTermsToAProjectTool } from './tools/add-terms-to-a-project.js';
import { updateTermsOfAProjectTool } from './tools/update-terms-of-a-project.js';
import { deleteTermFromAProjectTool } from './tools/delete-term-from-a-project.js';
import { exportProjectTool } from './tools/export-project.js';

const tools = [
  checkConfigurationTool,
  listProjectsWithLanguagesTool,
  listTermsOfAProjectTool,
  addTermsToAProjectTool,
  updateTermsOfAProjectTool,
  deleteTermFromAProjectTool,
  exportProjectTool,
];

// Get API token from environment
const apiToken = process.env.POEDITOR_API_TOKEN;
if (!apiToken) {
  console.error('ERROR: POEDITOR_API_TOKEN environment variable is required');
  process.exit(1);
}

const port = parseInt(process.env.PORT || '9142', 10);

const app = express();

// Store active transports keyed by session ID
const transports = new Map<string, SSEServerTransport>();

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'poeditor-mcp-server' });
});

// SSE endpoint for MCP
app.get('/sse', async (_req, res) => {
  console.log('[MCP] New SSE connection established');
  
  const client = new POEditorClient(apiToken);
  const server = new Server(
    {
      name: 'poeditor-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log('[MCP] Received tools/list request');
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(tool.inputSchema.shape).map(([key, value]) => {
              const zodType = (value as any)._def.typeName;
              let type = 'string';
              
              if (zodType === 'ZodNumber') type = 'number';
              else if (zodType === 'ZodBoolean') type = 'boolean';
              else if (zodType === 'ZodArray') type = 'array';
              else if (zodType === 'ZodObject') type = 'object';
              
              return [
                key,
                {
                  type,
                  description: (value as any)._def.description,
                },
              ];
            })
          ),
          required: Object.entries(tool.inputSchema.shape)
            .filter(([_, value]) => !(value as any).isOptional())
            .map(([key]) => key),
        },
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.log(`[MCP] Tool call received: ${request.params.name}`);
    console.log(`[MCP] Arguments:`, JSON.stringify(request.params.arguments, null, 2));
    
    const tool = tools.find(t => t.name === request.params.name);
    
    if (!tool) {
      console.error(`[MCP] Unknown tool: ${request.params.name}`);
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    try {
      // Validate input
      const validatedInput = tool.inputSchema.parse(request.params.arguments || {});
      console.log(`[MCP] Validated input:`, JSON.stringify(validatedInput, null, 2));
      
      // Execute tool (use any to avoid type intersection issues)
      console.log(`[MCP] Executing tool: ${tool.name}`);
      const result = await (tool.execute as any)(validatedInput, client);
      console.log(`[MCP] Tool execution completed:`, JSON.stringify(result, null, 2));
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(`[MCP] Tool execution error:`, error);
      if (error instanceof Error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error.message }, null, 2),
            },
          ],
          isError: true,
        };
      }
      throw error;
    }
  });

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    console.log('[MCP] Received resources/list request');
    try {
      const projectsResponse = await client.listProjects();
      
      if (projectsResponse.response.status !== 'success' || !projectsResponse.result) {
        throw new Error(projectsResponse.response.message);
      }

      const resources = projectsResponse.result.projects.map(project => ({
        uri: `poeditor://project/${project.id}`,
        name: project.name,
        description: project.description || `POEditor project: ${project.name}`,
        mimeType: 'application/json',
      }));

      console.log(`[MCP] Returning ${resources.length} resources`);
      return { resources };
    } catch (error) {
      console.error('[MCP] Failed to list resources:', error);
      throw new Error(`Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Read a specific resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    console.log(`[MCP] Received resources/read request for: ${uri}`);
    
    // Parse URI: poeditor://project/{project_id}
    const projectMatch = uri.match(/^poeditor:\/\/project\/(\d+)$/);
    
    if (!projectMatch) {
      throw new Error(`Invalid resource URI: ${uri}. Expected format: poeditor://project/{project_id}`);
    }

    const projectId = parseInt(projectMatch[1], 10);

    try {
      // Fetch project details
      const projectsResponse = await client.listProjects();
      
      if (projectsResponse.response.status !== 'success' || !projectsResponse.result) {
        throw new Error(projectsResponse.response.message);
      }

      const project = projectsResponse.result.projects.find(p => p.id === projectId);
      
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Fetch languages for the project
      let languages: Array<{ code: string; name: string; percentage: number; updated?: string }> = [];
      try {
        const languagesResponse = await client.listLanguages(projectId);
        if (languagesResponse.response.status === 'success' && languagesResponse.result) {
          languages = languagesResponse.result.languages;
        }
      } catch (error) {
        console.warn(`[MCP] Failed to fetch languages for project ${projectId}:`, error);
        // Continue without languages
      }

      const resourceData = {
        id: project.id,
        name: project.name,
        description: project.description || '',
        created: project.created,
        terms: project.terms,
        reference_language: project.reference_language || '',
        fallback_language: project.fallback_language || '',
        languages: languages.map(lang => ({
          code: lang.code,
          name: lang.name,
          percentage: lang.percentage,
          updated: lang.updated,
        })),
      };

      console.log(`[MCP] Returning resource data for project ${projectId}`);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(resourceData, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(`[MCP] Failed to read resource ${uri}:`, error);
      throw new Error(`Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  const transport = new SSEServerTransport('/message', res);
  transports.set(transport.sessionId, transport);
  
  // Clean up on disconnect
  transport.onclose = () => {
    transports.delete(transport.sessionId);
    console.log(`[MCP] SSE connection closed, session: ${transport.sessionId}`);
  };
  
  await server.connect(transport);
  
  // Keep connection alive (handler will be managed by transport)
});

// Message endpoint for MCP
app.post('/message', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  console.log(`[MCP] Message received for session: ${sessionId}`);
  
  const transport = transports.get(sessionId);
  
  if (!transport) {
    console.error(`[MCP] Session not found: ${sessionId}`);
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  // Handle the message through the transport
  await transport.handlePostMessage(req, res);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`POEditor MCP server running on http://0.0.0.0:${port}`);
  console.log(`SSE endpoint: http://0.0.0.0:${port}/sse`);
  console.log(`Health check: http://0.0.0.0:${port}/health`);
});
