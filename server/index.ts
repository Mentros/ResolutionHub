import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HttpError,
  createIssue,
  createTag,
  deleteIssue,
  deleteTag,
  getIssue,
  initDatabase,
  listIssues,
  listTags,
  updateIssue,
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
        reject(new HttpError(400, 'Request body must be JSON.'));
      }
    });
    req.on('error', reject);
  });
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method ?? 'GET';

  if (path === '/api/tags') {
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

  if (path === '/api/issues' && method === 'GET') {
    const tags = url.searchParams
      .getAll('tags')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    send(res, 200, listIssues(url.searchParams.get('q') ?? '', tags));
    return;
  }

  if (path === '/api/issues' && method === 'POST') {
    send(res, 201, createIssue(await readJson(req)));
    return;
  }

  const match = /^\/api\/issues\/(\d+)$/.exec(path);
  if (match) {
    const id = Number(match[1]);
    if (method === 'GET') {
      const issue = getIssue(id);
      if (!issue) throw new HttpError(404, 'Issue not found.');
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

  throw new HttpError(404, 'Not found.');
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
