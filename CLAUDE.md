# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note:** the parent `~/CLAUDE.md` describes this project (as `late-response-44`) with
> Firebase anonymous auth, Firestore chunked template storage, docxtemplater/PizZip, and an
> "owner mode". **None of that exists here.** This repo is JSZip + FileSaver against a static
> template, with no backend and no auth. Trust this file over that one.

## What this is

A single-page tool for SCDF vehicle commanders. When an appliance cannot reach an incident
within 8 minutes, the commander must produce a PowerPoint justifying the delay. This app takes
the incident data plus evidence photos and fills a 3-slide PPTX template entirely in the
browser — no server, no upload, nothing leaves the machine.

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

There is **no test runner configured.** See "Testing without a test runner" below for how the
logic in this repo has actually been verified.

`npm run lint` is clean. Keep it that way — a new warning is easy to lose against a noisy
baseline, which is how a broken script sat in the repo unnoticed.

## Architecture

Three files carry the whole app:

- **`src/components/Form.jsx`** — all form state, all time arithmetic, all validation. The
  single source of truth for what the report says.
- **`src/utils/pptxGenerator.js`** — takes the processed data and the raw `File` objects,
  rewrites the template's XML, and triggers the download.
- **`src/components/FormInput.jsx`** — presentational input, supports a `readOnly` visual
  state for derived fields.

### How the PPTX is actually produced

The template is a real `.pptx` (a ZIP of XML) at `public/template.pptx`. Generation is string
surgery on that ZIP, not a document library:

1. Fetch `${import.meta.env.BASE_URL}template.pptx` — **not** an absolute `/template.pptx`,
   which 404s under a sub-path deploy. The response is checked for the `PK` zip magic bytes
   because hosts with SPA rewrites answer unknown paths with `index.html` and a 200.
2. For each `ppt/slides/slideN.xml`, replace `{{key}}` with the XML-escaped value for every
   key in the processed data.
3. Find picture frames by regex over `<p:pic>` blocks, keeping those wider than 1 inch, and
   map uploads onto them **positionally**.

`public/template.pptx` is the only copy of the template. `analyze_pptx.cjs` is a standalone
Node script for inspecting its picture frames; it appends to gitignored logs in the repo root.

### Template invariants worth knowing before touching image code

Verified against the current template — re-verify if the template is ever replaced:

- Exactly **10** picture frames match the `width > 1 inch` filter, in the order the
  `UPLOAD_SLOTS` array expects. The smallest real target is 1.57 in and the largest decoy icon
  is 0.36 in, so the threshold has margin — but nothing asserts the count, and a template
  resize that pushes a sequence image under 1 inch would silently shift every later upload
  into the wrong frame.
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

`findBlockingProblems()` **blocks** generation on things that are unambiguously wrong: a value
that was typed but cannot be parsed, and a half-filled pair that makes a calculation
impossible. Fields merely left blank are **not** blocking — a partial draft is legitimate —
and are instead listed in an amber warning after the download, alongside the count of missing
evidence images.

## Testing without a test runner

Logic here has been verified by **extracting the shipped functions from the source and running
them in Node**, rather than retyping them into a test — a Python snippet slices between known
anchors in `Form.jsx`, writes an `.mjs`, and runs assertions against it. This keeps the tests
honest about what actually ships. For `pptxGenerator.js`, the module is copied alongside a
stub `file-saver` and a `fetch` mock, then run against the real `public/template.pptx` and the
output ZIP inspected.

If you add a real test runner, that's an improvement — but until then, don't claim logic is
verified without having actually executed it this way.

## Deployment note

The app is served from a domain root today. `BASE_URL` handling means a sub-path build works
(`vite build --base=/LateResponse44/`), but `public/template.pptx` must be deployed alongside
the bundle.
