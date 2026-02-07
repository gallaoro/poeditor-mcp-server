import { z } from 'zod';
import type { POEditorClient } from '../client/poeditor.js';

const deleteTermInputSchema = z.object({
  project_id: z.number().describe('The project ID'),
  term: z.string().describe('The term text to delete'),
  context: z.string().describe('The context to identify the exact term'),
});

type DeleteTermInput = z.infer<typeof deleteTermInputSchema>;

export const deleteTermFromAProjectTool = {
  name: 'delete_term_from_a_project',
  description: 'Delete a single term from a project (safe: one term at a time)',
  inputSchema: deleteTermInputSchema,
  
  async execute(
    input: DeleteTermInput,
    client: POEditorClient
  ) {
    try {
      const response = await client.deleteTerms(input.project_id, [{
        term: input.term,
        context: input.context,
      }]);
      
      if (response.response.status !== 'success') {
        throw new Error(response.response.message);
      }
      
      const deleted = (response.result?.terms.deleted || 0) > 0;
      
      return {
        deleted,
        term: input.term,
        context: input.context,
        message: deleted 
          ? `Successfully deleted term "${input.term}" with context "${input.context}"`
          : `Term not found or already deleted`,
      };
    } catch (error) {
      throw new Error(`Failed to delete term: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};
