# Resolution Hub

Local runbook for issues that already happened. Each issue has tags, such as Teams or Skype, and ordered checkpoints: what to do, a wiki link, and a path to a share folder.

The Angular app talks to a small Node API. Issues are stored in `data/resolutionhub.sqlite`.

UI components come from [@mentros/crsd-ui](https://github.com/Mentros/CursedUiLibrary). Clone `CursedUiLibrary` next to this repo and run `npm install` here — `postinstall` builds the sibling library when needed and links `dist/ui`. After you change the library, run `npm run build` in `CursedUiLibrary` (or `npm install` here to rebuild when sources are newer than `dist`). Keep Angular versions aligned between the two projects so the compiled library matches the app.

## Run

```bash
npm start
```

Open http://localhost:4200. The API listens on http://127.0.0.1:3000.

Requires Node.js 22.22 or newer. Node 24 and 26 work as well.
