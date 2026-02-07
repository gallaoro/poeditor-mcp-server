import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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
  console.log('New SSE connection established');
  
  const client = new POEditorClient(apiToken);
  const server = new Server(
    {
      name: 'poeditor-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
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

  const transport = new SSEServerTransport('/message', res);
  transports.set(transport.sessionId, transport);
  
  // Clean up on disconnect
  transport.onclose = () => {
    transports.delete(transport.sessionId);
    console.log(`SSE connection closed, session: ${transport.sessionId}`);
  };
  
  await server.connect(transport);
  
  // Keep connection alive (handler will be managed by transport)
});

// Message endpoint for MCP
app.post('/message', async (req, res) => {
  // Find the transport by session ID from the request
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  
  if (!transport) {
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
