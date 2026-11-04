---
description: Edit an existing campaign — pick the campaign, show its current values, ask which parts to change (frontmatter fields, the type-specific factual block, or a body section), rewrite only those, then rebuild and report. Never renames, never touches src/.
argument-hint: "[optional: slug or filename, e.g. stardust002 or STARDUST002.md]"
---

# /update-an-event — edit an existing campaign safely

Update the content of a campaign that already exists in `content/campaigns/`. This is the
**edit** counterpart to `/create-new-event` (which scaffolds a *new* one). It shows the
current values, lets the author pick what to change, rewrites **only** those parts, and
rebuilds to confirm the file still parses. **Content only — never touches `src/`, the
build scripts, or the docs. Never renames the file.**

Read `docs/data-schema.md` and `content/campaigns/TEMPLATE.md` first if any field below is
unclear — they are the contract. The identity rules (D-1/D-2: filename owns type/number/slug)
and the derivation rules (muse → cause/hex) govern what may and may not be edited here.

## What this command may and may NOT change

| Editable here | How |
| --- | --- |
| **Shared frontmatter** — `title`, `muse`, `status`, `year`, `location` (list), `hero`, `heroFocus`, `images`, `globeExclude` | Rewrite the field. |
| **Stardust factual block** — `artist`, `partner`, `ngo`, `fundSplit`, `fundsRaised`, `transferred{amount,to,date}`, `event{name,date,location}` | Rewrite the field. |
| **Horizon factual block** — `host`, `partner`, `festival{name,date,location}`, `embeddedArtist`, `participants{total,community,embeddedArtists,nationalities}`, `question` | Rewrite the field. |
| **Body sections** — Stardust: *The work · The event · The Comet · Impact · Images*; Horizon: *The question · The Future Lab · What the community proposed · The artworks · The report · What came after · Impact · Images* | Rewrite / add / remove a section's prose. |
| **Draft state** — add/remove `[confirm]` markers or `draft: true` | Toggling the draft gate (see below). |

**Never edit here** (tell the author to do these another way):
- **`type` / `number` / `slug`** — owned by the *filename*. To change them, **rename the file**
  (that's `/create-new-event`-adjacent, not this command). Refuse and explain.
- **`cause` / `hex`** — derived from `muse` via the MUSES map. Change `muse`, not these; they
  must never appear in frontmatter.
- The **wrong type's factual block** — a Stardust file has no Horizon block and vice-versa.
  Don't add one; if the author wants to change type, that's a rename.

## Workflow

### 1. Resolve the target campaign
If `$ARGUMENTS` names a slug or filename, resolve it (case-insensitive; accept `stardust002`,
`STARDUST002`, or `STARDUST002.md`). Otherwise list the campaigns and ask which one:

```bash
ls content/campaigns/ | grep -iE '^(STARDUST|HORIZON)[0-9]{3}\.md$'
```

Read the resolved file in full. If it doesn't exist, stop and say so — this command **edits**,
it never creates (use `/create-new-event` for that). Note its **type** (from the filename) so
you only offer that type's factual block.

### 2. Show current values, then ask what to change — MENU-DRIVEN
**Don't** walk every field. First **echo the current state** compactly so the author sees what
exists: the frontmatter values, which factual-block fields are filled vs blank, and the list of
body section headers present. Then use **one** `AskUserQuestion` round (multi-select) offering
the *groups* to edit:

- **Frontmatter fields** (then a follow-up for which of: title / muse / status / year / location / hero / heroFocus / images / globeExclude).
- **Factual block** (the type-specific one — list its fields).
- **A body section** (offer the section headers present, plus "add a new section").
- **Draft state** (add or clear the `[confirm]`/`draft` gate).

For each group the author picks, ask a focused follow-up **pre-filled with the current value**
so they can confirm-or-replace rather than retype. Only prompt for what they selected.

Constrain choices where the schema does:
- **muse** — `lunes ares rabu thunor shukra dosei solis`, **or blank** (neutral tile). Offer blank.
- **status** — `ongoing | upcoming | closed`.
- **location** — always a **YAML list**, one entry per place, even for a single place. Never
  pre-join into one string (the build joins with `" · "` for display). If adding a place to a
  single-place campaign, keep it a list and append.
- **images / globeExclude** — **bare filenames** only (e.g. `2.jpg`), never paths. `globeExclude`
  entries must also appear in `images`. Files must be **`.jpg`, lowercase** — this repo's `sharp`
  can't decode HEIC, so a `.HEIC`/`.png` (or uppercase `.JPG`) yields no web/thumb variant and the
  photo silently fails. If the author dropped HEIC, convert first (`sips -s format jpeg in.HEIC --out out.jpg`)
  and lowercase the extension before adding it to the list. **After adding any new photo, run
  `npm run shrink:images`** — committed originals are capped at 2048px/q85 and a pre-commit guardrail
  (`scripts/check-image-sizes.mjs`) rejects anything larger, so a raw camera export won't commit
  until it's shrunk (the shipped site is unaffected — it serves the smaller `web/` variants).
- **hero** — a bare filename in the campaign's folder, or blank (→ placeholder tile). Never a path.

Leave anything the author doesn't touch **exactly as-is**. Never invent values; blank stays blank.

### 3. Apply the edits — surgically, preserve everything else
Prefer the **Edit** tool for each changed field/section (targeted string replacement) over
rewriting the whole file — this keeps untouched formatting, comments, and ordering intact.

- **Frontmatter:** change only the value(s) picked. **Never** introduce `type`, `number`,
  `slug`, `cause`, or `hex`. Keep `location` as a list. Keep the type's factual block; never
  add the other type's block.
- **Body:** replace the prose under the chosen `##` header, or add a new `##` section using the
  canonical section names for the type (see the table). Removing a section = delete its header
  and prose (the build renders only sections with content).
  - **House style (keep every event reading alike):** the **first body section opens with an
    italic guiding *question*** on its own line (e.g. `*Can a song rebuild a home?*`) — this
    becomes the disc / flip-card **teaser** (`summarize()` takes the first sentence), so it must
    stand alone and end in `?`, and stay **distinct** from other campaigns' questions. Preserve
    that opener when editing the first section; if the event lacks one, offer to add it. Aim for a
    **one-pager (~250–350 words)** in the canonical section order — tight, no overflood.
- **Consistency the author will forget** — when a change ripples, flag it and offer to fix it in
  the same pass: e.g. changing `title` may want the same wording in `event.name` or the H1 line;
  marking a Stardust event as past (`status: closed`) usually means `transferred`/`fundsRaised`
  should reflect the real figure rather than staying blank/"to date". Point these out; don't
  silently change fields the author didn't pick.

### 4. Draft gate (handle explicitly)
The draft gate is **stateless**: a record is a draft if it has `draft: true` **or** any
`[confirm]` / `[confirm: note]` marker in the body. Drafts are previewable in dev (with a
`noindex` banner) and **never shipped to `dist/`**.

- If the author's new copy is **confirmed/final**, ensure there are **no** leftover `[confirm]`
  markers and no `draft: true` — otherwise it silently stays unpublished.
- If they're staging **unverified** facts, add `[confirm]` (optionally `[confirm: what to check]`)
  or `draft: true` on purpose. Tell them which state the record will be in after your edit.

### 5. Verify + report
Rebuild to confirm the edited file still parses and validates:

```bash
npm run build
```

Report, one line each:
- the file edited (filename + slug + URL) and **which fields/sections changed** (old → new, brief);
- whether it still emits a **record page**, or is now **tile-only** / a **draft** (and why);
- **any `[observatory]` warnings** the file triggers (off-pattern name, redundant identity
  fields, unknown muse/status, missing hero image, bare-string location, missing title, dup slug);
- any **consistency ripples** you flagged and whether they were applied.

Do **not** commit — leave that to the author (standing rule: commit only when asked).

## Guardrails
- **Edit-only.** The file must already exist; never create one here.
- **Never rename** the file, and never write `type` / `number` / `slug` / `cause` / `hex` into frontmatter.
- **Never fabricate** values; untouched fields stay byte-for-byte as they were.
- `location` stays a list; `hero` / `images` / `globeExclude` stay bare filenames.
- Content + factual block + body only — never edit `src/`, `scripts/`, `build.mjs`, or the docs.
- Confirm the resulting **draft vs published** state out loud so nothing goes live (or stays hidden) by accident.
