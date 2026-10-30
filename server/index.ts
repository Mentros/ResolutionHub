import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HttpError,
  createIssue,
  createTag,
  createWikiSite,
  deleteIssue,
  deleteTag,
  deleteWikiSite,
  getIssue,
  getWikiSite,
  globalSearch,
  initDatabase,
  listIssues,
  listTagPrograms,
  listTags,
  listTagsDetailed,
  listWikiSites,
  updateIssue,
  updateWikiSite,
} from './db';

const port = Number(process.env['PORT'] ?? 3000);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dbPath = join(root, 'data', 'resolutionhub.sqlite');

initDatabase(dbPath);

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (res.headersSent || res.writableEnded) return;
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new HttpError(413, 'Request is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch {
        reject(new HttpError(400, 'Der Anfrageinhalt muss JSON sein.'));
      }
    });
    req.on('error', reject);
  });
}

function parseNameList(url: URL, ...keys: string[]): string[] {
  const values = keys.flatMap((key) => url.searchParams.getAll(key));
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method ?? 'GET';

  if (path === '/api/tags/programs' && method === 'GET') {
    send(res, 200, listTagPrograms());
    return;
  }

  if (path === '/api/tags/entries' && method === 'GET') {
    send(res, 200, listTagsDetailed());
    return;
  }

  if (path === '/api/tags' || path === '/api/programs') {
    if (method === 'GET') {
      send(res, 200, listTags());
      return;
    }
    if (method === 'POST') {
      send(res, 201, createTag(await readJson(req)));
      return;
    }
    if (method === 'DELETE') {
      deleteTag(await readJson(req));
      send(res, 204);
      return;
    }
  }

  if (path === '/api/wiki-topics') {
    if (method === 'GET') {
      send(res, 200, listTags());
      return;
    }
    if (method === 'POST') {
      send(res, 201, createTag(await readJson(req)));
      return;
    }
    if (method === 'DELETE') {
      deleteTag(await readJson(req));
      send(res, 204);
      return;
    }
  }

  if (path === '/api/search' && method === 'GET') {
    const q = url.searchParams.get('q') ?? '';
    const limitRaw = Number(url.searchParams.get('limit') ?? '8');
    const limit = Number.isFinite(limitRaw) ? limitRaw : 8;
    send(res, 200, globalSearch(q, limit));
    return;
  }

  if (path === '/api/issues' && method === 'GET') {
    const tags = parseNameList(url, 'tags', 'programs');
    send(res, 200, listIssues(url.searchParams.get('q') ?? '', tags));
    return;
  }

  if (path === '/api/issues' && method === 'POST') {
    send(res, 201, createIssue(await readJson(req)));
    return;
  }

  if (path === '/api/wiki-sites' && method === 'GET') {
    const tags = parseNameList(url, 'tags', 'programs', 'topics');
    send(res, 200, listWikiSites(url.searchParams.get('q') ?? '', tags));
    return;
  }

  if (path === '/api/wiki-sites' && method === 'POST') {
    send(res, 201, createWikiSite(await readJson(req)));
    return;
  }

  const wikiMatch = /^\/api\/wiki-sites\/(\d+)$/.exec(path);
  if (wikiMatch) {
    const id = Number(wikiMatch[1]);
    if (method === 'GET') {
      const site = getWikiSite(id);
      if (!site) throw new HttpError(404, 'Wiki nicht gefunden.');
      send(res, 200, site);
      return;
    }
    if (method === 'PUT') {
      send(res, 200, updateWikiSite(id, await readJson(req)));
      return;
    }
    if (method === 'DELETE') {
      deleteWikiSite(id);
      send(res, 204);
      return;
    }
  }

  const match = /^\/api\/issues\/(\d+)$/.exec(path);
  if (match) {
    const id = Number(match[1]);
    if (method === 'GET') {
      const issue = getIssue(id);
      if (!issue) throw new HttpError(404, 'Ticket nicht gefunden.');
      send(res, 200, issue);
      return;
    }
    if (method === 'PUT') {
      send(res, 200, updateIssue(id, await readJson(req)));
      return;
    }
    if (method === 'DELETE') {
      deleteIssue(id);
      send(res, 204);
      return;
    }
  }

  throw new HttpError(404, 'Nicht gefunden.');
}

const server = createServer((req, res) => {
  route(req, res).catch((error: unknown) => {
    if (error instanceof HttpError) {
      send(res, error.status, { error: error.message });
      return;
    }
    console.error(error);
    send(res, 500, { error: 'Something went wrong.' });
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Resolution Hub API listening on http://127.0.0.1:${port}`);
  console.log(`SQLite file: ${dbPath}`);
});
