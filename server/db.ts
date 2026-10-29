import { mkdirSync } from 'node:fs';
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite';
import { dirname } from 'node:path';

const SCHEMA_VERSION = 4;

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
  searchSnippet: string | null;
}

export interface WikiEntry {
  id: number;
  position: number;
  title: string;
  locations: string[];
  notes: string;
  tags: string[];
}

export interface WikiSite {
  id: number;
  name: string;
  summary: string;
  entries: WikiEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface WikiSiteSummary {
  id: number;
  name: string;
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

export interface ListQueryOptions {
  limit?: number;
}

const MAX_LIST_LIMIT = 50;

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

interface WikiEntryInput {
  title: string;
  locations: string[];
  notes: string;
  tags: string[];
}

interface WikiSiteInput {
  name: string;
  summary: string;
  entries: WikiEntryInput[];
}

type StoredCheckpoint = CheckpointInput;
type StoredWikiEntry = WikiEntryInput;

let database: DatabaseSync | null = null;

export function initDatabase(dbPath: string): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath, {
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });
  db.exec('PRAGMA journal_mode = WAL;');
  database = db;

  const startVersion = schemaVersion();
  if (startVersion < SCHEMA_VERSION) {
    if (startVersion < 3) {
      migrateToV3();
    }
    ensureSchemaV3();
    if (startVersion < 4) {
      migrateToV4();
    }
    setSchemaVersion(SCHEMA_VERSION);
  } else {
    ensureSchemaV3();
  }

  ensureDefaultProgramTags();
  seedIfEmpty();
  seedWikiSitesIfEmpty();
}

function db(): DatabaseSync {
  if (!database) {
    throw new Error('Database is not open.');
  }
  return database;
}

function schemaVersion(): number {
  const row = db().prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  return num(row?.['user_version']);
}

function setSchemaVersion(version: number): void {
  db().exec(`PRAGMA user_version = ${version}`);
}

function tableExists(name: string): boolean {
  const row = db()
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name);
  return row != null;
}

function ensureSchemaV3(): void {
  db().exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      checkpoints_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issue_tags (
      issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (issue_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_issue_tags_tag ON issue_tags(tag_id);

    CREATE TABLE IF NOT EXISTS wiki_sites (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      entries_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wiki_tags (
      wiki_site_id INTEGER NOT NULL REFERENCES wiki_sites(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (wiki_site_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_wiki_tags_tag ON wiki_tags(tag_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS issue_search USING fts5(
      title,
      summary,
      tag_names,
      checkpoint_text,
      tokenize = "unicode61 remove_diacritics 2"
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS wiki_site_search USING fts5(
      name,
      summary,
      tag_names,
      entry_text,
      tokenize = "unicode61 remove_diacritics 2"
    );
  `);
}

function dropLegacyTables(): void {
  const connection = db();
  const drops = [
    'issue_tags_old',
    'checkpoints',
    'issue_programs',
    'issue_tags_legacy',
    'wiki_entries',
    'wiki_entry_programs',
    'wiki_entry_topics',
    'programs',
    'wiki_topics',
    'tags_legacy',
    'app_meta',
  ];
  for (const name of drops) {
    connection.exec(`DROP TABLE IF EXISTS ${name}`);
  }
  if (tableExists('issue_search')) {
    connection.exec('DROP TABLE issue_search');
  }
  if (tableExists('wiki_site_search')) {
    connection.exec('DROP TABLE wiki_site_search');
  }
}

function migrateToV3(): void {
  if (!tableExists('issues') && !tableExists('programs') && !tableExists('tags')) {
    ensureSchemaV3();
    return;
  }

  transaction(() => {
    const connection = db();
    ensureSchemaV3();

    if (tableExists('programs')) {
      connection.exec(`INSERT OR IGNORE INTO tags (id, name) SELECT id, name FROM programs`);
    }
    if (tableExists('wiki_topics')) {
      connection.exec(`
        INSERT OR IGNORE INTO tags (name)
        SELECT name FROM wiki_topics
        WHERE NOT EXISTS (SELECT 1 FROM tags t WHERE t.name = wiki_topics.name COLLATE NOCASE)
      `);
    }

    if (!columnExists('issues', 'checkpoints_json')) {
      connection.exec(`ALTER TABLE issues ADD COLUMN checkpoints_json TEXT NOT NULL DEFAULT '[]'`);
    }
    if (tableExists('checkpoints')) {
      const issues = connection.prepare('SELECT id FROM issues').all();
      const readSteps = connection.prepare(
        `SELECT instruction, wiki_url AS wikiUrl, share_path AS sharePath
         FROM checkpoints WHERE issue_id = ? ORDER BY position ASC, id ASC`,
      );
      const update = connection.prepare('UPDATE issues SET checkpoints_json = ? WHERE id = ?');
      for (const row of issues) {
        const issueId = num(row['id']);
        const steps = readSteps.all(issueId).map((step) => ({
          instruction: text(step['instruction']),
          wikiUrl: nullableText(step['wikiUrl']),
          sharePath: nullableText(step['sharePath']),
        }));
        update.run(JSON.stringify(steps), issueId);
      }
    }

    if (tableExists('issue_programs')) {
      connection.prepare('DELETE FROM issue_tags').run();
      connection.exec(`
        INSERT OR IGNORE INTO issue_tags (issue_id, tag_id)
        SELECT ip.issue_id, t.id
        FROM issue_programs ip
        JOIN tags t ON t.id = ip.program_id
      `);
    }

    if (!columnExists('wiki_sites', 'entries_json')) {
      connection.exec(`ALTER TABLE wiki_sites ADD COLUMN entries_json TEXT NOT NULL DEFAULT '[]'`);
    }
    if (tableExists('wiki_entries')) {
      const sites = connection.prepare('SELECT id FROM wiki_sites').all();
      const readEntries = connection.prepare(
        `SELECT id, position, title, page_url AS pageUrl, notes
         FROM wiki_entries WHERE wiki_site_id = ? ORDER BY position ASC, id ASC`,
      );
      const readPrograms = connection.prepare(
        `SELECT t.name FROM tags t
         JOIN wiki_entry_programs wep ON wep.program_id = t.id
         WHERE wep.wiki_entry_id = ? ORDER BY t.name COLLATE NOCASE`,
      );
      const readTopics = tableExists('wiki_topics')
        ? connection.prepare(
            `SELECT wt.name FROM wiki_topics wt
             JOIN wiki_entry_topics wet ON wet.topic_id = wt.id
             WHERE wet.wiki_entry_id = ? ORDER BY wt.name COLLATE NOCASE`,
          )
        : null;
      const updateSite = connection.prepare('UPDATE wiki_sites SET entries_json = ? WHERE id = ?');
      for (const siteRow of sites) {
        const siteId = num(siteRow['id']);
        const entryRows = readEntries.all(siteId);
        const stored: StoredWikiEntry[] = [];
        for (const entry of entryRows) {
          const entryId = num(entry['id']);
          const programNames = tableExists('wiki_entry_programs')
            ? readPrograms.all(entryId).map((r) => text(r['name']))
            : [];
          const topicNames = readTopics ? readTopics.all(entryId).map((r) => text(r['name'])) : [];
          const pageUrl = text(entry['pageUrl']);
          stored.push({
            title: text(entry['title']),
            locations: pageUrl ? [pageUrl] : [],
            notes: text(entry['notes']),
            tags: mergeTagNames(programNames, topicNames),
          });
        }
        updateSite.run(JSON.stringify(stored), siteId);
      }
    }

    connection.exec(`
      CREATE TABLE IF NOT EXISTS wiki_tags (
        wiki_site_id INTEGER NOT NULL REFERENCES wiki_sites(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (wiki_site_id, tag_id)
      );
    `);
    connection.prepare('DELETE FROM wiki_tags').run();
    const wikiSites = connection.prepare('SELECT id, entries_json FROM wiki_sites').all();
    for (const row of wikiSites) {
      syncWikiTagsFromJson(num(row['id']), text(row['entries_json']));
    }

    dropLegacyTables();
    ensureSchemaV3();

    const issueIds = connection
      .prepare('SELECT id FROM issues')
      .all()
      .map((row) => num(row['id']));
    for (const issueId of issueIds) {
      rebuildSearch(issueId);
    }
    const wikiSiteIds = connection
      .prepare('SELECT id FROM wiki_sites')
      .all()
      .map((row) => num(row['id']));
    for (const wikiSiteId of wikiSiteIds) {
      rebuildWikiSearch(wikiSiteId);
    }
  });
}

function migrateToV4(): void {
  transaction(() => {
    const connection = db();
    const rows = connection.prepare('SELECT id, entries_json FROM wiki_sites').all();
    const update = connection.prepare(
      'UPDATE wiki_sites SET entries_json = ?, base_url = ? WHERE id = ?',
    );
    for (const row of rows) {
      const id = num(row['id']);
      const entries = parseEntriesJson(text(row['entries_json']));
      update.run(JSON.stringify(entries), '', id);
      syncWikiTagsFromJson(id, JSON.stringify(entries));
      rebuildWikiSearch(id);
    }
  });
}

function columnExists(table: string, column: string): boolean {
  const rows = db().prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((row) => text(row['name']) === column);
}

function mergeTagNames(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const name of list) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
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
    throw new HttpError(400, 'Externe Dokumentation muss Text sein.');
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new HttpError(
      400,
      'Externe Dokumentation muss eine gültige http- oder https-Adresse sein.',
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(
      400,
      'Externe Dokumentation muss eine gültige http- oder https-Adresse sein.',
    );
  }
  return url.toString();
}

function isSharePath(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('\\\\') || trimmed.startsWith('//') || /^[A-Za-z]:[\\/]/.test(trimmed);
}

function normalizeWikiLocation(value: unknown, label: string): string {
  if (value == null) {
    throw new HttpError(400, `${label} muss Text sein.`);
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, `${label} muss Text sein.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${label} darf nicht leer sein.`);
  }
  if (isSharePath(trimmed)) {
    return optionalText(trimmed, label, 500);
  }
  const url = normalizeUrl(trimmed);
  if (!url) {
    throw new HttpError(
      400,
      `${label} muss eine gültige http- oder https-Adresse oder ein UNC-Pfad sein.`,
    );
  }
  return url;
}

function readStoredWikiLocation(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isSharePath(trimmed)) {
    return trimmed.length <= 500 ? trimmed : null;
  }
  try {
    return normalizeUrl(trimmed);
  } catch {
    return null;
  }
}

function readStoredWikiLocations(fields: Record<string, unknown>): string[] {
  const locations: string[] = [];
  if (Array.isArray(fields['locations'])) {
    for (const item of fields['locations']) {
      const loc = readStoredWikiLocation(item);
      if (loc) locations.push(loc);
    }
    return locations;
  }
  const legacy = readStoredWikiLocation(fields['pageUrl']);
  return legacy ? [legacy] : [];
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

function parseTagsField(record: Record<string, unknown>, label: string): string[] {
  if (record['tags'] != null) {
    return normalizeLabelNames(record['tags'], label);
  }
  const programs = normalizeLabelNames(record['programs'], label);
  const topics = normalizeLabelNames(record['topics'], label);
  return mergeTagNames(programs, topics);
}

function parseCheckpointsJson(raw: string): StoredCheckpoint[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: StoredCheckpoint[] = [];
  for (const step of parsed) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) continue;
    const fields = step as Record<string, unknown>;
    const instruction = optionalText(fields['instruction'], 'Schrittanweisung', 5000);
    const wikiUrl = normalizeUrl(fields['wikiUrl']);
    const sharePath = optionalText(fields['sharePath'], 'Freigabepfad', 500) || null;
    if (!instruction && !wikiUrl && !sharePath) continue;
    out.push({ instruction, wikiUrl, sharePath });
  }
  return out;
}

function parseEntriesJson(raw: string): StoredWikiEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: StoredWikiEntry[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const fields = entry as Record<string, unknown>;
    out.push({
      title: optionalText(fields['title'], 'Eintragstitel', 200),
      locations: readStoredWikiLocations(fields),
      notes: optionalText(fields['notes'], 'Notiz', 5000),
      tags: parseTagsField(fields, 'Bezeichnungen'),
    });
  }
  return out;
}

function toCheckpoints(stored: StoredCheckpoint[]): Checkpoint[] {
  return stored.map((step, position) => ({
    id: position + 1,
    position,
    instruction: step.instruction,
    wikiUrl: step.wikiUrl,
    sharePath: step.sharePath,
  }));
}

function toWikiEntries(stored: StoredWikiEntry[]): WikiEntry[] {
  return stored.map((entry, position) => ({
    id: position + 1,
    position,
    title: entry.title,
    locations: entry.locations,
    notes: entry.notes,
    tags: entry.tags,
  }));
}

function parseIssueInput(body: unknown): IssueInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Das Ticket muss ein Objekt sein.');
  }
  const record = body as Record<string, unknown>;
  const title = optionalText(record['title'], 'Titel', 200);
  if (!title) {
    throw new HttpError(400, 'Der Titel ist erforderlich.');
  }
  const summary = optionalText(record['summary'], 'Zusammenfassung', 5000);
  const tags = parseTagsField(record, 'Bezeichnungen');
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
  return { title, summary, tags, checkpoints };
}

function readIssueTags(issueId: number): string[] {
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

function readCheckpointsFromRow(checkpointsJson: string): Checkpoint[] {
  return toCheckpoints(parseCheckpointsJson(checkpointsJson));
}

export function getIssue(id: number): Issue | null {
  const row = db()
    .prepare(
      `SELECT id, title, summary, checkpoints_json AS checkpointsJson,
              created_at AS createdAt, updated_at AS updatedAt
       FROM issues WHERE id = ?`,
    )
    .get(id);
  if (!row) return null;
  const issueId = num(row['id']);
  return {
    id: issueId,
    title: text(row['title']),
    summary: text(row['summary']),
    tags: readIssueTags(issueId),
    checkpoints: readCheckpointsFromRow(text(row['checkpointsJson'])),
    createdAt: text(row['createdAt']),
    updatedAt: text(row['updatedAt']),
  };
}

function replaceIssueTags(issueId: number, tags: string[]): void {
  const connection = db();
  connection.prepare('DELETE FROM issue_tags WHERE issue_id = ?').run(issueId);
  const findTag = connection.prepare('SELECT id FROM tags WHERE name = ?');
  const link = connection.prepare('INSERT INTO issue_tags (issue_id, tag_id) VALUES (?, ?)');
  for (const name of tags) {
    const tag = findTag.get(name);
    if (!tag) {
      throw new HttpError(
        400,
        `Unbekannte Bezeichnung „${name}“. Lege sie zuerst unter Bezeichnungen an.`,
      );
    }
    link.run(issueId, num(tag['id']));
  }
}

function replaceCheckpoints(issueId: number, checkpoints: CheckpointInput[]): void {
  const stored: StoredCheckpoint[] = checkpoints.map((step) => ({
    instruction: step.instruction,
    wikiUrl: step.wikiUrl,
    sharePath: step.sharePath,
  }));
  db()
    .prepare('UPDATE issues SET checkpoints_json = ? WHERE id = ?')
    .run(JSON.stringify(stored), issueId);
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
    const stored: StoredCheckpoint[] = input.checkpoints.map((step) => ({
      instruction: step.instruction,
      wikiUrl: step.wikiUrl,
      sharePath: step.sharePath,
    }));
    const result = db()
      .prepare(
        `INSERT INTO issues (title, summary, checkpoints_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.title, input.summary, JSON.stringify(stored), timestamp, timestamp);
    const id = Number(result.lastInsertRowid);
    replaceIssueTags(id, input.tags);
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
      throw new HttpError(404, 'Ticket nicht gefunden.');
    }
    const stored: StoredCheckpoint[] = input.checkpoints.map((step) => ({
      instruction: step.instruction,
      wikiUrl: step.wikiUrl,
      sharePath: step.sharePath,
    }));
    db()
      .prepare(
        'UPDATE issues SET title = ?, summary = ?, checkpoints_json = ?, updated_at = ? WHERE id = ?',
      )
      .run(input.title, input.summary, JSON.stringify(stored), new Date().toISOString(), id);
    replaceIssueTags(id, input.tags);
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
      throw new HttpError(404, 'Ticket nicht gefunden.');
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
  const summary = optionalText(record['summary'], 'Zusammenfassung', 5000);
  if (!Array.isArray(record['entries']) && record['entries'] != null) {
    throw new HttpError(400, 'Einträge müssen eine Liste sein.');
  }
  const rawEntries = Array.isArray(record['entries']) ? record['entries'] : [];
  const entries: WikiEntryInput[] = [];
  for (const entry of rawEntries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new HttpError(400, 'Jeder Eintrag muss ein Objekt sein.');
    }
    const fields = entry as Record<string, unknown>;
    const title = optionalText(fields['title'], 'Eintragstitel', 200);
    const notes = optionalText(fields['notes'], 'Notiz', 5000);
    const tags = parseTagsField(fields, 'Bezeichnungen');
    const rawLocations = fields['locations'];
    const locations: string[] = [];
    if (rawLocations != null) {
      if (!Array.isArray(rawLocations)) {
        throw new HttpError(400, 'Fundorte müssen eine Liste sein.');
      }
      for (const item of rawLocations) {
        locations.push(normalizeWikiLocation(item, 'Fundort'));
      }
    }
    if (!title && locations.length === 0 && !notes && tags.length === 0) continue;
    if (!title) {
      throw new HttpError(400, 'Jeder Eintrag braucht einen Titel.');
    }
    if (locations.length === 0 && !notes) {
      throw new HttpError(400, 'Jeder Eintrag braucht mindestens einen Fundort oder eine Notiz.');
    }
    entries.push({ title, locations, notes, tags });
  }
  return { name, summary, entries };
}

function readWikiSiteTags(wikiSiteId: number): string[] {
  const rows = db()
    .prepare(
      `SELECT t.name AS name
       FROM tags t
       JOIN wiki_tags wt ON wt.tag_id = t.id
       WHERE wt.wiki_site_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(wikiSiteId);
  return rows.map((row) => text(row['name']));
}

function readWikiEntriesFromRow(entriesJson: string): WikiEntry[] {
  return toWikiEntries(parseEntriesJson(entriesJson));
}

function validateEntryTags(entries: WikiEntryInput[]): void {
  const findTag = db().prepare('SELECT id FROM tags WHERE name = ?');
  for (const entry of entries) {
    for (const name of entry.tags) {
      const tag = findTag.get(name);
      if (!tag) {
        throw new HttpError(
          400,
          `Unbekannte Bezeichnung „${name}“. Lege sie zuerst unter Bezeichnungen an.`,
        );
      }
    }
  }
}

function syncWikiTagsFromJson(wikiSiteId: number, entriesJson: string): void {
  const connection = db();
  connection.prepare('DELETE FROM wiki_tags WHERE wiki_site_id = ?').run(wikiSiteId);
  const entries = parseEntriesJson(entriesJson);
  const names = mergeTagNames(...entries.map((e) => e.tags));
  const findTag = connection.prepare('SELECT id FROM tags WHERE name = ?');
  const link = connection.prepare(
    'INSERT OR IGNORE INTO wiki_tags (wiki_site_id, tag_id) VALUES (?, ?)',
  );
  for (const name of names) {
    const tag = findTag.get(name);
    if (!tag) continue;
    link.run(wikiSiteId, num(tag['id']));
  }
}

function syncWikiTagsFromEntries(wikiSiteId: number, entries: WikiEntryInput[]): void {
  syncWikiTagsFromJson(wikiSiteId, JSON.stringify(entries));
}

export function getWikiSite(id: number): WikiSite | null {
  const row = db()
    .prepare(
      `SELECT id, name, summary, entries_json AS entriesJson,
              created_at AS createdAt, updated_at AS updatedAt
       FROM wiki_sites WHERE id = ?`,
    )
    .get(id);
  if (!row) return null;
  return {
    id: num(row['id']),
    name: text(row['name']),
    summary: text(row['summary']),
    entries: readWikiEntriesFromRow(text(row['entriesJson'])),
    createdAt: text(row['createdAt']),
    updatedAt: text(row['updatedAt']),
  };
}

function rebuildWikiSearch(wikiSiteId: number): void {
  const site = getWikiSite(wikiSiteId);
  const connection = db();
  connection.prepare('DELETE FROM wiki_site_search WHERE rowid = ?').run(wikiSiteId);
  if (!site) return;
  const labelNames = readWikiSiteTags(wikiSiteId).join(' ');
  const entryText = site.entries
    .map((entry) =>
      [entry.title, ...entry.locations, entry.notes, ...entry.tags].filter(Boolean).join(' '),
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
  validateEntryTags(input.entries);
  return transaction(() => {
    const result = db()
      .prepare(
        `INSERT INTO wiki_sites (name, base_url, summary, entries_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(input.name, '', input.summary, JSON.stringify(input.entries), timestamp, timestamp);
    const id = Number(result.lastInsertRowid);
    syncWikiTagsFromEntries(id, input.entries);
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
  validateEntryTags(input.entries);
  return transaction(() => {
    const existing = getWikiSite(id);
    if (!existing) {
      throw new HttpError(404, 'Wiki nicht gefunden.');
    }
    db()
      .prepare(
        'UPDATE wiki_sites SET name = ?, base_url = ?, summary = ?, entries_json = ?, updated_at = ? WHERE id = ?',
      )
      .run(
        input.name,
        '',
        input.summary,
        JSON.stringify(input.entries),
        new Date().toISOString(),
        id,
      );
    syncWikiTagsFromEntries(id, input.entries);
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

export function listWikiSites(
  query: string,
  tags: string[],
  options?: ListQueryOptions,
): WikiSiteSummary[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 200) {
    throw new HttpError(400, 'Der Suchtext ist zu lang.');
  }
  const fts = toFtsQuery(trimmedQuery);
  const selectedTags = uniqueLabelNames(tags);
  const where: string[] = [];
  const params: Array<string | number> = [];
  const limit = clampListLimit(options?.limit);

  if (fts) {
    params.push(fts);
  }
  for (const tagName of selectedTags) {
    where.push(
      `w.id IN (
        SELECT wt.wiki_site_id
        FROM wiki_tags wt
        JOIN tags t ON t.id = wt.tag_id
        WHERE t.name = ?
      )`,
    );
    params.push(tagName);
  }
  if (limit !== undefined) {
    params.push(limit);
  }

  const ftsJoin = fts
    ? 'INNER JOIN wiki_site_search ON wiki_site_search.rowid = w.id AND wiki_site_search MATCH ?'
    : '';
  const snippetSelect = fts
    ? ", snippet(wiki_site_search, -1, '', '', '…', 16) AS searchSnippet"
    : '';

  const sql = `
    SELECT
      w.id,
      w.name,
      w.summary,
      w.updated_at AS updatedAt,
      json_array_length(w.entries_json) AS entryCount
      ${snippetSelect}
    FROM wiki_sites w
    ${ftsJoin}
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY w.updated_at DESC, w.id DESC
    ${limit !== undefined ? 'LIMIT ?' : ''}
  `;

  let rows: Record<string, SQLOutputValue>[];
  try {
    rows = db()
      .prepare(sql)
      .all(...params);
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
      summary: text(row['summary']),
      tags: readWikiSiteTags(id),
      entryCount: num(row['entryCount']),
      updatedAt: text(row['updatedAt']),
      searchSnippet: fts && row['searchSnippet'] != null ? text(row['searchSnippet']) : null,
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

export function listIssues(
  query: string,
  tags: string[],
  options?: ListQueryOptions,
): IssueSummary[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 200) {
    throw new HttpError(400, 'Der Suchtext ist zu lang.');
  }
  const fts = toFtsQuery(trimmedQuery);
  const selectedTags = uniqueLabelNames(tags);
  const where: string[] = [];
  const params: Array<string | number> = [];
  const limit = clampListLimit(options?.limit);

  if (fts) {
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
  if (limit !== undefined) {
    params.push(limit);
  }

  const ftsJoin = fts
    ? 'INNER JOIN issue_search ON issue_search.rowid = i.id AND issue_search MATCH ?'
    : '';
  const snippetSelect = fts ? ", snippet(issue_search, -1, '', '', '…', 16) AS searchSnippet" : '';

  const sql = `
    SELECT
      i.id,
      i.title,
      i.summary,
      i.updated_at AS updatedAt,
      i.checkpoints_json AS checkpointsJson
      ${snippetSelect}
    FROM issues i
    ${ftsJoin}
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY i.updated_at DESC, i.id DESC
    ${limit !== undefined ? 'LIMIT ?' : ''}
  `;

  let rows: Record<string, SQLOutputValue>[];
  try {
    rows = db()
      .prepare(sql)
      .all(...params);
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
      tags: readIssueTags(id),
      checkpointCount: parseCheckpointsJson(text(row['checkpointsJson'])).length,
      updatedAt: text(row['updatedAt']),
      searchSnippet: fts && row['searchSnippet'] != null ? text(row['searchSnippet']) : null,
    };
  });
}

export function globalSearch(query: string, limit: number): GlobalSearchResult {
  const capped = clampListLimit(limit) ?? 8;
  return {
    issues: listIssues(query, [], { limit: capped }),
    wikiSites: listWikiSites(query, [], { limit: capped }),
  };
}

function clampListLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isInteger(limit) || limit < 1) return undefined;
  return Math.min(limit, MAX_LIST_LIMIT);
}

export function listTags(): string[] {
  return db()
    .prepare('SELECT name FROM tags ORDER BY name COLLATE NOCASE')
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

export function createTag(body: unknown): { name: string } {
  const name = parseLabelName(body, 'Bezeichnung');
  const connection = db();
  const existing = connection.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (existing) {
    throw new HttpError(409, 'Eine Bezeichnung mit diesem Namen existiert bereits.');
  }
  connection.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
  return { name };
}

export function deleteTag(body: unknown): void {
  const name = parseLabelName(body, 'Bezeichnung');
  transaction(() => {
    const connection = db();
    const tag = connection.prepare('SELECT id FROM tags WHERE name = ?').get(name);
    if (!tag) {
      throw new HttpError(404, 'Bezeichnung nicht gefunden.');
    }
    const tagId = num(tag['id']);
    const issueIds = connection
      .prepare('SELECT issue_id FROM issue_tags WHERE tag_id = ?')
      .all(tagId)
      .map((row) => num(row['issue_id']));
    const wikiSiteIds = connection
      .prepare('SELECT wiki_site_id FROM wiki_tags WHERE tag_id = ?')
      .all(tagId)
      .map((row) => num(row['wiki_site_id']));
    connection.prepare('DELETE FROM tags WHERE id = ?').run(tagId);

    for (const issueId of issueIds) {
      rebuildSearch(issueId);
    }
    for (const wikiSiteId of wikiSiteIds) {
      const site = getWikiSite(wikiSiteId);
      if (!site) continue;
      const entries = site.entries.map((entry) => ({
        title: entry.title,
        locations: entry.locations,
        notes: entry.notes,
        tags: entry.tags.filter((t) => t.toLowerCase() !== name.toLowerCase()),
      }));
      connection
        .prepare('UPDATE wiki_sites SET entries_json = ? WHERE id = ?')
        .run(JSON.stringify(entries), wikiSiteId);
      syncWikiTagsFromEntries(wikiSiteId, entries);
      rebuildWikiSearch(wikiSiteId);
    }
  });
}

function ensureTags(names: string[]): void {
  const insert = db().prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  for (const name of names) {
    insert.run(name);
  }
}

/** Core program labels always available in Bezeichnungen / filter chips. */
function ensureDefaultProgramTags(): void {
  ensureTags(['EF3', 'BASIC', 'Crosslease']);
}

function seedIfEmpty(): void {
  const row = db().prepare('SELECT COUNT(*) AS count FROM issues').get();
  if (num(row?.['count']) > 0) return;

  ensureTags([
    'Teams',
    'tickets',
    'Skype',
    'EF3',
    'BASIC',
    'Crosslease',
    'documentation',
    'error codes',
  ]);

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

function seedWikiSitesIfEmpty(): void {
  const row = db().prepare('SELECT COUNT(*) AS count FROM wiki_sites').get();
  if (num(row?.['count']) > 0) return;

  ensureTags(['Teams', 'Microsoft', 'Skype', 'EF3', 'BASIC', 'Crosslease']);

  insertWikiSite(
    {
      name: 'Microsoft Teams docs',
      summary:
        'Official Teams troubleshooting and admin articles. Use it when the desktop client or meetings misbehave.',
      entries: [
        {
          title: 'Troubleshoot meetings',
          locations: [
            'https://learn.microsoft.com/en-us/microsoftteams/troubleshoot/meetings/troubleshoot-meetings',
          ],
          notes: 'Join failures, audio, and screen sharing on the desktop app.',
          tags: ['Teams', 'Microsoft', 'documentation'],
        },
        {
          title: 'Clear Teams cache',
          locations: [
            'https://learn.microsoft.com/en-us/microsoftteams/troubleshoot/teams-sign-in/sign-in-loop',
            '\\\\fileserver\\support\\teams\\cache-reset',
          ],
          notes: 'Sign-in loops, stale profiles, and the internal cache-reset guide on the share.',
          tags: ['Teams', 'documentation', 'error codes'],
        },
      ],
    },
    '2026-03-05T10:00:00.000Z',
  );

  insertWikiSite(
    {
      name: 'Skype support',
      summary: 'Legacy Skype client help for presence, sign-in, and profile issues.',
      entries: [
        {
          title: 'Skype help home',
          locations: [
            'https://support.microsoft.com/en-us/skype/skype-help',
            '\\\\fileserver\\support\\skype\\profile-reset',
          ],
          notes: 'Start here for sign-in and presence; profile reset steps on the file share.',
          tags: ['Skype', 'Microsoft', 'documentation'],
        },
      ],
    },
    '2026-04-20T09:15:00.000Z',
  );
}
