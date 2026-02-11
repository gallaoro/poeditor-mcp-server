import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

export function createServer(apiToken: string) {
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
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(tool.inputSchema.shape).map(([key, value]) => [
              key,
              {
                type: (value as any)._def.typeName.toLowerCase().replace('zod', ''),
                description: (value as any)._def.description,
              },
            ])
          ),
        },
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.name === request.params.name);
    
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    try {
      // Validate input
      const validatedInput = tool.inputSchema.parse(request.params.arguments || {});
      
      // Execute tool (use any to avoid type intersection issues)
      const result = await (tool.execute as any)(validatedInput, client);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
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

      return { resources };
    } catch (error) {
      console.error('[MCP] Failed to list resources:', error);
      throw new Error(`Failed to list resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Read a specific resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    
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

  return server;
}

export async function runStdioServer(apiToken: string) {
  const server = createServer(apiToken);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('POEditor MCP server running on stdio');
}
