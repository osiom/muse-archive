// Build-time web-sized image variants.
//
// The record pages used to reference the ORIGINALS — raw ~4000px camera exports, 1–2 MB each.
// A single gallery (horizon001 has 18) pulled 15–25 MB of source photos, which made record pages
// heavy and slow. We pre-generate a web-sized WebP next to each photo (<slug>/web/<name>.webp),
// long edge capped at 1600px; the record template references THOSE. Originals stay on disk for
// archival (kept in git, stripped from the shipped dist — see vite-plugin-observatory closeBundle).
//
// Same shape as thumbs.mjs: generated INTO public/ (served in dev, copied to dist on build),
// cached (a variant newer than its source is skipped), and never fatal — a missing variant just
// means the template falls back to the original (record-template web() helper).

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const MAX_EDGE = 1600;       // long-edge cap; sharp fit:inside keeps aspect, never enlarges
const WEB_QUALITY = 80;

/**
 * @param {object[]} idx Parsed campaign index (from campaignsJson) — photos are root-absolute
 *                       /assets/images/<slug>/<file>.
 * @param {string} publicDir Absolute path to the project's public/ directory.
 * @returns {Promise<number>} How many variants were (re)generated.
 */
export async function generateWebVariants(idx, publicDir) {
  let made = 0;
  for (const c of Array.isArray(idx) ? idx : []) {
    // hero + gallery — the photos a record page actually renders at full size.
    const photos = [c.hero, ...(Array.isArray(c.images) ? c.images : [])].filter(Boolean);
    for (const rel of photos) {
      const src = path.join(publicDir, rel.replace(/^\//, ''));
      const name = path.basename(src).replace(/\.[^.]+$/, '');
      const out = path.join(path.dirname(src), 'web', `${name}.webp`);
      try {
        const [s, o] = await Promise.allSettled([fs.stat(src), fs.stat(out)]);
        if (s.status !== 'fulfilled') continue;                                    // source missing
        if (o.status === 'fulfilled' && o.value.mtimeMs >= s.value.mtimeMs) continue; // up to date
        await fs.mkdir(path.dirname(out), { recursive: true });
        await sharp(src)
          .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: WEB_QUALITY })
          .toFile(out);
        made++;
      } catch { /* non-fatal — template falls back to the original */ }
    }
  }
  return made;
}
