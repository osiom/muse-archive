// Guardrail: reject committed image originals that are over the repo-weight cap.
//
// The originals under public/assets/images are only build INPUT (see shrink-originals.mjs)
// and must never re-bloat git. This checks the STAGED originals against the same cap the
// shrink script enforces, so a forgotten `node scripts/shrink-originals.mjs` fails loudly
// at commit time instead of silently adding multi-MB blobs to history forever.
//
//   node scripts/check-image-sizes.mjs           # check staged files (hook use)
//   node scripts/check-image-sizes.mjs --all      # check every tracked original
//
// Install as a pre-commit hook:  git config core.hooksPath scripts/hooks

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CAP_EDGE } from './shrink-originals.mjs';

// A generous absolute ceiling — a JPEG within CAP_EDGE at q85 lands well under this. It only
// catches a truly pathological file (uncompressed / near-lossless); the pixel cap is the real rule.
const HARD_BYTE_CEIL = 1500 * 1024;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// JPEG campaign photos only — same scope as shrink-originals.mjs (PNG logos/glyphs are exempt).
const ORIGINAL = /public\/assets\/images\/.*\.jpe?g$/i;
const isGenerated = (p) => /\/(web|thumb)\//.test(p);

function staged() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}
function tracked() {
  const out = execSync('git ls-files public/assets/images', { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

const files = (process.argv.includes('--all') ? tracked() : staged())
  .filter((f) => ORIGINAL.test(f) && !isGenerated(f));

const offenders = [];
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue; // deletion/rename target gone — nothing to check
  const size = fs.statSync(abs).size;
  const meta = await sharp(abs).metadata().catch(() => null);
  const longEdge = meta ? Math.max(meta.width || 0, meta.height || 0) : 0;
  if (size > HARD_BYTE_CEIL || longEdge > CAP_EDGE) {
    offenders.push({ rel, kb: (size / 1024).toFixed(0), px: longEdge });
  }
}

if (offenders.length) {
  console.error(`\n✗ ${offenders.length} image original(s) exceed the repo cap (${CAP_EDGE}px / ${(HARD_BYTE_CEIL / 1024).toFixed(0)} KB):`);
  for (const o of offenders) console.error(`    ${o.rel}  (${o.kb} KB, ${o.px}px)`);
  console.error(`\n  Run:  node scripts/shrink-originals.mjs   then re-stage.\n`);
  process.exit(1);
}
console.log(`✓ image originals within cap (${files.length} checked).`);
