// Vite plugin — Muse Observatory pipeline glue (Phase 1).
//
//   dev   : serve /campaigns.json + /<slug>/ from memory
//           (drafts included for preview); reload when content/ or record.css change.
//   build : emit dist/campaigns.json + dist/<slug>/index.html
//           (non-draft pages only — drafts stay unpublished).
//
// The markdown parser lives only here / in the build script — never in the client bundle.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateObservatory } from './scripts/observatory/build.mjs';
import { generateThumbs } from './scripts/observatory/thumbs.mjs';
import { generateWebVariants } from './scripts/observatory/variants.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(HERE, 'content/campaigns');
const RECORD_CSS = path.join(HERE, 'src/observatory/record.css');
const PUBLIC_DIR = path.join(HERE, 'public');

export default function observatory() {
  let outDir = path.join(HERE, 'dist');
  let isBuild = false;
  let base = '/';

  return {
    name: 'observatory',

    // Generate the small globe-tile thumbnails ONCE up front: in dev at server start, in build
    // before Vite copies public/ → dist/ (buildStart is the first hook). Non-fatal — the globe
    // degrades to plain discs if a thumb is missing.
    async buildStart() {
      try {
        const out = await generateObservatory({ includeDrafts: true, base });
        const idx = JSON.parse(out.campaignsJson);
        const thumbs = await generateThumbs(idx, PUBLIC_DIR);
        if (thumbs) console.log(`[observatory] generated ${thumbs} globe thumbnail(s)`);
        const variants = await generateWebVariants(idx, PUBLIC_DIR);
        if (variants) console.log(`[observatory] generated ${variants} web image variant(s)`);
      } catch (err) {
        console.warn('[observatory] image generation skipped:', err.message);
      }
    },

    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
      base = config.base; // '/' in dev, '/museobservatory/' on the Pages subpath build
    },

    // ── dev: serve generated artifacts + live-reload on content edits ────────
    configureServer(server) {
      server.watcher.add([CONTENT_DIR, RECORD_CSS]);
      const reload = (file) => {
        if (file.startsWith(CONTENT_DIR) || file === RECORD_CSS) {
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0];
        // Only campaigns.json or a /<slug>(/) path is ours. Anything Vite owns
        // (/, /src/…, /assets/…, /@vite/…, /node_modules/…) must pass through.
        const slugMatch = url.match(/^\/([^/]+)\/?(?:index\.html)?$/);
        const wantsJson = url === '/campaigns.json';
        if (!wantsJson && !slugMatch) return next();

        let out;
        try {
          out = await generateObservatory({ includeDrafts: true, base });
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end(`Observatory build error:\n${err.stack || err}`);
          return;
        }

        if (wantsJson) {
          res.setHeader('Content-Type', 'application/json');
          res.end(out.campaignsJson);
          return;
        }

        // /<slug>(/)(index.html) — only if it's a real campaign slug, else pass through.
        const page = slugMatch && out.pages.find((p) => p.slug === slugMatch[1]);
        if (page) {
          res.setHeader('Content-Type', 'text/html');
          res.end(page.html);
          return;
        }
        return next();
      });
    },

    // ── build: write artifacts into dist/ ───────────────────────────────────
    async closeBundle() {
      if (!isBuild) return; // dev server also fires this hook — skip there
      const out = await generateObservatory({ includeDrafts: false, base });
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(path.join(outDir, 'campaigns.json'), out.campaignsJson);
      for (const page of out.pages) {
        const dir = path.join(outDir, page.slug);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'index.html'), page.html);
      }
      const { total, pages, drafts, tileOnly } = out.summary;
      // eslint-disable-next-line no-console
      console.log(
        `\n[observatory] ${total} campaigns → ${pages} page(s) written, ` +
          `${drafts} draft(s) held back, ${tileOnly} tile-only.`,
      );

      // Strip shipped originals: Vite copies public/ wholesale into dist/, but the record pages now
      // reference the web/*.webp variants — so the multi-MB originals just bloat the deploy. Delete
      // each original from dist/ WHERE its web variant exists (keep it otherwise, so a missing
      // variant still ships a working image). Only touches photos in the index — muse glyphs, logos
      // and cocoex-text.png are never listed, so they're untouched. Originals stay in public/ + git.
      let stripped = 0;
      for (const c of JSON.parse(out.campaignsJson)) {
        const photos = [c.hero, ...(Array.isArray(c.images) ? c.images : [])].filter(Boolean);
        for (const rel of photos) {
          const distOrig = path.join(outDir, rel.replace(/^\//, ''));
          const name = path.basename(distOrig).replace(/\.[^.]+$/, '');
          const distVariant = path.join(path.dirname(distOrig), 'web', `${name}.webp`);
          try {
            await fs.access(distVariant);        // variant shipped → original is redundant
            await fs.rm(distOrig, { force: true });
            stripped++;
          } catch { /* no variant → keep the original so the page still renders */ }
        }
      }
      if (stripped) console.log(`[observatory] stripped ${stripped} shipped original(s) superseded by web variants.`);
    },
  };
}
