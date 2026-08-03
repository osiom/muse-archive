// Shrink committed image ORIGINALS in place, so the git repo stays thin.
//
// The originals under public/assets/images/<slug>/ are only ever the BUILD INPUT for the
// web/ variants (AVIF/WebP, long edge ≤1600 — see variants.mjs) and the thumb/ crops
// (512px — thumbs.mjs). They never ship (stripped from dist/). So there is no reason to
// carry multi-MB camera exports in git: a 2048px long-edge JPEG is comfortably above the
// 1600px the build consumes, yet a fraction of the bytes.
//
// This recompresses each original to CAP_EDGE long-edge, JPEG q85, EXIF orientation baked
// in (.rotate()) and other metadata stripped. Idempotent: an original already within the
// cap AND under the byte budget is skipped, so re-runs are cheap and safe.
//
//   node scripts/shrink-originals.mjs           # shrink in place
//   node scripts/shrink-originals.mjs --dry-run # report only, touch nothing
//
// Run it after dropping new photos, before committing. The commit guardrail
// (scripts/check-image-sizes.mjs) rejects anything that skipped this.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const IMAGES_DIR = path.join(ROOT, 'public/assets/images');

export const CAP_EDGE = 2048;        // long-edge cap for committed originals (> the 1600 build cap)
export const JPEG_QUALITY = 85;      // visually lossless enough for an archival build input
// A file already within CAP_EDGE is left alone UNLESS it's still pathologically large (needs a
// re-encode). Kept above what q85@2048 produces (~150–800 KB) so the script is STABLE — repeated
// runs don't re-encode (and slowly degrade) files that are already at the cap.
export const REENCODE_IF_OVER = 1500 * 1024;

const GENERATED = new Set(['web', 'thumb']); // never touch generated variants
// JPEG campaign photos only — the ~74 MB of bloat. PNGs here are logos / muse glyphs / the
// wordmark (~1.2 MB total, UI chrome that ships): downscaling would soften them for no real
// weight win, so they're deliberately left alone. HEIC isn't decodable — convert before committing.
const ORIGINAL_EXT = /\.jpe?g$/i;

// Every original file path under public/assets/images, skipping web/ and thumb/.
async function* walkOriginals(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (GENERATED.has(e.name)) continue;
      yield* walkOriginals(path.join(dir, e.name));
    } else if (ORIGINAL_EXT.test(e.name)) {
      yield path.join(dir, e.name);
    }
  }
}

const TMP_SUFFIX = '.tmp-shrink';

async function shrink({ dryRun = false } = {}) {
  let scanned = 0, changed = 0, before = 0, after = 0;
  for await (const file of walkOriginals(IMAGES_DIR)) {
    // Sweep any temp left by an interrupted prior run before we start (never let one leak into git).
    await fs.unlink(`${file}${TMP_SUFFIX}`).catch(() => {});
    scanned++;
    const stat = await fs.stat(file);
    const meta = await sharp(file).metadata().catch(() => null);
    if (!meta) { console.warn(`  ! unreadable, skipped: ${path.relative(ROOT, file)}`); continue; }
    // EXIF orientation can swap width/height; normalize to the visual long edge.
    const swapped = meta.orientation && meta.orientation >= 5;
    const longEdge = Math.max(swapped ? meta.height : meta.width, swapped ? meta.width : meta.height);
    const withinEdge = longEdge <= CAP_EDGE;
    if (withinEdge && stat.size <= REENCODE_IF_OVER) continue; // already thin — idempotent skip

    before += stat.size;
    if (dryRun) {
      console.log(`  would shrink ${path.relative(ROOT, file)} (${(stat.size / 1024).toFixed(0)} KB, ${longEdge}px)`);
      changed++;
      continue;
    }
    // Re-encode to a temp file, then atomically replace — never leave a half-written original.
    const tmp = `${file}${TMP_SUFFIX}`;
    await sharp(file)
      .rotate()  // bake EXIF orientation so downstream (.rotate() in variants) is a no-op, not a double-rotate
      .resize(CAP_EDGE, CAP_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(tmp);
    const newStat = await fs.stat(tmp);
    // Guard: if re-encoding somehow grew the file (already-optimal small image), discard the temp.
    if (newStat.size >= stat.size) {
      await fs.unlink(tmp);
      after += stat.size;
      continue;
    }
    await fs.rename(tmp, file);
    after += newStat.size;
    changed++;
    console.log(`  ${path.relative(ROOT, file)}  ${(stat.size / 1024).toFixed(0)} → ${(newStat.size / 1024).toFixed(0)} KB`);
  }
  const mb = (b) => (b / 1024 / 1024).toFixed(1);
  console.log(
    dryRun
      ? `\n[shrink] dry-run: ${changed}/${scanned} originals over cap (${mb(before)} MB affected).`
      : `\n[shrink] ${changed}/${scanned} originals shrunk: ${mb(before)} → ${mb(after)} MB.`,
  );
  return { scanned, changed };
}

const dryRun = process.argv.includes('--dry-run');
shrink({ dryRun }).catch((err) => { console.error(err); process.exit(1); });
