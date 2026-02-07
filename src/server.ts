import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

  return server;
}

export async function runStdioServer(apiToken: string) {
  const server = createServer(apiToken);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('POEditor MCP server running on stdio');
}
