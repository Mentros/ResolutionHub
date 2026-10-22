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
