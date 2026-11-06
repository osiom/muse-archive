# muse-archive — agent context

_Shared rules (Pi + Hermes): `../AGENTS.md` (gh/). Read it if it isn't in your context._

cocoex's public **campaign archive**: markdown campaigns → a JSON index + static record
pages, shown through a WebGL globe (the "wow" view) and a grid/list (find/scan). No
backend, no database, no auth. Deploys to GitHub Pages (`vithana7.github.io/museobservatory/`)
via `.github/workflows/deploy.yml` on push to `main`.

## Always-on constraints
- **4 layers:** data (markdown frontmatter) → index (`campaigns.json`, single source of
  truth) → selection (session-random sample + filters) → views (globe, grid, records).
  Layers 1–3 are pure data/logic; the globe is a view fed a bounded subset, never the navigation.
- **Foundation before art:** schema → selection → wire views → polish (A-3). Globe
  device-polish is frozen until layers 1–3 are solid (G-D).
- **Markdown is the source of truth.** No server/DB; if file editing becomes the bottleneck,
  add a git-CMS (Decap/Tina), not Strapi (B-1).
- Vanilla JS only (no frameworks). `gray-matter`/`marked`/`sharp` are build-time only.
- Don't commit unless asked. Working branch: `main`.
- Verify empirically: headless Chrome (SwiftShader) + the `?`-gated dev hooks; Safari is
  eyeballed by Memo (no screencapture on this host).

## Where to look (read on demand)
- `docs/architecture.md` — 4-layer model, data flow. Start here.
- `docs/data-schema.md` — frontmatter + `campaigns.json` contracts + structured geo.
- `docs/frontend.md` — globe + grid views, selection layer, securing plan.
- `docs/decisions.md` — locked decisions with *why*; `docs/questions.md` — open questions.
- `docs/archive/` — history + issue tracker. Not current spec.

## Workflows
- Add a campaign → `/create-new-event` (`.pi/prompts/create-new-event.md`). Edit one →
  `/update-an-event` (`.pi/prompts/update-an-event.md`).
- Docs drift (after meaningful changes) → `/doc-minder` (`.pi/prompts/doc-minder.md`).
- Build/verify/ship checks → `build-and-verify` skill (`.pi/skills/build-and-verify/SKILL.md`).

## Conventions
- `./dev.sh` (dev, hot-reload); `./dev.sh preview` (production build — what ships).
- Stack: vanilla JS · WebGL2 + `gl-matrix` · Vite.
