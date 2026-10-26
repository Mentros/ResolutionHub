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

interface CheckpointInput {
  instruction: string;
  wikiUrl: string | null;
  sharePath: string | null;
}

interface IssueInput {
  title: string;
  summary: string;
  programs: string[];
  checkpoints: CheckpointInput[];
}

interface WikiEntryInput {
  title: string;
  pageUrl: string;
  notes: string;
  programs: string[];
  topics: string[];
}

interface WikiSiteInput {
  name: string;
  baseUrl: string;
  summary: string;
  entries: WikiEntryInput[];
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

    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE TABLE IF NOT EXISTS issue_programs (
      issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      PRIMARY KEY (issue_id, program_id)
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

    CREATE INDEX IF NOT EXISTS idx_issue_programs_program ON issue_programs(program_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_issue ON checkpoints(issue_id, position);

    CREATE VIRTUAL TABLE IF NOT EXISTS issue_search USING fts5(
      title,
      summary,
      tag_names,
      checkpoint_text,
      tokenize = "unicode61 remove_diacritics 2"
    );

    CREATE TABLE IF NOT EXISTS wiki_sites (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wiki_topics (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE TABLE IF NOT EXISTS wiki_entries (
      id INTEGER PRIMARY KEY,
      wiki_site_id INTEGER NOT NULL REFERENCES wiki_sites(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      page_url TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      UNIQUE (wiki_site_id, position)
    );

    CREATE TABLE IF NOT EXISTS wiki_entry_programs (
      wiki_entry_id INTEGER NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      PRIMARY KEY (wiki_entry_id, program_id)
    );

    CREATE TABLE IF NOT EXISTS wiki_entry_topics (
      wiki_entry_id INTEGER NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
      topic_id INTEGER NOT NULL REFERENCES wiki_topics(id) ON DELETE CASCADE,
      PRIMARY KEY (wiki_entry_id, topic_id)
    );

    CREATE INDEX IF NOT EXISTS idx_wiki_entry_programs_program ON wiki_entry_programs(program_id);
    CREATE INDEX IF NOT EXISTS idx_wiki_entry_topics_topic ON wiki_entry_topics(topic_id);
    CREATE INDEX IF NOT EXISTS idx_wiki_entries_site ON wiki_entries(wiki_site_id, position);

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS wiki_site_search USING fts5(
      name,
      summary,
      tag_names,
      entry_text,
      tokenize = "unicode61 remove_diacritics 2"
    );
  `);
  database = db;
  migrateLegacyLabelsIfNeeded();
  seedWikiTopicsIfEmpty();
  seedIfEmpty();
  seedWikiSitesIfEmpty();
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
    throw new HttpError(400, `${label} muss Text sein.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new HttpError(400, `${label} darf höchstens ${max} Zeichen lang sein.`);
  }
  return trimmed;
}

function normalizeUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Wiki-Links müssen Text sein.');
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new HttpError(400, 'Wiki-Links müssen gültige http- oder https-Adressen sein.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Wiki-Links müssen gültige http- oder https-Adressen sein.');
  }
  return url.toString();
}

function normalizeLabelNames(value: unknown, label: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, `Für „${label}“ wird eine Liste von Namen erwartet.`);
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new HttpError(400, `Für „${label}“ wird eine Liste von Namen erwartet.`);
    }
    const name = entry.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    if (name.length > 40) {
      throw new HttpError(400, `Namen bei „${label}“ dürfen höchstens 40 Zeichen lang sein.`);
    }
    if (name.includes(',')) {
      throw new HttpError(400, `Namen bei „${label}“ dürfen keine Kommas enthalten.`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function parseIssueInput(body: unknown): IssueInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Der Vorgang muss ein Objekt sein.');
  }
  const record = body as Record<string, unknown>;
  const title = optionalText(record['title'], 'Titel', 200);
  if (!title) {
    throw new HttpError(400, 'Der Titel ist erforderlich.');
  }
  const summary = optionalText(record['summary'], 'Zusammenfassung', 5000);
  const programsRaw = record['programs'] ?? record['tags'];
  const programs = normalizeLabelNames(programsRaw, 'Programme');
  if (!Array.isArray(record['checkpoints']) && record['checkpoints'] != null) {
    throw new HttpError(400, 'Schritte müssen eine Liste sein.');
  }
  const rawSteps = Array.isArray(record['checkpoints']) ? record['checkpoints'] : [];
  const checkpoints: CheckpointInput[] = [];
  for (const step of rawSteps) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new HttpError(400, 'Jeder Schritt muss ein Objekt sein.');
    }
    const fields = step as Record<string, unknown>;
    const instruction = optionalText(fields['instruction'], 'Schrittanweisung', 5000);
    const wikiUrl = normalizeUrl(fields['wikiUrl']);
    const sharePath = optionalText(fields['sharePath'], 'Freigabepfad', 500) || null;
    if (!instruction && !wikiUrl && !sharePath) continue;
    checkpoints.push({ instruction, wikiUrl, sharePath });
  }
  return { title, summary, programs, checkpoints };
}

function readIssuePrograms(issueId: number): string[] {
  const rows = db()
    .prepare(
      `SELECT p.name AS name
       FROM programs p
       JOIN issue_programs ip ON ip.program_id = p.id
       WHERE ip.issue_id = ?
       ORDER BY p.name COLLATE NOCASE`,
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
    programs: readIssuePrograms(issueId),
    checkpoints: readCheckpoints(issueId),
    createdAt: text(row['createdAt']),
    updatedAt: text(row['updatedAt']),
  };
}

function replaceIssuePrograms(issueId: number, programs: string[]): void {
  const connection = db();
  connection.prepare('DELETE FROM issue_programs WHERE issue_id = ?').run(issueId);
  const findProgram = connection.prepare('SELECT id FROM programs WHERE name = ?');
  const link = connection.prepare('INSERT INTO issue_programs (issue_id, program_id) VALUES (?, ?)');
  for (const name of programs) {
    const program = findProgram.get(name);
    if (!program) {
      throw new HttpError(400, `Unbekanntes Programm „${name}“. Lege es zuerst unter Bezeichnungen an.`);
    }
    link.run(issueId, num(program['id']));
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
    .run(issueId, issue.title, issue.summary, issue.programs.join(' '), checkpointText);
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
    replaceIssuePrograms(id, input.programs);
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
      throw new HttpError(404, 'Vorgang nicht gefunden.');
    }
    db()
      .prepare('UPDATE issues SET title = ?, summary = ?, updated_at = ? WHERE id = ?')
      .run(input.title, input.summary, new Date().toISOString(), id);
    replaceIssuePrograms(id, input.programs);
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
      throw new HttpError(404, 'Vorgang nicht gefunden.');
    }
    db().prepare('DELETE FROM issue_search WHERE rowid = ?').run(id);
  });
}

function parseWikiSiteInput(body: unknown): WikiSiteInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Das Wiki muss ein Objekt sein.');
  }
  const record = body as Record<string, unknown>;
  const name = optionalText(record['name'], 'Name', 200);
  if (!name) {
    throw new HttpError(400, 'Der Name ist erforderlich.');
  }
  const baseUrl = normalizeUrl(record['baseUrl']);
  if (!baseUrl) {
    throw new HttpError(400, 'Die Website-URL ist erforderlich und muss http oder https sein.');
  }
  const summary = optionalText(record['summary'], 'Zusammenfassung', 5000);
  if (!Array.isArray(record['entries']) && record['entries'] != null) {
    throw new HttpError(400, 'Seiten müssen eine Liste sein.');
  }
  const rawEntries = Array.isArray(record['entries']) ? record['entries'] : [];
  const entries: WikiEntryInput[] = [];
  for (const entry of rawEntries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new HttpError(400, 'Jede Seite muss ein Objekt sein.');
    }
    const fields = entry as Record<string, unknown>;
    const title = optionalText(fields['title'], 'Seitentitel', 200);
    const pageUrl = normalizeUrl(fields['pageUrl']);
    const notes = optionalText(fields['notes'], 'Seitennotiz', 5000);
    if (!title && !pageUrl && !notes) continue;
    if (!title) {
      throw new HttpError(400, 'Jede Seite braucht einen Titel.');
    }
    if (!pageUrl) {
      throw new HttpError(400, 'Jede Seite braucht eine gültige http- oder https-Adresse.');
    }
    const programs = normalizeLabelNames(fields['programs'], 'Programme');
    const topics = normalizeLabelNames(fields['topics'], 'Wiki-Themen');
    entries.push({ title, pageUrl, notes, programs, topics });
  }
  return { name, baseUrl, summary, entries };
}

function readEntryPrograms(entryId: number): string[] {
  const rows = db()
    .prepare(
      `SELECT p.name AS name
       FROM programs p
       JOIN wiki_entry_programs wep ON wep.program_id = p.id
       WHERE wep.wiki_entry_id = ?
       ORDER BY p.name COLLATE NOCASE`,
    )
    .all(entryId);
  return rows.map((row) => text(row['name']));
}

function readEntryTopics(entryId: number): string[] {
  const rows = db()
    .prepare(
      `SELECT t.name AS name
       FROM wiki_topics t
       JOIN wiki_entry_topics wet ON wet.topic_id = t.id
       WHERE wet.wiki_entry_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(entryId);
  return rows.map((row) => text(row['name']));
}

function readWikiSitePrograms(wikiSiteId: number): string[] {
  const rows = db()
    .prepare(
      `SELECT DISTINCT p.name AS name
       FROM programs p
       JOIN wiki_entry_programs wep ON wep.program_id = p.id
       JOIN wiki_entries e ON e.id = wep.wiki_entry_id
       WHERE e.wiki_site_id = ?
       ORDER BY p.name COLLATE NOCASE`,
    )
    .all(wikiSiteId);
  return rows.map((row) => text(row['name']));
}

function readWikiSiteTopics(wikiSiteId: number): string[] {
  const rows = db()
    .prepare(
      `SELECT DISTINCT t.name AS name
       FROM wiki_topics t
       JOIN wiki_entry_topics wet ON wet.topic_id = t.id
       JOIN wiki_entries e ON e.id = wet.wiki_entry_id
       WHERE e.wiki_site_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(wikiSiteId);
  return rows.map((row) => text(row['name']));
}

function readWikiEntries(wikiSiteId: number): WikiEntry[] {
  const rows = db()
    .prepare(
      `SELECT id, position, title, page_url AS pageUrl, notes
       FROM wiki_entries
       WHERE wiki_site_id = ?
       ORDER BY position ASC, id ASC`,
    )
    .all(wikiSiteId);
  return rows.map((row) => {
    const entryId = num(row['id']);
    return {
      id: entryId,
      position: num(row['position']),
      title: text(row['title']),
      pageUrl: text(row['pageUrl']),
      notes: text(row['notes']),
      programs: readEntryPrograms(entryId),
      topics: readEntryTopics(entryId),
    };
  });
}

export function getWikiSite(id: number): WikiSite | null {
  const row = db()
    .prepare(
      `SELECT id, name, base_url AS baseUrl, summary, created_at AS createdAt, updated_at AS updatedAt
       FROM wiki_sites WHERE id = ?`,
    )
    .get(id);
  if (!row) return null;
  const wikiSiteId = num(row['id']);
  return {
    id: wikiSiteId,
    name: text(row['name']),
    baseUrl: text(row['baseUrl']),
    summary: text(row['summary']),
    entries: readWikiEntries(wikiSiteId),
    createdAt: text(row['createdAt']),
    updatedAt: text(row['updatedAt']),
  };
}

function linkEntryPrograms(entryId: number, programs: string[]): void {
  const connection = db();
  const findProgram = connection.prepare('SELECT id FROM programs WHERE name = ?');
  const link = connection.prepare(
    'INSERT INTO wiki_entry_programs (wiki_entry_id, program_id) VALUES (?, ?)',
  );
  for (const name of programs) {
    const program = findProgram.get(name);
    if (!program) {
      throw new HttpError(400, `Unbekanntes Programm „${name}“. Lege es zuerst unter Bezeichnungen an.`);
    }
    link.run(entryId, num(program['id']));
  }
}

function linkEntryTopics(entryId: number, topics: string[]): void {
  const connection = db();
  const findTopic = connection.prepare('SELECT id FROM wiki_topics WHERE name = ?');
  const link = connection.prepare(
    'INSERT INTO wiki_entry_topics (wiki_entry_id, topic_id) VALUES (?, ?)',
  );
  for (const name of topics) {
    const topic = findTopic.get(name);
    if (!topic) {
      throw new HttpError(400, `Unbekanntes Wiki-Thema „${name}“. Lege es zuerst unter Bezeichnungen an.`);
    }
    link.run(entryId, num(topic['id']));
  }
}

function replaceWikiEntries(wikiSiteId: number, entries: WikiEntryInput[]): void {
  const connection = db();
  connection.prepare('DELETE FROM wiki_entries WHERE wiki_site_id = ?').run(wikiSiteId);
  const insert = connection.prepare(
    `INSERT INTO wiki_entries (wiki_site_id, position, title, page_url, notes)
     VALUES (?, ?, ?, ?, ?)`,
  );
  entries.forEach((entry, position) => {
    const result = insert.run(wikiSiteId, position, entry.title, entry.pageUrl, entry.notes);
    const entryId = Number(result.lastInsertRowid);
    linkEntryPrograms(entryId, entry.programs);
    linkEntryTopics(entryId, entry.topics);
  });
}

function rebuildWikiSearch(wikiSiteId: number): void {
  const site = getWikiSite(wikiSiteId);
  const connection = db();
  connection.prepare('DELETE FROM wiki_site_search WHERE rowid = ?').run(wikiSiteId);
  if (!site) return;
  const labelNames = [
    ...readWikiSitePrograms(wikiSiteId),
    ...readWikiSiteTopics(wikiSiteId),
  ].join(' ');
  const entryText = site.entries
    .map((entry) =>
      [entry.title, entry.pageUrl, entry.notes, ...entry.programs, ...entry.topics]
        .filter(Boolean)
        .join(' '),
    )
    .join('\n');
  connection
    .prepare(
      `INSERT INTO wiki_site_search (rowid, name, summary, tag_names, entry_text)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(wikiSiteId, site.name, site.summary, labelNames, entryText);
}

function insertWikiSite(input: WikiSiteInput, timestamp: string): WikiSite {
  return transaction(() => {
    const result = db()
      .prepare(
        `INSERT INTO wiki_sites (name, base_url, summary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.name, input.baseUrl, input.summary, timestamp, timestamp);
    const id = Number(result.lastInsertRowid);
    replaceWikiEntries(id, input.entries);
    rebuildWikiSearch(id);
    const site = getWikiSite(id);
    if (!site) {
      throw new Error('Wiki site was not saved.');
    }
    return site;
  });
}

export function createWikiSite(body: unknown): WikiSite {
  return insertWikiSite(parseWikiSiteInput(body), new Date().toISOString());
}

export function updateWikiSite(id: number, body: unknown): WikiSite {
  const input = parseWikiSiteInput(body);
  return transaction(() => {
    const existing = getWikiSite(id);
    if (!existing) {
      throw new HttpError(404, 'Wiki nicht gefunden.');
    }
    db()
      .prepare('UPDATE wiki_sites SET name = ?, base_url = ?, summary = ?, updated_at = ? WHERE id = ?')
      .run(input.name, input.baseUrl, input.summary, new Date().toISOString(), id);
    replaceWikiEntries(id, input.entries);
    rebuildWikiSearch(id);
    const site = getWikiSite(id);
    if (!site) {
      throw new Error('Wiki site was not saved.');
    }
    return site;
  });
}

export function deleteWikiSite(id: number): void {
  transaction(() => {
    const result = db().prepare('DELETE FROM wiki_sites WHERE id = ?').run(id);
    if (Number(result.changes) === 0) {
      throw new HttpError(404, 'Wiki nicht gefunden.');
    }
    db().prepare('DELETE FROM wiki_site_search WHERE rowid = ?').run(id);
  });
}

export function listWikiSites(query: string, programs: string[], topics: string[]): WikiSiteSummary[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 200) {
    throw new HttpError(400, 'Der Suchtext ist zu lang.');
  }
  const fts = toFtsQuery(trimmedQuery);
  const selectedPrograms = uniqueLabelNames(programs);
  const selectedTopics = uniqueLabelNames(topics);
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (fts) {
    where.push('w.id IN (SELECT rowid FROM wiki_site_search WHERE wiki_site_search MATCH ?)');
    params.push(fts);
  }
  if (selectedPrograms.length > 0) {
    const placeholders = selectedPrograms.map(() => '?').join(', ');
    where.push(
      `w.id IN (
        SELECT e.wiki_site_id
        FROM wiki_entries e
        JOIN wiki_entry_programs wep ON wep.wiki_entry_id = e.id
        JOIN programs p ON p.id = wep.program_id
        WHERE p.name IN (${placeholders})
        GROUP BY e.wiki_site_id
        HAVING COUNT(DISTINCT p.id) = ?
      )`,
    );
    params.push(...selectedPrograms, selectedPrograms.length);
  }
  if (selectedTopics.length > 0) {
    const placeholders = selectedTopics.map(() => '?').join(', ');
    where.push(
      `w.id IN (
        SELECT e.wiki_site_id
        FROM wiki_entries e
        JOIN wiki_entry_topics wet ON wet.wiki_entry_id = e.id
        JOIN wiki_topics t ON t.id = wet.topic_id
        WHERE t.name IN (${placeholders})
        GROUP BY e.wiki_site_id
        HAVING COUNT(DISTINCT t.id) = ?
      )`,
    );
    params.push(...selectedTopics, selectedTopics.length);
  }

  const sql = `
    SELECT
      w.id,
      w.name,
      w.base_url AS baseUrl,
      w.summary,
      w.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM wiki_entries e WHERE e.wiki_site_id = w.id) AS entryCount
    FROM wiki_sites w
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY w.updated_at DESC, w.id DESC
  `;

  let rows: Record<string, SQLOutputValue>[];
  try {
    rows = db().prepare(sql).all(...params);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('fts5')) {
      throw new HttpError(400, 'Diese Suche konnte nicht ausgeführt werden.');
    }
    throw error;
  }

  return rows.map((row) => {
    const id = num(row['id']);
    return {
      id,
      name: text(row['name']),
      baseUrl: text(row['baseUrl']),
      summary: text(row['summary']),
      programs: readWikiSitePrograms(id),
      topics: readWikiSiteTopics(id),
      entryCount: num(row['entryCount']),
      updatedAt: text(row['updatedAt']),
    };
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

function uniqueLabelNames(names: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
}

export function listIssues(query: string, programs: string[]): IssueSummary[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 200) {
    throw new HttpError(400, 'Der Suchtext ist zu lang.');
  }
  const fts = toFtsQuery(trimmedQuery);
  const selectedPrograms = uniqueLabelNames(programs);
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (fts) {
    where.push('i.id IN (SELECT rowid FROM issue_search WHERE issue_search MATCH ?)');
    params.push(fts);
  }
  if (selectedPrograms.length > 0) {
    const placeholders = selectedPrograms.map(() => '?').join(', ');
    where.push(
      `i.id IN (
        SELECT ip.issue_id
        FROM issue_programs ip
        JOIN programs p ON p.id = ip.program_id
        WHERE p.name IN (${placeholders})
        GROUP BY ip.issue_id
        HAVING COUNT(DISTINCT p.id) = ?
      )`,
    );
    params.push(...selectedPrograms, selectedPrograms.length);
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
      throw new HttpError(400, 'Diese Suche konnte nicht ausgeführt werden.');
    }
    throw error;
  }

  return rows.map((row) => {
    const id = num(row['id']);
    return {
      id,
      title: text(row['title']),
      summary: text(row['summary']),
      programs: readIssuePrograms(id),
      checkpointCount: num(row['checkpointCount']),
      updatedAt: text(row['updatedAt']),
    };
  });
}

export function listPrograms(): string[] {
  return db()
    .prepare('SELECT name FROM programs ORDER BY name COLLATE NOCASE')
    .all()
    .map((row) => text(row['name']));
}

export function listWikiTopics(): string[] {
  return db()
    .prepare('SELECT name FROM wiki_topics ORDER BY name COLLATE NOCASE')
    .all()
    .map((row) => text(row['name']));
}

function parseLabelName(body: unknown, label: string): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, `„${label}“ muss ein Objekt mit einem Namen sein.`);
  }
  const raw = (body as Record<string, unknown>)['name'];
  if (typeof raw !== 'string') {
    throw new HttpError(400, `Für „${label}“ ist ein Name erforderlich.`);
  }
  const names = normalizeLabelNames([raw], label);
  if (names.length !== 1) {
    throw new HttpError(400, `Für „${label}“ ist ein Name erforderlich.`);
  }
  return names[0];
}

export function createProgram(body: unknown): { name: string } {
  const name = parseLabelName(body, 'Programm');
  const connection = db();
  const existing = connection.prepare('SELECT id FROM programs WHERE name = ?').get(name);
  if (existing) {
    throw new HttpError(409, 'Ein Programm mit diesem Namen existiert bereits.');
  }
  connection.prepare('INSERT INTO programs (name) VALUES (?)').run(name);
  return { name };
}

export function createWikiTopic(body: unknown): { name: string } {
  const name = parseLabelName(body, 'Wiki-Thema');
  const connection = db();
  const existing = connection.prepare('SELECT id FROM wiki_topics WHERE name = ?').get(name);
  if (existing) {
    throw new HttpError(409, 'Ein Wiki-Thema mit diesem Namen existiert bereits.');
  }
  connection.prepare('INSERT INTO wiki_topics (name) VALUES (?)').run(name);
  return { name };
}

export function deleteProgram(body: unknown): void {
  const name = parseLabelName(body, 'Programm');
  transaction(() => {
    const connection = db();
    const program = connection.prepare('SELECT id FROM programs WHERE name = ?').get(name);
    if (!program) {
      throw new HttpError(404, 'Programm nicht gefunden.');
    }
    const programId = num(program['id']);
    const issueIds = connection
      .prepare('SELECT issue_id FROM issue_programs WHERE program_id = ?')
      .all(programId)
      .map((row) => num(row['issue_id']));
    const wikiSiteIds = connection
      .prepare(
        `SELECT DISTINCT e.wiki_site_id AS wikiSiteId
         FROM wiki_entries e
         JOIN wiki_entry_programs wep ON wep.wiki_entry_id = e.id
         WHERE wep.program_id = ?`,
      )
      .all(programId)
      .map((row) => num(row['wikiSiteId']));
    connection.prepare('DELETE FROM programs WHERE id = ?').run(programId);
    for (const issueId of issueIds) {
      rebuildSearch(issueId);
    }
    for (const wikiSiteId of wikiSiteIds) {
      rebuildWikiSearch(wikiSiteId);
    }
  });
}

export function deleteWikiTopic(body: unknown): void {
  const name = parseLabelName(body, 'Wiki-Thema');
  transaction(() => {
    const connection = db();
    const topic = connection.prepare('SELECT id FROM wiki_topics WHERE name = ?').get(name);
    if (!topic) {
      throw new HttpError(404, 'Wiki-Thema nicht gefunden.');
    }
    const topicId = num(topic['id']);
    const wikiSiteIds = connection
      .prepare(
        `SELECT DISTINCT e.wiki_site_id AS wikiSiteId
         FROM wiki_entries e
         JOIN wiki_entry_topics wet ON wet.wiki_entry_id = e.id
         WHERE wet.topic_id = ?`,
      )
      .all(topicId)
      .map((row) => num(row['wikiSiteId']));
    connection.prepare('DELETE FROM wiki_topics WHERE id = ?').run(topicId);
    for (const wikiSiteId of wikiSiteIds) {
      rebuildWikiSearch(wikiSiteId);
    }
  });
}

function tableExists(name: string): boolean {
  const row = db()
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name);
  return row != null;
}

function migrateLegacyLabelsIfNeeded(): void {
  const done = db().prepare(`SELECT value FROM app_meta WHERE key = 'labels_v2'`).get();
  if (done) return;

  if (!tableExists('tags')) {
    db().prepare(`INSERT INTO app_meta (key, value) VALUES ('labels_v2', '1')`).run();
    return;
  }

  transaction(() => {
    const connection = db();
    connection.exec(`
      INSERT OR IGNORE INTO programs (id, name)
      SELECT id, name FROM tags;
    `);
    connection.exec(`
      INSERT OR IGNORE INTO issue_programs (issue_id, program_id)
      SELECT issue_id, tag_id FROM issue_tags;
    `);

    if (tableExists('wiki_site_tags')) {
      const siteTags = connection
        .prepare(
          `SELECT wst.wiki_site_id AS wikiSiteId, t.name AS name
           FROM wiki_site_tags wst
           JOIN tags t ON t.id = wst.tag_id`,
        )
        .all();
      const entriesBySite = connection.prepare(
        `SELECT id FROM wiki_entries WHERE wiki_site_id = ?`,
      );
      const ensureProgram = connection.prepare('SELECT id FROM programs WHERE name = ?');
      const linkProgram = connection.prepare(
        'INSERT OR IGNORE INTO wiki_entry_programs (wiki_entry_id, program_id) VALUES (?, ?)',
      );
      for (const row of siteTags) {
        const wikiSiteId = num(row['wikiSiteId']);
        const programName = text(row['name']);
        const program = ensureProgram.get(programName);
        if (!program) continue;
        const programId = num(program['id']);
        const entries = entriesBySite.all(wikiSiteId);
        for (const entry of entries) {
          linkProgram.run(num(entry['id']), programId);
        }
      }
    }

    connection.exec('DROP TABLE IF EXISTS issue_tags');
    connection.exec('DROP TABLE IF EXISTS wiki_site_tags');
    connection.exec('DROP TABLE IF EXISTS tags');

    connection.prepare(`INSERT INTO app_meta (key, value) VALUES ('labels_v2', '1')`).run();
  });

  const issueIds = db()
    .prepare('SELECT id FROM issues')
    .all()
    .map((row) => num(row['id']));
  for (const issueId of issueIds) {
    rebuildSearch(issueId);
  }
  const wikiSiteIds = db()
    .prepare('SELECT id FROM wiki_sites')
    .all()
    .map((row) => num(row['id']));
  for (const wikiSiteId of wikiSiteIds) {
    rebuildWikiSearch(wikiSiteId);
  }
}

function seedWikiTopicsIfEmpty(): void {
  const row = db().prepare('SELECT COUNT(*) AS count FROM wiki_topics').get();
  if (num(row?.['count']) > 0) return;
  const insert = db().prepare('INSERT INTO wiki_topics (name) VALUES (?)');
  for (const name of ['documentation', 'error codes']) {
    insert.run(name);
  }
}

function ensurePrograms(names: string[]): void {
  const insert = db().prepare('INSERT OR IGNORE INTO programs (name) VALUES (?)');
  for (const name of names) {
    insert.run(name);
  }
}

function seedIfEmpty(): void {
  const row = db().prepare('SELECT COUNT(*) AS count FROM issues').get();
  if (num(row?.['count']) > 0) return;

  ensurePrograms(['Teams', 'tickets', 'Skype']);

  insertIssue(
    {
      title: 'Teams meeting will not join',
      summary:
        'Desktop client stays on "Joining meeting". Chat and the ticket both point at the company network. The web client is the workaround, then a cache reset if the desktop app is still stuck.',
      programs: ['Teams', 'tickets'],
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
      programs: ['Skype'],
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

function seedWikiSitesIfEmpty(): void {
  const row = db().prepare('SELECT COUNT(*) AS count FROM wiki_sites').get();
  if (num(row?.['count']) > 0) return;

  ensurePrograms(['Teams', 'Microsoft', 'Skype']);

  insertWikiSite(
    {
      name: 'Microsoft Teams docs',
      baseUrl: 'https://learn.microsoft.com/en-us/microsoftteams/',
      summary:
        'Official Teams troubleshooting and admin articles. Use it when the desktop client or meetings misbehave.',
      entries: [
        {
          title: 'Troubleshoot meetings',
          pageUrl:
            'https://learn.microsoft.com/en-us/microsoftteams/troubleshoot/meetings/troubleshoot-meetings',
          notes: 'Join failures, audio, and screen sharing on the desktop app.',
          programs: ['Teams', 'Microsoft'],
          topics: ['documentation'],
        },
        {
          title: 'Clear Teams cache',
          pageUrl:
            'https://learn.microsoft.com/en-us/microsoftteams/troubleshoot/teams-sign-in/sign-in-loop',
          notes: 'Sign-in loops and stale profiles after an upgrade.',
          programs: ['Teams'],
          topics: ['documentation', 'error codes'],
        },
      ],
    },
    '2026-03-05T10:00:00.000Z',
  );

  insertWikiSite(
    {
      name: 'Skype support',
      baseUrl: 'https://support.microsoft.com/en-us/skype',
      summary: 'Legacy Skype client help for presence, sign-in, and profile issues.',
      entries: [
        {
          title: 'Skype help home',
          pageUrl: 'https://support.microsoft.com/en-us/skype/skype-help',
          notes: 'Start here for sign-in and presence problems.',
          programs: ['Skype', 'Microsoft'],
          topics: ['documentation'],
        },
      ],
    },
    '2026-04-20T09:15:00.000Z',
  );
}
