# Project Logbook

Track the projects you're working on. Each one has a "where I'm up to" bookmark, a list of milestones, and a dated log of notes. Save a project's milestones as a template to start new projects from.

## Run locally

```bash
npm start
```

Then open http://localhost:3000. Requires Node 18 or newer. There are no dependencies.

## Settings

| Variable | What it does |
| --- | --- |
| `APP_PASSWORD` | When set, the browser asks for this password (any username) before showing the site. |
| `DATA_DIR` | Folder where `projects.json` is saved. Defaults to `./data`. |
| `PORT` | Port to listen on. Defaults to 3000. |

## Deploying on Railway

Attach a volume mounted at `/data` and set `DATA_DIR=/data` so your projects survive redeploys.
