import { z } from 'zod';
import type { POEditorClient } from '../client/poeditor.js';

const exportProjectInputSchema = z.object({
  project_id: z.number().describe('The project ID'),
  language_codes: z.array(z.string()).describe('Export multiple languages in one call'),
  format: z.string().describe('File format: json, po, pot, mo, xls, xlsx, csv, ini, properties, android_strings, apple_strings, xliff, etc.'),
  filters: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by: translated, untranslated, fuzzy, proofread'),
  tags: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by tags'),
  fallback_language: z.string().optional().describe('Language code for fallback translations'),
});

type ExportProjectInput = z.infer<typeof exportProjectInputSchema>;

export const exportProjectTool = {
  name: 'export_project',
  description: 'Export translations for a single project in multiple languages at once',
  inputSchema: exportProjectInputSchema,
  
  async execute(
    input: ExportProjectInput,
    client: POEditorClient
  ) {
    console.log(`[MCP] Exporting project ${input.project_id} in ${input.language_codes.length} language(s): ${input.language_codes.join(', ')}`);
    try {
      // Export each language in parallel
      const exportPromises = input.language_codes.map(async (languageCode: string) => {
        try {
          const response = await client.exportProject(
            input.project_id,
            languageCode,
            input.format,
            input.filters,
            input.tags,
            input.fallback_language
          );
          
          if (response.response.status !== 'success' || !response.result) {
            return {
              language_code: languageCode,
              success: false,
            error: response.response.message,
          };
        }
        
        console.log(`[MCP] Export successful for ${languageCode}`);
        return {
            language_code: languageCode,
            download_url: response.result.url,
            format: input.format,
            success: true,
            expires_in: '10 minutes',
        };
      } catch (error) {
        console.error(`[MCP] Export exception for ${languageCode}:`, error);
        return {
            language_code: languageCode,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });
      
      const results = await Promise.all(exportPromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log(`[MCP] Export completed: ${successful.length}/${results.length} successful`);
      return {
        exports: results,
        summary: {
          total: results.length,
          successful: successful.length,
          failed: failed.length,
        },
        note: 'Download URLs expire in 10 minutes',
      };
    } catch (error) {
      throw new Error(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};
