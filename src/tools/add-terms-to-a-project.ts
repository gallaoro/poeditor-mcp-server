import { z } from 'zod';
import type { POEditorClient } from '../client/poeditor.js';
import type { AddTermInput } from '../types/poeditor.js';

const termInputSchema = z.object({
  term: z.string().describe('The term text'),
  context: z.string().optional().describe('Context for translators'),
  reference: z.string().optional().describe('Reference location in code'),
  plural: z.string().optional().describe('Plural form of the term'),
  comment: z.string().optional().describe('Developer comment for translators'),
  tags: z.union([z.string(), z.array(z.string())]).optional().describe('Tags for organization'),
  translations: z.record(z.string()).optional().describe('Initial translations keyed by language code'),
});

type TermInput = z.infer<typeof termInputSchema>;

const addTermsInputSchema = z.object({
  project_id: z.number().describe('The project ID'),
  terms: z.array(termInputSchema).describe('Array of terms to add'),
});

type AddTermsInput = z.infer<typeof addTermsInputSchema>;

export const addTermsToAProjectTool = {
  name: 'add_terms_to_a_project',
  description: 'Add new translation terms to a specific project, optionally with initial translations',
  inputSchema: addTermsInputSchema,
  
  async execute(
    input: AddTermsInput,
    client: POEditorClient
  ) {
    console.log(`[MCP] Adding ${input.terms.length} term(s) to project ${input.project_id}`);
    try {
      // Prepare terms for POEditor API (without translations)
      const termsToAdd: AddTermInput[] = input.terms.map((term: TermInput) => ({
        term: term.term,
        context: term.context || '',
        reference: term.reference || '',
        plural: term.plural || '',
        comment: term.comment || '',
        tags: term.tags,
      }));
      
      // Add terms
      const addResponse = await client.addTerms(input.project_id, termsToAdd);
      
      if (addResponse.response.status !== 'success') {
        throw new Error(addResponse.response.message);
      }
      
      const termsAdded = addResponse.result?.terms.added || 0;
      console.log(`[MCP] Added ${termsAdded} term(s)`);
      const translationsAdded: Record<string, number> = {};
      
      // Now add translations if provided
      for (const term of input.terms) {
        if (term.translations && Object.keys(term.translations).length > 0) {
          console.log(`[MCP] Adding translations for term: "${term.term}"`);
          for (const [languageCode, translationText] of Object.entries(term.translations)) {
            try {
              const translationData = [{
                term: term.term,
                context: term.context || '',
                translation: {
                  content: translationText as string,
                  fuzzy: 0,
                },
              }];
              
              const translationResponse = await client.updateLanguage(
                input.project_id,
                languageCode,
                translationData
              );
              
              if (translationResponse.response.status === 'success') {
                const added = translationResponse.result?.translations?.added || 0;
                translationsAdded[languageCode] = (translationsAdded[languageCode] || 0) + added;
              }
            } catch (error) {
              // Continue even if translation fails
              console.error(`[MCP] Failed to add translation for ${languageCode}:`, error);
            }
          }
        }
      }
      
      console.log(`[MCP] Translations added:`, translationsAdded);
      return {
        terms_added: termsAdded,
        translations_added: translationsAdded,
        success: true,
      };
    } catch (error) {
      console.error('[MCP] Failed to add terms:', error);
      throw new Error(`Failed to add terms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};
