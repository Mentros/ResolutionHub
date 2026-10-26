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
  programs: string[];
  checkpoints: Checkpoint[];
  createdAt: string;
  updatedAt: string;
}

export interface IssueSummary {
  id: number;
  title: string;
  summary: string;
  programs: string[];
  checkpointCount: number;
  updatedAt: string;
}

export interface CheckpointInput {
  instruction: string;
  wikiUrl: string | null;
  sharePath: string | null;
}

export interface IssueInput {
  title: string;
  summary: string;
  programs: string[];
  checkpoints: CheckpointInput[];
}

export interface WikiEntry {
  id: number;
  position: number;
  title: string;
  pageUrl: string;
  notes: string;
  programs: string[];
  topics: string[];
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
  programs: string[];
  topics: string[];
  entryCount: number;
  updatedAt: string;
}

export interface WikiEntryInput {
  title: string;
  pageUrl: string;
  notes: string;
  programs: string[];
  topics: string[];
}

export interface WikiSiteInput {
  name: string;
  baseUrl: string;
  summary: string;
  entries: WikiEntryInput[];
}
