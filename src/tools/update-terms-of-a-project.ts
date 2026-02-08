import { z } from 'zod';
import type { POEditorClient } from '../client/poeditor.js';
import type { UpdateTermInput as POEditorUpdateTermInput } from '../types/poeditor.js';

const updateTermInputSchema = z.object({
  term: z.string().describe('Current term text to identify the term'),
  context: z.string().describe('Current context to identify the term'),
  new_term: z.string().optional().describe('New term text'),
  new_context: z.string().optional().describe('New context'),
  reference: z.string().optional().describe('New reference location'),
  plural: z.string().optional().describe('New plural form'),
  comment: z.string().optional().describe('New comment'),
  tags: z.union([z.string(), z.array(z.string())]).optional().describe('New tags (replaces existing)'),
  translations: z.record(z.string()).optional().describe('Update translations as a record keyed by language code. Example: {"it": "Italian translation", "en": "English translation", "de": "German translation"}'),
}).strict();

type UpdateTermInput = z.infer<typeof updateTermInputSchema>;

const updateTermsInputSchema = z.object({
  project_id: z.number().describe('The project ID'),
  fuzzy_trigger: z.boolean().optional().describe('Mark translations in other languages as fuzzy when term text changes'),
  terms: z.array(updateTermInputSchema).describe('Array of terms to update. Each term must have "term" and "context" fields to identify it, and "translations" as a record object like {"it": "text", "en": "text"}'),
}).strict();

type UpdateTermsInput = z.infer<typeof updateTermsInputSchema>;

export const updateTermsOfAProjectTool = {
  name: 'update_terms_of_a_project',
  description: 'Update existing terms (text, context, reference, plural, comment, tags) AND their translations',
  inputSchema: updateTermsInputSchema,
  
  async execute(
    input: UpdateTermsInput,
    client: POEditorClient
  ) {
    try {
      // Prepare terms for POEditor API (without translations)
      const termsToUpdate: POEditorUpdateTermInput[] = input.terms.map((term: UpdateTermInput) => {
        const updateData: POEditorUpdateTermInput = {
          term: term.term,
          context: term.context,
        };
        
        if (term.new_term) updateData.new_term = term.new_term;
        if (term.new_context) updateData.new_context = term.new_context;
        if (term.reference !== undefined) updateData.reference = term.reference;
        if (term.plural !== undefined) updateData.plural = term.plural;
        if (term.comment !== undefined) updateData.comment = term.comment;
        if (term.tags !== undefined) updateData.tags = term.tags;
        
        return updateData;
      });
      
      // Update terms metadata
      const updateResponse = await client.updateTerms(
        input.project_id,
        termsToUpdate,
        input.fuzzy_trigger
      );
      
      if (updateResponse.response.status !== 'success') {
        throw new Error(updateResponse.response.message);
      }
      
      const termsUpdated = updateResponse.result?.terms.updated || 0;
      const translationsUpdated: Record<string, number> = {};
      
      // Now update translations if provided
      for (const term of input.terms) {
        if (term.translations && Object.keys(term.translations).length > 0) {
          // Use new_term if provided, otherwise use original term
          const termText = term.new_term || term.term;
          const contextText = term.new_context || term.context;
          
          console.log(`[MCP] Updating translations for term: "${termText}", context: "${contextText}"`);
          
          for (const [languageCode, translationText] of Object.entries(term.translations)) {
            try {
              const translationData = [{
                term: termText,
                context: contextText,
                translation: {
                  content: translationText as string,
                },
              }];
              
              console.log(`[MCP] Sending to POEditor for ${languageCode}:`, JSON.stringify(translationData));
              
              const translationResponse = await client.updateLanguage(
                input.project_id,
                languageCode,
                translationData,
                input.fuzzy_trigger
              );
              
              console.log(`[MCP] POEditor response for ${languageCode}:`, JSON.stringify(translationResponse));
              
              if (translationResponse.response.status === 'success') {
                const added = translationResponse.result?.translations?.added || 0;
                const updated = translationResponse.result?.translations?.updated || 0;
                translationsUpdated[languageCode] = (translationsUpdated[languageCode] || 0) + added + updated;
              }
            } catch (error) {
              // Continue even if translation update fails
              console.error(`[MCP] Failed to update translation for ${languageCode}:`, error);
            }
          }
        }
      }
      
      return {
        terms_updated: termsUpdated,
        translations_updated: translationsUpdated,
        success: true,
      };
    } catch (error) {
      throw new Error(`Failed to update terms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};
