import { z } from 'zod';
import type { POEditorClient } from '../client/poeditor.js';

export const checkConfigurationTool = {
  name: 'check_configuration',
  description: 'Validate that the POEditor API token is valid and working',
  inputSchema: z.object({}),
  
  async execute(_input: Record<string, never>, client: POEditorClient) {
    console.log('[MCP] Checking POEditor API configuration...');
    try {
      const response = await client.listProjects();
      
      if (response.response.status === 'success') {
        const projectCount = response.result?.projects.length || 0;
        console.log(`[MCP] Configuration check successful: ${projectCount} projects found`);
        return {
          valid: true,
          message: 'POEditor API token is valid and working',
          projectCount,
        };
      } else {
        console.error('[MCP] Configuration check failed:', response.response.message);
        return {
          valid: false,
          message: response.response.message,
          error: response.response.code,
        };
      }
    } catch (error) {
      console.error('[MCP] Configuration check error:', error);
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: 'CONNECTION_ERROR',
      };
    }
  },
};
