# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note:** the parent `~/CLAUDE.md` describes this project (as `late-response-44`) with
> Firebase anonymous auth, Firestore chunked template storage, docxtemplater/PizZip, and an
> "owner mode". **None of that exists here.** This repo is JSZip + FileSaver against a static
> template, with no backend and no auth. Trust this file over that one.

## What this is

A single-page tool for SCDF vehicle commanders. When an appliance cannot reach an incident
within 8 minutes, the commander must produce a PowerPoint justifying the delay. This app takes
the incident data plus evidence photos and fills a PPTX template entirely in the browser — no
server, no upload.

**Network boundary.** There is still no backend. One thing crosses the network, and only when
the operator chooses it: the **text** pasted into "Fill from incident notes" is sent to
Google's Gemini API to be read, using an API key the operator supplies and which is kept in
their own browser's `localStorage`. Evidence images, the template, and PPTX generation remain
entirely local. Extraction is optional and the form is fully usable without it.

It produces **two documents**, chosen by a toggle on the form and defined by `REPORT_MODES` in
`pptxGenerator.js`:

- **Late Response** — all three template slides, the original behaviour.
- **Late Activation** — slide 2 alone: ACES-versus-actual activation, the ACES screenshot, and
  the remark. Slides 1 and 3 are about the response and are pruned from the package.

That framing drives most decisions here: **the output is an official document, so a wrong
number is worse than a missing one.** Several past bugs were of the shape "produce a
confident, plausible, wrong figure" — a blank Move Off silently yielding a 1-minute response
time, a midnight rollover producing `-1433 Min 00 Sec`. When a calculation cannot be made
honestly, leave the field blank or block generation; do not fall back to a default that reads
like a real measurement.

## Commands

```bash
npm install
npm run dev      # Vite dev server on :5173
npm run build    # production build to dist/
npm run lint     # eslint
```

```bash
npm test         # vitest, one-shot
npm run test:watch
```

`npm test` covers the shared domain logic and the extraction validator. See "Testing" below
for what is and is not covered.

`npm run lint` is clean. Keep it that way — a new warning is easy to lose against a noisy
baseline, which is how a broken script sat in the repo unnoticed.

## Architecture

- **`src/domain/time.js`** — clock/duration parsing, formatting, and the normalizers that turn
  loosely written note text into canonical values. Pure, dependency-free, unit-tested.
- **`src/domain/reportFields.js`** — which fields exist, which report type prints which, what
  type each holds, and which ones only the app may produce (`DERIVED_FIELDS`). The extraction
  allowlist is *derived* from this list rather than written out again.
- **`src/components/Form.jsx`** — form state and orchestration. Still the single source of
  truth for what the report says, but the time arithmetic now lives in `src/domain/`.
- **`src/utils/pptxGenerator.js`** — takes the processed data and the raw `File` objects,
  rewrites the template's XML, and triggers the download.
- **`src/components/FormInput.jsx`** — presentational input; supports a `readOnly` visual
  state for derived fields and a `fromNotes` provenance badge.
- **`src/features/extraction/`** — the Gemini note-extraction feature. See below.

### Note extraction

Optional, off unless the operator opens the panel and supplies a key. The safety rule for the
whole feature: **the model proposes, the human applies.**

- `apiKey.js` — key resolution, in priority order: a key pasted into the panel
  (`localStorage`), then `VITE_GEMINI_API_KEY` from `.env.local`. The env fallback is guarded
  by `import.meta.env.DEV`, which is replaced with a literal `false` at build time, so the
  branch is dead code in a production bundle and the key cannot ship. **This app deploys as
  static files — a key inlined into the bundle is a key published to every visitor.** If you
  change this file, re-verify with: put a sentinel in `.env.local`, `npm run build`, and grep
  `dist/` for it.
- `geminiClient.js` — one non-streaming `generateContent` call to a pinned model with a
  per-mode `responseSchema`. The schema's `field` enum is generated from
  `extractableFieldsFor(mode)`, so a derived field cannot even be named in a valid response.
  The key travels in the `x-goog-api-key` header, never the URL. The note goes in the user
  turn between delimiters, never in the system instruction.
- `validateProposals.js` — treats the response as untrusted. Five checks: shape, mode
  allowlist, **grounding** (the quoted evidence must appear literally in the submitted note,
  and the value must appear inside its own evidence), normalization through the same
  `src/domain/time.js` parsers manual entry uses, and conflict detection. Anything that fails
  is demoted to `rejected`/`conflicting` and shown but made non-selectable — the batch is
  never thrown away for one bad row.
- `ReviewPanel.jsx` — current → proposed, with evidence. Blanks pre-ticked; overwrites
  unticked and warned; values already matching the form marked "already in the form" and not
  offered, so an overwrite warning always means something.
- Applying only fills inputs. It never calls `handleSubmit` or `generatePPTX`, and the
  existing `findBlockingProblems` still runs on the merged data.

Adding a field to extraction means adding it to `FIELD_TYPE` in `reportFields.js` — nothing
else. Leaving it out of `FIELD_TYPE` is how a field stays manual.

### How the PPTX is actually produced

The template is a real `.pptx` (a ZIP of XML) at `public/template.pptx`. Generation is string
surgery on that ZIP, not a document library:

1. Fetch `${import.meta.env.BASE_URL}template.pptx` — **not** an absolute `/template.pptx`,
   which 404s under a sub-path deploy. The response is checked for the `PK` zip magic bytes
   because hosts with SPA rewrites answer unknown paths with `index.html` and a 200.
2. Prune the slides this report type does not use (`pruneSlides`), including each dropped
   slide's `.rels` and notes page, its `<Relationship>` in `ppt/_rels/presentation.xml.rels`,
   its `<p:sldId>` in `ppt/presentation.xml`, and every `<Override>` in `[Content_Types].xml`.
   A leftover part is harmless; a reference to a part that is gone makes PowerPoint call the
   file corrupt. Media is deliberately **not** pruned — layouts and the master share it.
3. For each surviving `ppt/slides/slideN.xml`, replace `{{key}}` with the XML-escaped value for
   every key in the processed data.
4. Find picture frames by regex over `<p:pic>` blocks, keeping those wider than 1 inch, and map
   uploads onto them **positionally within each slide** — `SLIDE_UPLOAD_SLOTS` is keyed by
   slide, so dropping a slide cannot shift the remaining uploads into the wrong frames.

`public/template.pptx` is the only copy of the template. `analyze_pptx.cjs` is a standalone
Node script for inspecting its picture frames; it appends to gitignored logs in the repo root.

### Template invariants worth knowing before touching image code

Verified against the current template — re-verify if the template is ever replaced:

- Exactly **10** picture frames match the `width > 1 inch` filter — 1 on slide 1, 1 on slide 2,
  8 on slide 3 — in the order `SLIDE_UPLOAD_SLOTS` expects. The smallest real target is 1.57 in
  and the largest decoy icon is 0.36 in, so the threshold has margin — but nothing asserts the
  count, and a template resize that pushes a sequence image under 1 inch would still shift every
  later upload *on that slide* into the wrong frame.
- `<p:pic>` document order is z-order, not visual position. Re-adding a picture in PowerPoint
  moves it to the end of the XML and silently reorders the slots.
- **Media parts are shared.** Slide 3's `rId3` is referenced by six `<p:pic>` elements. This is
  why uploads are written as *new* parts (`lr_upload_N.<ext>`) with only that one relationship
  repointed — overwriting a media file in place swaps every picture using it.
- Every template media part is `.png` and `[Content_Types].xml` declares only `image/png`.
  Writing JPEG bytes into a `.png` part yields a package whose declared type contradicts its
  bytes: PowerPoint often sniffs past it, Google Slides/LibreOffice/Keynote render a broken
  image. Uploads are sniffed by magic bytes, stored under a matching extension, and the
  content type is declared.
- Two slide-3 frames carry non-zero `<a:srcRect>` crops left over from the template's original
  photos. Those crops still apply to whatever image replaces them.

### Time handling

Two distinct kinds of value, easy to conflate:

- **Clock times** (`HH:mm[:ss]`) — Incident/Arrival/Move Off, SFTL red and green.
- **Durations** (`MM:SS`) — Activation, Actual Activation, Response Time. A bare number is
  rejected on purpose: `90` meant as 90 seconds would otherwise silently become 90 minutes.

Conventions that exist for a reason:

- Parsers return `null`, never `NaN`. Every downstream guard is a `!== null` check and `NaN`
  passes those, which is how `NaN Min NaN Sec` once reached a slide.
- Differences between clock times go through `elapsedBetween()`, which wraps over midnight.
  Night incidents are exactly when this tool gets used.
- Derived fields are derived, not editable. Time Exceeded is Response Time minus
  `LATE_THRESHOLD_SECONDS` and is rendered read-only.

### Validation split

`findBlockingProblems(data, mode)` only ever considers the fields the chosen report type
actually prints, so late response's pair rules — which is what used to make a late activation
report impossible to generate — do not apply to late activation.

Late activation adds one blocking rule of its own. Slide 2 carries fixed wording the form
cannot rewrite: *"According to ACES logs, `<appliance>` responded within 1 Min."* An Actual
Activation of 60 seconds or more makes the slide contradict its own table, so it is refused
rather than printed.

Otherwise it **blocks** generation on things that are unambiguously wrong: a value
that was typed but cannot be parsed, and a half-filled pair that makes a calculation
impossible. Fields merely left blank are **not** blocking — a partial draft is legitimate —
and are instead listed in an amber warning after the download, alongside the count of missing
evidence images.

## Testing

`npm test` runs Vitest over the two things that must not be wrong:

- `src/domain/time.test.js` — parsing and normalization, including the component ranges.
- `src/features/extraction/validateProposals.test.js` — the untrusted-input path: fabricated
  evidence, derived-field attempts, out-of-mode fields, conflicts, unparseable values.

These import the shipped modules directly. The old technique of slicing functions out of
`Form.jsx` with a Python snippet is gone along with the reason for it — that logic now lives
in importable `src/domain/` modules.

**Still not covered by an automated test:** `pptxGenerator.js` and the real template. The
invariants in the section above are verified by hand. For that, the established technique is
to copy the module alongside a stub `file-saver` and a `fetch` mock, run it against the real
`public/template.pptx`, and inspect the output ZIP. Don't claim the generator is verified
without having actually executed it that way.

## Deployment note

The app is served from a domain root today. `BASE_URL` handling means a sub-path build works
(`vite build --base=/LateResponse44/`), but `public/template.pptx` must be deployed alongside
the bundle.
