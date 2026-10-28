# Resolution Hub

Local runbook for issues that already happened. **Issues are the only place you store how a problem was solved** — title, what happened, program tags, and ordered checkpoints (instructions, optional link to external documentation, optional share path).

The **Wikis** section is a **documentation catalog**: grouped entries describe what information you need, each with one or more **fundorte** (https links or UNC paths to folders/files on file shares). It does not host files and is not linked from the issue editor; paste a URL or share path into a checkpoint when a resolution step should point there.

The Angular app talks to a small Node API. Data is stored in `data/resolutionhub.sqlite`.

### Search

Issue and wiki list search uses **SQLite FTS5** (`issue_search`, `wiki_site_search` in [`server/db.ts`](server/db.ts)): indexes are rebuilt when records change. Empty search still lists from the main tables.

### SQLite schema (lean)

Domain tables: `issues` (with `checkpoints_json`), `wiki_sites` (with `entries_json`), `tags`, `issue_tags`, `wiki_tags`, plus FTS virtual tables. Schema version is stored in `PRAGMA user_version` (4). Upgrading from older files migrates automatically on API start.

UI components come from [@mentros/crsd-ui](https://github.com/Mentros/CursedUiLibrary). This repo vendors a release tarball under `vendor/` so you only need `npm install` here — no sibling `CursedUiLibrary` checkout. To bump the UI kit, replace `vendor/mentros-crsd-ui-*.tgz` and the `file:` version in `package.json`, or install from [GitHub Packages](https://github.com/Mentros/CursedUiLibrary#consume-from-github-packages) instead of the vendored tarball.

## Run

Use two terminals:

```bash
npm run start:api
```

```bash
npm start
```

Open http://localhost:4200. The API listens on http://127.0.0.1:3000.

Requires Node.js 22.22 or newer. Node 24 and 26 work as well.
