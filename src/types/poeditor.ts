// POEditor API Types

export interface POEditorResponse<T = unknown> {
  response: {
    status: 'success' | 'fail';
    code: string;
    message: string;
  };
  result?: T;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  public: number;
  open: number;
  reference_language?: string;
  fallback_language?: string;
  terms: number;
  created: string;
  terms_last_added?: string;
  terms_last_updated?: string;
}

export interface Language {
  name: string;
  code: string;
  translations: number;
  percentage: number;
  updated: string;
}

export interface Term {
  term: string;
  context: string;
  plural: string;
  created: string;
  updated: string;
  translation?: Translation;
  reference: string;
  tags: string[];
  comment: string;
}

export interface Translation {
  content: string | { one: string; other: string };
  fuzzy: number;
  proofread: number;
  updated: string;
}

export interface ProjectsListResult {
  projects: Project[];
}

export interface LanguagesListResult {
  languages: Language[];
}

export interface TermsListResult {
  terms: Term[];
}

export interface ExportResult {
  url: string;
}

export interface TermsAddResult {
  terms: {
    parsed: number;
    added: number;
  };
}

export interface TermsUpdateResult {
  terms: {
    parsed: number;
    updated: number;
  };
}

export interface TermsDeleteResult {
  terms: {
    parsed: number;
    deleted: number;
  };
}

export interface LanguagesUpdateResult {
  translations: {
    parsed: number;
    added: number;
    updated: number;
  };
}

// Input types for tools
export interface AddTermInput {
  term: string;
  context?: string;
  reference?: string;
  plural?: string;
  comment?: string;
  tags?: string | string[];
  translations?: Record<string, string>;
}

export interface UpdateTermInput {
  term: string;
  context: string;
  new_term?: string;
  new_context?: string;
  reference?: string;
  plural?: string;
  comment?: string;
  tags?: string | string[];
  translations?: Record<string, string>;
}
