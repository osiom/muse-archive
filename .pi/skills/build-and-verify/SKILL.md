---
name: build-and-verify
description: Build, test, shrink/check images, and preview the muse-archive static site before shipping to GitHub Pages. Use after changing campaigns, the selection layer, views, or build scripts, or when verifying what actually deploys.
---

# Build & verify muse-archive

Static site: markdown campaigns → compiled `campaigns.json` → globe/grid/record
views. No backend, no DB. Read `docs/architecture.md` and `docs/frontend.md` for the
4-layer model before touching view code.

## Commands
```bash
./dev.sh            # dev server (hot-reload)
./dev.sh preview    # production build + preview — "what actually ships"
npm test            # node --test (layers 1–3 are pure logic and testable)
npm run check:images   # verify image sizes
npm run shrink:images  # shrink originals
```

## Verify
- Layers 1–3 (data/index/selection) are device-independent — keep them tested.
- The globe is a **view over a bounded subset**, never the navigation; device-polish
  is intentionally frozen until layers 1–3 are solid.
- WebGL-globe checks use headless Chrome (SwiftShader) plus the `?`-gated dev hooks;
  Safari is eyeballed by Memo (no screencapture on this host).

## Ship
- Deploys to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`
  (static `dist/`, no backend — decision DEPLOY-1).
- **Do not commit or push unless asked.**

## Keep docs honest
After meaningful changes, run `/doc-minder` (or the `doc-minder` prompt) so `docs/`
doesn't rot. `docs/` is the current spec; `docs/archive/` is history, not spec.
