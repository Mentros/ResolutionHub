import { mkdirSync } from 'node:fs';
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite';
import { dirname } from 'node:path';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

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

interface CheckpointInput {
  instruction: string;
  wikiUrl: string | null;
  sharePath: string | null;
}

interface IssueInput {
  title: string;
  summary: string;
  tags: string[];
  checkpoints: CheckpointInput[];
}

let database: DatabaseSync | null = null;

export function initDatabase(dbPath: string): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath, {
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE TABLE IF NOT EXISTS issue_tags (
      issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (issue_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY,
      issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      instruction TEXT NOT NULL DEFAULT '',
      wiki_url TEXT,
      share_path TEXT,
      UNIQUE (issue_id, position),
      CHECK (
        length(trim(instruction)) > 0
        OR length(trim(coalesce(wiki_url, ''))) > 0
        OR length(trim(coalesce(share_path, ''))) > 0
      )
    );

    CREATE INDEX IF NOT EXISTS idx_issue_tags_tag ON issue_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_issue ON checkpoints(issue_id, position);

    CREATE VIRTUAL TABLE IF NOT EXISTS issue_search USING fts5(
      title,
      summary,
      tag_names,
      checkpoint_text,
      tokenize = "unicode61 remove_diacritics 2"
    );
  `);
  database = db;
  seedIfEmpty();
}

function db(): DatabaseSync {
  if (!database) {
    throw new Error('Database is not open.');
  }
  return database;
}

function transaction<T>(fn: () => T): T {
  const connection = db();
  connection.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    connection.exec('COMMIT');
    return result;
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
}

function text(value: SQLOutputValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function nullableText(value: SQLOutputValue | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: SQLOutputValue | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return 0;
}

function optionalText(value: unknown, label: string, max: number): string {
  if (value == null) return '';
  if (typeof value !== 'string') {
    throw new HttpError(400, `${label} must be text.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

function normalizeUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Wiki links must be text.');
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new HttpError(400, 'Wiki links must be valid http or https URLs.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Wiki links must be valid http or https URLs.');
  }
  return url.toString();
}

function normalizeTags(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'Tags must be a list of names.');
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new HttpError(400, 'Tags must be a list of names.');
    }
    const name = entry.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    if (name.length > 40) {
      throw new HttpError(400, 'Tag names must be 40 characters or fewer.');
    }
    if (name.includes(',')) {
      throw new HttpError(400, 'Tag names cannot contain commas.');
    }
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(name);
  }
  return tags;
}

function parseIssueInput(body: unknown): IssueInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Issue must be an object.');
  }
  const record = body as Record<string, unknown>;
  const title = optionalText(record['title'], 'Title', 200);
  if (!title) {
    throw new HttpError(400, 'Title is required.');
  }
  const summary = optionalText(record['summary'], 'Summary', 5000);
  const tags = normalizeTags(record['tags']);
  if (!Array.isArray(record['checkpoints']) && record['checkpoints'] != null) {
    throw new HttpError(400, 'Checkpoints must be a list.');
  }
  const rawSteps = Array.isArray(record['checkpoints']) ? record['checkpoints'] : [];
  const checkpoints: CheckpointInput[] = [];
  for (const step of rawSteps) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new HttpError(400, 'Each checkpoint must be an object.');
    }
    const fields = step as Record<string, unknown>;
    const instruction = optionalText(fields['instruction'], 'Checkpoint instruction', 5000);
    const wikiUrl = normalizeUrl(fields['wikiUrl']);
    const sharePath = optionalText(fields['sharePath'], 'Share path', 500) || null;
    if (!instruction && !wikiUrl && !sharePath) continue;
    checkpoints.push({ instruction, wikiUrl, sharePath });
  }
  return { title, summary, tags, checkpoints };
}

function readTags(issueId: number): string[] {
  const rows = db()
    .prepare(
      `SELECT t.name AS name
       FROM tags t
       JOIN issue_tags it ON it.tag_id = t.id
       WHERE it.issue_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(issueId);
  return rows.map((row) => text(row['name']));
}

function readCheckpoints(issueId: number): Checkpoint[] {
  const rows = db()
    .prepare(
      `SELECT id, position, instruction, wiki_url AS wikiUrl, share_path AS sharePath
       FROM checkpoints
       WHERE issue_id = ?
       ORDER BY position ASC, id ASC`,
    )
    .all(issueId);
  return rows.map((row) => ({
    id: num(row['id']),
    position: num(row['position']),
    instruction: text(row['instruction']),
    wikiUrl: nullableText(row['wikiUrl']),
    sharePath: nullableText(row['sharePath']),
  }));
}

export function getIssue(id: number): Issue | null {
  const row = db()
    .prepare(
      `SELECT id, title, summary, created_at AS createdAt, updated_at AS updatedAt
       FROM issues WHERE id = ?`,
    )
    .get(id);
  if (!row) return null;
  const issueId = num(row['id']);
  return {
    id: issueId,
    title: text(row['title']),
    summary: text(row['summary']),
    tags: readTags(issueId),
    checkpoints: readCheckpoints(issueId),
    createdAt: text(row['createdAt']),
    updatedAt: text(row['updatedAt']),
  };
}

function replaceTags(issueId: number, tags: string[]): void {
  const connection = db();
  connection.prepare('DELETE FROM issue_tags WHERE issue_id = ?').run(issueId);
  const findTag = connection.prepare('SELECT id FROM tags WHERE name = ?');
  const link = connection.prepare('INSERT INTO issue_tags (issue_id, tag_id) VALUES (?, ?)');
  for (const name of tags) {
    const tag = findTag.get(name);
    if (!tag) {
      throw new HttpError(400, `Unknown tag "${name}". Add it on the Tags page first.`);
    }
    link.run(issueId, num(tag['id']));
  }
}

function replaceCheckpoints(issueId: number, checkpoints: CheckpointInput[]): void {
  const connection = db();
  connection.prepare('DELETE FROM checkpoints WHERE issue_id = ?').run(issueId);
  const insert = connection.prepare(
    `INSERT INTO checkpoints (issue_id, position, instruction, wiki_url, share_path)
     VALUES (?, ?, ?, ?, ?)`,
  );
  checkpoints.forEach((step, position) => {
    insert.run(issueId, position, step.instruction, step.wikiUrl, step.sharePath);
  });
}

function rebuildSearch(issueId: number): void {
  const issue = getIssue(issueId);
  const connection = db();
  connection.prepare('DELETE FROM issue_search WHERE rowid = ?').run(issueId);
  if (!issue) return;
  const checkpointText = issue.checkpoints
    .map((step) => [step.instruction, step.wikiUrl, step.sharePath].filter(Boolean).join(' '))
    .join('\n');
  connection
    .prepare(
      `INSERT INTO issue_search (rowid, title, summary, tag_names, checkpoint_text)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(issueId, issue.title, issue.summary, issue.tags.join(' '), checkpointText);
}

function insertIssue(input: IssueInput, timestamp: string): Issue {
  return transaction(() => {
    const result = db()
      .prepare(
        `INSERT INTO issues (title, summary, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.title, input.summary, timestamp, timestamp);
    const id = Number(result.lastInsertRowid);
    replaceTags(id, input.tags);
    replaceCheckpoints(id, input.checkpoints);
    rebuildSearch(id);
    const issue = getIssue(id);
    if (!issue) {
      throw new Error('Issue was not saved.');
    }
    return issue;
  });
}

export function createIssue(body: unknown): Issue {
  return insertIssue(parseIssueInput(body), new Date().toISOString());
}

export function updateIssue(id: number, body: unknown): Issue {
  const input = parseIssueInput(body);
  return transaction(() => {
    const existing = getIssue(id);
    if (!existing) {
      throw new HttpError(404, 'Issue not found.');
    }
    db()
      .prepare('UPDATE issues SET title = ?, summary = ?, updated_at = ? WHERE id = ?')
      .run(input.title, input.summary, new Date().toISOString(), id);
    replaceTags(id, input.tags);
    replaceCheckpoints(id, input.checkpoints);
    rebuildSearch(id);
    const issue = getIssue(id);
    if (!issue) {
      throw new Error('Issue was not saved.');
    }
    return issue;
  });
}

export function deleteIssue(id: number): void {
  transaction(() => {
    const result = db().prepare('DELETE FROM issues WHERE id = ?').run(id);
    if (Number(result.changes) === 0) {
      throw new HttpError(404, 'Issue not found.');
    }
    db().prepare('DELETE FROM issue_search WHERE rowid = ?').run(id);
  });
}

function toFtsQuery(raw: string): string | null {
  const terms = raw
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/["*]/g, ''))
    .filter((term) => term.length > 0);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term.replaceAll('"', '""')}"*`).join(' AND ');
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const tag of tags) {
    const name = tag.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return unique;
}

export function listIssues(query: string, tags: string[]): IssueSummary[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 200) {
    throw new HttpError(400, 'Search text is too long.');
  }
  const fts = toFtsQuery(trimmedQuery);
  const selectedTags = uniqueTags(tags);
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (fts) {
    where.push('i.id IN (SELECT rowid FROM issue_search WHERE issue_search MATCH ?)');
    params.push(fts);
  }
  if (selectedTags.length > 0) {
    const placeholders = selectedTags.map(() => '?').join(', ');
    where.push(
      `i.id IN (
        SELECT it.issue_id
        FROM issue_tags it
        JOIN tags t ON t.id = it.tag_id
        WHERE t.name IN (${placeholders})
        GROUP BY it.issue_id
        HAVING COUNT(DISTINCT t.id) = ?
      )`,
    );
    params.push(...selectedTags, selectedTags.length);
  }

  const sql = `
    SELECT
      i.id,
      i.title,
      i.summary,
      i.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM checkpoints c WHERE c.issue_id = i.id) AS checkpointCount
    FROM issues i
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY i.updated_at DESC, i.id DESC
  `;

  let rows: Record<string, SQLOutputValue>[];
  try {
    rows = db().prepare(sql).all(...params);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('fts5')) {
      throw new HttpError(400, 'That search could not be run.');
    }
    throw error;
  }

  return rows.map((row) => {
    const id = num(row['id']);
    return {
      id,
      title: text(row['title']),
      summary: text(row['summary']),
      tags: readTags(id),
      checkpointCount: num(row['checkpointCount']),
      updatedAt: text(row['updatedAt']),
    };
  });
}

export function listTags(): string[] {
  return db()
    .prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE')
    .all()
    .map((row) => text(row['name']));
}

function parseTagName(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Tag must be an object with a name.');
  }
  const raw = (body as Record<string, unknown>)['name'];
  if (typeof raw !== 'string') {
    throw new HttpError(400, 'Tag name is required.');
  }
  const tags = normalizeTags([raw]);
  if (tags.length !== 1) {
    throw new HttpError(400, 'Tag name is required.');
  }
  return tags[0];
}

export function createTag(body: unknown): { name: string } {
  const name = parseTagName(body);
  const connection = db();
  const existing = connection.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (existing) {
    throw new HttpError(409, 'A tag with this name already exists.');
  }
  connection.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
  return { name };
}

export function deleteTag(body: unknown): void {
  const name = parseTagName(body);
  transaction(() => {
    const connection = db();
    const tag = connection.prepare('SELECT id FROM tags WHERE name = ?').get(name);
    if (!tag) {
      throw new HttpError(404, 'Tag not found.');
    }
    const tagId = num(tag['id']);
    const issueIds = connection
      .prepare('SELECT issue_id FROM issue_tags WHERE tag_id = ?')
      .all(tagId)
      .map((row) => num(row['issue_id']));
    connection.prepare('DELETE FROM tags WHERE id = ?').run(tagId);
    for (const issueId of issueIds) {
      rebuildSearch(issueId);
    }
  });
}

function seedIfEmpty(): void {
  const row = db().prepare('SELECT COUNT(*) AS count FROM issues').get();
  if (num(row?.['count']) > 0) return;

  insertIssue(
    {
      title: 'Teams meeting will not join',
      summary:
        'Desktop client stays on "Joining meeting". Chat and the ticket both point at the company network. The web client is the workaround, then a cache reset if the desktop app is still stuck.',
      tags: ['Teams', 'tickets'],
      checkpoints: [
        {
          instruction:
            'Ask them to paste the join link into Edge and choose Continue on this browser. Confirm they can hear audio before you change the desktop app.',
          wikiUrl:
            'https://learn.microsoft.com/en-us/microsoftteams/troubleshoot/meetings/troubleshoot-meetings',
          sharePath: null,
        },
        {
          instruction:
            'If the browser join works, close Teams completely and follow the cache reset on the share. Have them sign in and join the same meeting from the desktop app.',
          wikiUrl: null,
          sharePath: '\\\\fileserver\\support\\teams\\cache-reset',
        },
        {
          instruction: 'Save the client logs next to the ticket notes before you close it.',
          wikiUrl: null,
          sharePath: '\\\\fileserver\\support\\teams\\logs',
        },
      ],
    },
    '2026-03-02T09:00:00.000Z',
  );

  insertIssue(
    {
      title: 'Skype stays offline after sign-in',
      summary:
        'Messages still send, but presence never leaves Offline. It is usually a stuck local profile, and sometimes the old Skype client is still running in the tray.',
      tags: ['Skype'],
      checkpoints: [
        {
          instruction:
            'Quit Skype from the tray, not only the window. Sign in again and ask a coworker whether presence shows Available.',
          wikiUrl: 'https://support.microsoft.com/en-us/skype/skype-help',
          sharePath: null,
        },
        {
          instruction:
            'If presence is still Offline, rename the local profile using the steps on the share, then sign in once more.',
          wikiUrl: null,
          sharePath: '\\\\fileserver\\support\\skype\\profile-reset',
        },
      ],
    },
    '2026-04-18T14:30:00.000Z',
  );
}
