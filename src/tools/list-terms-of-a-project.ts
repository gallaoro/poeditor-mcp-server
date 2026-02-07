import { z } from 'zod';
import type { POEditorClient } from '../client/poeditor.js';
import type { Term } from '../types/poeditor.js';

const listTermsInputSchema = z.object({
  project_id: z.number().describe('The project ID'),
  language_code: z.string().optional().describe('Return translations for specific language'),
  tags: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by tags'),
  translation_status: z.enum([
    'translated',
    'untranslated',
    'fuzzy',
    'not_fuzzy',
    'proofread',
    'not_proofread'
  ]).optional().describe('Filter by translation status'),
  reference_pattern: z.string().optional().describe('Filter by reference pattern (e.g., "/components/", "Settings.tsx")'),
});

type ListTermsInput = z.infer<typeof listTermsInputSchema>;

export const listTermsOfAProjectTool = {
  name: 'list_terms_of_a_project',
  description: 'Get all terms and their translations for a specific project with optional filtering',
  inputSchema: listTermsInputSchema,
  
  async execute(
    input: ListTermsInput,
    client: POEditorClient
  ) {
    try {
      const response = await client.listTerms(input.project_id, input.language_code);
      
      if (response.response.status !== 'success' || !response.result) {
        throw new Error(response.response.message);
      }
      
      let terms = response.result.terms;
      
      // Apply filters
      if (input.tags) {
        const tagsArray = Array.isArray(input.tags) ? input.tags : [input.tags];
        terms = terms.filter(term => 
          term.tags.some(tag => tagsArray.includes(tag))
        );
      }
      
      if (input.reference_pattern) {
        terms = terms.filter(term => 
          term.reference.includes(input.reference_pattern!)
        );
      }
      
      if (input.translation_status && input.language_code) {
        terms = terms.filter((term: Term) => {
          if (!term.translation) return input.translation_status === 'untranslated';
          
          const content = term.translation.content;
          const hasContent = typeof content === 'string' 
            ? content.length > 0 
            : (content.one?.length > 0 || content.other?.length > 0);
          
          switch (input.translation_status) {
            case 'translated':
              return hasContent;
            case 'untranslated':
              return !hasContent;
            case 'fuzzy':
              return term.translation.fuzzy === 1;
            case 'not_fuzzy':
              return term.translation.fuzzy === 0;
            case 'proofread':
              return term.translation.proofread === 1;
            case 'not_proofread':
              return term.translation.proofread === 0;
            default:
              return true;
          }
        });
      }
      
      return {
        terms,
        total: terms.length,
        filters_applied: {
          tags: input.tags || null,
          translation_status: input.translation_status || null,
          reference_pattern: input.reference_pattern || null,
          language_code: input.language_code || null,
        },
      };
    } catch (error) {
      throw new Error(`Failed to list terms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};
