export interface Checkpoint {
  id: number;
  position: number;
  instruction: string;
  wikiUrl: string | null;
  sharePath: string | null;
}

export interface Issue {
  id: number;
  title: string;
  summary: string;
  tags: string[];
  checkpoints: Checkpoint[];
  createdAt: string;
  updatedAt: string;
}

export interface IssueSummary {
  id: number;
  title: string;
  summary: string;
  tags: string[];
  checkpointCount: number;
  updatedAt: string;
  searchSnippet: string | null;
}

export interface CheckpointInput {
  instruction: string;
  wikiUrl: string | null;
  sharePath: string | null;
}

export interface IssueInput {
  title: string;
  summary: string;
  tags: string[];
  checkpoints: CheckpointInput[];
}

export interface WikiEntry {
  id: number;
  position: number;
  title: string;
  pageUrl: string;
  notes: string;
  tags: string[];
}

export interface WikiSite {
  id: number;
  name: string;
  baseUrl: string;
  summary: string;
  entries: WikiEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface WikiSiteSummary {
  id: number;
  name: string;
  baseUrl: string;
  summary: string;
  tags: string[];
  entryCount: number;
  updatedAt: string;
  searchSnippet: string | null;
}

export interface GlobalSearchResult {
  issues: IssueSummary[];
  wikiSites: WikiSiteSummary[];
}

export interface WikiEntryInput {
  title: string;
  pageUrl: string;
  notes: string;
  tags: string[];
}

export interface WikiSiteInput {
  name: string;
  baseUrl: string;
  summary: string;
  entries: WikiEntryInput[];
}
