// One-shot: read an image on stdin, write a 2048px/q85 JPEG to stdout.
// Used by the git-filter-repo history rewrite to shrink oversized historical JPEG blobs.
// Standalone from shrink-originals.mjs because filter-repo feeds blob BYTES, not file paths.
//   cat big.jpg | node scripts/shrink-buffer.mjs > small.jpg
import sharp from 'sharp';

const CAP_EDGE = 2048;
const JPEG_QUALITY = 85;

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const input = Buffer.concat(chunks);
try {
  const out = await sharp(input)
    .rotate()
    .resize(CAP_EDGE, CAP_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  // Only emit the shrunk version if it's actually smaller; else pass the original through untouched.
  process.stdout.write(out.length < input.length ? out : input);
} catch {
  process.stdout.write(input); // unreadable/not-an-image → leave the blob as-is
}
