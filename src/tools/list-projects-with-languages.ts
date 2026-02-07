import { z } from 'zod';
import type { POEditorClient } from '../client/poeditor.js';

export const listProjectsWithLanguagesTool = {
  name: 'list_projects_with_languages',
  description: 'Get all translation projects with their available languages and translation progress',
  inputSchema: z.object({}),
  
  async execute(_input: Record<string, never>, client: POEditorClient) {
    try {
      // First, get all projects
      const projectsResponse = await client.listProjects();
      
      if (projectsResponse.response.status !== 'success' || !projectsResponse.result) {
        throw new Error(projectsResponse.response.message);
      }
      
      const projects = projectsResponse.result.projects;
      
      // Then fetch languages for each project in parallel
      const projectsWithLanguages = await Promise.all(
        projects.map(async (project) => {
          try {
            const languagesResponse = await client.listLanguages(project.id);
            
            return {
              id: project.id,
              name: project.name,
              description: project.description || '',
              created: project.created,
              terms: project.terms,
              reference_language: project.reference_language || '',
              fallback_language: project.fallback_language || '',
              languages: languagesResponse.result?.languages || [],
            };
          } catch (error) {
            // If fetching languages fails for a project, return project without languages
            return {
              id: project.id,
              name: project.name,
              description: project.description || '',
              created: project.created,
              terms: project.terms,
              reference_language: project.reference_language || '',
              fallback_language: project.fallback_language || '',
              languages: [],
              error: error instanceof Error ? error.message : 'Failed to fetch languages',
            };
          }
        })
      );
      
      return {
        projects: projectsWithLanguages,
        total: projectsWithLanguages.length,
      };
    } catch (error) {
      throw new Error(`Failed to list projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};
