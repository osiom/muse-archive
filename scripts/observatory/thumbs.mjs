// Build-time globe-tile thumbnails.
//
// The globe draws each campaign photo into a ~512px circle, but the source JPEGs are 1–1.6 MB
// each AND the atlas waits for ALL of them before any appear — so full-res downloads made the
// globe slow to populate. We pre-generate a small square WebP next to each photo
// (<slug>/thumb/<name>.webp); the globe loads those (selection swaps the URL in buildItems),
// while the record pages keep the full-resolution originals untouched.
//
// Generated INTO public/ so they're served in dev and copied into dist on build. Cached: a thumb
// newer than its source is skipped. Never fatal — a missing thumb just means the globe falls back
// to a plain muse-colour disc (tile-atlas loadImage resolves null on a 404).

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const THUMB_PX = 512;        // matches the atlas CELL; the on-screen disc is far smaller still
const THUMB_QUALITY = 78;

/**
 * @param {object[]} idx Parsed campaign index (from campaignsJson) — photos are root-absolute
 *                       /assets/images/<slug>/<file>.
 * @param {string} publicDir Absolute path to the project's public/ directory.
 * @returns {Promise<number>} How many thumbnails were (re)generated.
 */
export async function generateThumbs(idx, publicDir) {
  let made = 0;
  for (const c of Array.isArray(idx) ? idx : []) {
    // every photo that COULD become a globe leaf (the session-shuffled order means any of them
    // might) — hero + gallery. Cheap + cached, so over-covering is fine.
    const photos = [c.hero, ...(Array.isArray(c.images) ? c.images : [])].filter(Boolean);
    for (const rel of photos) {
      const src = path.join(publicDir, rel.replace(/^\//, ''));
      const name = path.basename(src).replace(/\.[^.]+$/, '');
      const out = path.join(path.dirname(src), 'thumb', `${name}.webp`);
      try {
        const [s, o] = await Promise.allSettled([fs.stat(src), fs.stat(out)]);
        if (s.status !== 'fulfilled') continue;                                   // source missing
        if (o.status === 'fulfilled' && o.value.mtimeMs >= s.value.mtimeMs) continue; // up to date
        await fs.mkdir(path.dirname(out), { recursive: true });
        await sharp(src)
          .resize(THUMB_PX, THUMB_PX, { fit: 'cover', position: 'centre' })
          .webp({ quality: THUMB_QUALITY })
          .toFile(out);
        made++;
      } catch { /* non-fatal — globe degrades to a plain disc */ }
    }
  }
  return made;
}
