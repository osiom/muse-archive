---
description: Scaffold a new campaign — auto-number it, interview for the fields, write the content/campaigns/TYPE+NNN.md file, and create its image folder. Inherits everything derivable; asks only for what it can't.
argument-hint: "[optional: stardust | horizon]"
---

# /create-new-event — scaffold a campaign the right way

Create one new campaign `.md` with a correct filename, valid frontmatter, and its image
folder — without the author having to remember the convention. **This writes content +
an asset folder only; never touches `src/` or the build.**

Read `docs/data-schema.md` and `content/campaigns/TEMPLATE.md` first if anything below is
unclear — they are the contract. The standing decisions D-1/D-2 (filename = identity,
URL = lowercased filename) and the per-campaign `public/assets/images/<slug>/` rule (D-4) govern this.

## Workflow

### 1. Pick the type
If `$ARGUMENTS` names a type (`stardust` or `horizon`), use it. Otherwise ask which it is.
Nothing else is positional — the rest comes from the interview.

### 2. Auto-number (inherit what we can)
The number is **derived, never asked**. Find the next free number for that type:

```bash
ls content/campaigns/ | grep -iE '^(STARDUST|HORIZON)[0-9]{3}\.md$'
```

Filter to the chosen type, take the highest `NNN`, add 1, zero-pad to 3 digits. If none
exist, start at `001`. The filename is then `TYPE+NNN.md` **uppercase** (e.g.
`STARDUST004.md`), and the slug/URL is its lowercase form (`stardust004` → `/stardust004/`).
Confirm the computed filename with the author before writing — a gap in numbering (e.g. a
deleted campaign) is worth a sanity check.

### 3. Interview — one batch, ask only the un-inheritable
Use **one** `AskUserQuestion` round (grouped), not field-by-field. Inherit/skip:

- **type / number / slug / url** — derived (steps 1–2), never ask.
- **cause / hex** — derived from `muse` via the MUSES map, never ask.

Ask for (offer the valid options as choices where the schema constrains them):
- **muse** — one of `lunes ares rabu thunor shukra dosei solis`, **or intentionally blank**
  (neutral tile, no cause filter — like HORIZON002). Offer "blank / undecided" as a choice.
- **status** — `ongoing | upcoming | closed`.
- **title**, **year**.
- **location** — ask for **one or more places**. Always write it as a YAML list, one
  entry per place, even for a single location. A multi-place event (festival across cities,
  a pilot in several countries like HORIZON002) gets one list entry per place; the build
  joins them with `" · "` for display. Don't pre-join them into one string.
- **the type-specific factual block** — Stardust: artist, partner, ngo, fundSplit,
  fundsRaised, transferred {amount,to,date}, event {name,date,location}. Horizon: host,
  partner, festival {name,date,location}, embeddedArtist, participants
  {total,community,embeddedArtists,nationalities}, question.
- **body** — the narrative. Either paste it, or leave a comment-only stub (→ tile-only, no
  record page). Remind: a body with `[confirm]` markers makes it a **draft** (previewable in
  dev, never published) — that is the intended way to stage unverified facts.

  **House style (match the existing events — every disc should read alike):**
  - **Open the first body section with an italic guiding *question*** on its own line, e.g.
    `*Can art fund the cause it speaks for?*`. This line becomes the disc / globe flip-card
    **teaser** (the build's `summarize()` takes the first sentence), so it must stand alone and
    end in `?`. Each event's question is distinct — don't reuse another campaign's.
  - **Keep the canonical section order** for the type and aim for a **one-pager (~250–350 words)** —
    tight, no overflood. Stardust: *The work · The event · The Comet · Impact* (+ optional *Images*).
    Horizon: *The question · The Future Lab · What the community proposed · The report ·
    What came after · Impact* (+ optional *Images*). Omit a section only if there's genuinely nothing for it.

Leave any field the author doesn't have **blank** — the record page renders only what's
present. Don't invent values.

### 4. Write the file
Start from `content/campaigns/TEMPLATE.md`, then:
- Drop the **other** type's factual block entirely (Stardust file → delete the Horizon
  block, and vice-versa).
- Fill the answered fields; leave the rest blank. **Never** write `type`, `number`, or
  `slug` into the frontmatter (filename owns them — the build warns if present).
- `hero`: a **bare filename** (e.g. `cover.jpg`) that will live in the campaign's folder, or
  blank for now. Never a path.
- Write to `content/campaigns/<FILENAME>` (uppercase). Don't overwrite if it exists — stop
  and tell the author.

### 5. Create the image folder
Make `public/assets/images/<slug>/` (lowercase slug) with a `.gitkeep` so it's committable empty:

```bash
mkdir -p public/assets/images/<slug> && touch public/assets/images/<slug>/.gitkeep
```

The folder lives under `public/` (Vite serves it at the domain root, so heroes resolve to
`/assets/images/<slug>/<file>` — decision D-4). Tell the author to drop images there named to
match `hero` / `images[]`. The build (in CI, on push) auto-generates the web-sized variants
(`web/<name>.avif` + `.webp`, long edge ≤1600px) and globe thumbnails (`thumb/…`); the record
pages reference those, and the committed originals are stripped from the shipped `dist/`.

**Shrink the originals before committing — `npm run shrink:images`.** Committed originals are
capped at **2048px / JPEG q85** so the git repo stays thin (they're only build input; the site
serves the smaller `web/` variants either way). A pre-commit guardrail
(`scripts/check-image-sizes.mjs`) **rejects any original over the cap**, so a raw 4000px camera
export won't commit — run `npm run shrink:images` (idempotent) after dropping photos, then stage.
Tell the author to run it; don't downscale by hand.

**Format matters too — commit `.jpg` (lowercase).** This repo's `sharp` build **cannot decode
HEIC**, so a `.HEIC` (or `.png`) original produces **no** web/thumb variant and the photo silently
fails to render. Convert first — on macOS: `sips -s format jpeg in.HEIC --out out.jpg` — and use
**lowercase** extensions (`.jpg`, not `.JPG`) to match the `images[]` list. Any source resolution
is fine (shrink handles the cap); just get it to JPG before wiring it into frontmatter.

### 6. Verify + report
Run the build to confirm the new file parses and validates:

```bash
npm run build
```

Report, one line each: the filename + slug + URL, whether a record page was emitted or it's
tile-only/draft, the image folder path, and **any `[observatory]` warnings** the new file
triggered (e.g. a hero with no image yet). Do **not** commit — leave that to the author.

## Guardrails
- Filename is uppercase `TYPE+NNN`; slug/URL is its lowercase form. Don't deviate.
- Never write derived fields (type/number/slug/cause/hex) into frontmatter.
- Never fabricate factual values; blank is correct when unknown.
- Content + asset folder only — never edit `src/`, `build.mjs`, or the docs here.
