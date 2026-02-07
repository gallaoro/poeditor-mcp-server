import type {
  POEditorResponse,
  ProjectsListResult,
  LanguagesListResult,
  TermsListResult,
  ExportResult,
  TermsAddResult,
  TermsUpdateResult,
  TermsDeleteResult,
  LanguagesUpdateResult,
  AddTermInput,
  UpdateTermInput,
} from '../types/poeditor.js';

export class POEditorClient {
  private apiToken: string;
  private baseUrl = 'https://api.poeditor.com/v2';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    endpoint: string,
    data: Record<string, unknown> = {}
  ): Promise<POEditorResponse<T>> {
    const formData = new URLSearchParams();
    formData.append('api_token', this.apiToken);

    // Add other parameters
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return json as POEditorResponse<T>;
  }

  // Projects
  async listProjects(): Promise<POEditorResponse<ProjectsListResult>> {
    return this.request<ProjectsListResult>('/projects/list');
  }

  // Languages
  async listLanguages(projectId: number): Promise<POEditorResponse<LanguagesListResult>> {
    return this.request<LanguagesListResult>('/languages/list', { id: projectId });
  }

  // Terms
  async listTerms(
    projectId: number,
    languageCode?: string
  ): Promise<POEditorResponse<TermsListResult>> {
    const params: Record<string, unknown> = { id: projectId };
    if (languageCode) {
      params.language = languageCode;
    }
    return this.request<TermsListResult>('/terms/list', params);
  }

  async addTerms(
    projectId: number,
    terms: AddTermInput[]
  ): Promise<POEditorResponse<TermsAddResult>> {
    return this.request<TermsAddResult>('/terms/add', {
      id: projectId,
      data: terms,
    });
  }

  async updateTerms(
    projectId: number,
    terms: UpdateTermInput[],
    fuzzyTrigger?: boolean
  ): Promise<POEditorResponse<TermsUpdateResult>> {
    const params: Record<string, unknown> = {
      id: projectId,
      data: terms,
    };
    if (fuzzyTrigger !== undefined) {
      params.fuzzy_trigger = fuzzyTrigger ? 1 : 0;
    }
    return this.request<TermsUpdateResult>('/terms/update', params);
  }

  async deleteTerms(
    projectId: number,
    terms: Array<{ term: string; context: string }>
  ): Promise<POEditorResponse<TermsDeleteResult>> {
    return this.request<TermsDeleteResult>('/terms/delete', {
      id: projectId,
      data: terms,
    });
  }

  // Translations
  async updateLanguage(
    projectId: number,
    languageCode: string,
    translations: Array<{
      term: string;
      context: string;
      translation: { content: string; fuzzy?: number };
    }>,
    fuzzyTrigger?: boolean
  ): Promise<POEditorResponse<LanguagesUpdateResult>> {
    const params: Record<string, unknown> = {
      id: projectId,
      language: languageCode,
      data: translations,
    };
    if (fuzzyTrigger !== undefined) {
      params.fuzzy_trigger = fuzzyTrigger ? 1 : 0;
    }
    return this.request<LanguagesUpdateResult>('/languages/update', params);
  }

  // Export
  async exportProject(
    projectId: number,
    languageCode: string,
    type: string,
    filters?: string | string[],
    tags?: string | string[],
    fallbackLanguage?: string
  ): Promise<POEditorResponse<ExportResult>> {
    const params: Record<string, unknown> = {
      id: projectId,
      language: languageCode,
      type,
    };
    if (filters) {
      params.filters = filters;
    }
    if (tags) {
      params.tags = tags;
    }
    if (fallbackLanguage) {
      params.fallback_language = fallbackLanguage;
    }
    return this.request<ExportResult>('/projects/export', params);
  }
}
