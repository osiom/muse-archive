// Build-time web-sized image variants.
//
// The record pages used to reference the ORIGINALS — raw ~4000px camera exports, 1–2 MB each.
// A single gallery (horizon001 has 18) pulled 15–25 MB of source photos, which made record pages
// heavy and slow. We pre-generate web-sized variants next to each photo (<slug>/web/<name>.webp
// and <name>.avif), long edge capped at 1600px; the record template's <picture> prefers AVIF and
// falls back to WebP. Originals stay on disk for archival (kept in git, stripped from the shipped
// dist WHERE a web/*.webp exists — see vite-plugin-observatory closeBundle).
//
// Same shape as thumbs.mjs: generated INTO public/ (served in dev, copied to dist on build),
// cached (a variant newer than its source is skipped), and never fatal — a missing variant just
// means the template falls back to the original (record-template web() helper).

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const MAX_EDGE = 1600;       // long-edge cap; sharp fit:inside keeps aspect, never enlarges
const WEB_QUALITY = 80;      // WebP quality (broad-support fallback)
const AVIF_QUALITY = 55;     // AVIF q55 ≈ WebP q80 visually but ~30% smaller; slower to encode
                             // (mtime cache below keeps it off the hot path for unchanged photos)

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
      const webDir = path.join(path.dirname(src), 'web');
      // WebP is the broad-support baseline; AVIF is the smaller modern format the <picture>
      // prefers. Both share one resize; each is mtime-cached independently so an existing WebP
      // doesn't block a first-time AVIF encode (and vice-versa).
      const outs = [
        { file: path.join(webDir, `${name}.webp`), fmt: 'webp', opts: { quality: WEB_QUALITY } },
        { file: path.join(webDir, `${name}.avif`), fmt: 'avif', opts: { quality: AVIF_QUALITY } },
      ];
      try {
        const s = await fs.stat(src).catch(() => null);
        if (!s) continue;                                                          // source missing
        let pipeline = null;
        for (const { file, fmt, opts } of outs) {
          const o = await fs.stat(file).catch(() => null);
          if (o && o.mtimeMs >= s.mtimeMs) continue;                               // up to date
          await fs.mkdir(webDir, { recursive: true });
          // Decode + resize once, reuse the pipeline clone per format. .rotate() bakes EXIF
          // orientation before resize — the shipped variant replaces the original, so the record
          // page has no EXIF to fall back on; must be upright here.
          pipeline ??= sharp(src)
            .rotate()
            .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true });
          await pipeline.clone()[fmt](opts).toFile(file);
          made++;
        }
      } catch { /* non-fatal — template falls back to the original */ }
    }
  }
  return made;
}
