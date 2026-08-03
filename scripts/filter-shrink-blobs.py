# git-filter-repo blob callback: shrink oversized JPEG blobs throughout history.
#
# Blob callbacks receive blob DATA only (no path), so we identify JPEGs by magic bytes and
# only bother with blobs above a byte threshold — the small ones (already-shrunk photos, and
# anything that isn't a big camera export) pass through untouched. Each candidate is piped
# through scripts/shrink-buffer.mjs (sharp: 2048px / q85). This runs once, offline.
#
# Usage (from repo root, on a mirror or a repo you're OK rewriting):
#   git filter-repo --force --blob-callback "$(cat scripts/filter-shrink-blobs.py)"

import subprocess

# Only consider blobs bigger than this — a q85@2048 JPEG lands well under it, so already-shrunk
# originals and non-photo blobs are skipped. The current oversized historical copies are all >1 MB.
THRESHOLD = 900 * 1024
JPEG_MAGIC = b"\xff\xd8\xff"  # SOI marker — every JPEG starts with this

data = blob.data
if len(data) > THRESHOLD and data[:3] == JPEG_MAGIC:
    try:
        result = subprocess.run(
            ["node", "scripts/shrink-buffer.mjs"],
            input=data,
            stdout=subprocess.PIPE,
            check=True,
        )
        if result.stdout and len(result.stdout) < len(data):
            blob.data = result.stdout
    except Exception:
        pass  # leave the blob unchanged on any failure — never corrupt history
