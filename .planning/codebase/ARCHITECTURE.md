<!-- refreshed: 2026-09-09 -->
# Architecture

**Analysis Date:** 2026-09-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                Browser-hosted React single page             │
├─────────────────┬─────────────────┬─────────────────────────┐
│ Application shell │ Form/controller │ Presentational input    │
│ `src/App.jsx`     │ `src/components/ │ `src/components/       │
│                   │ Form.jsx`         │ FormInput.jsx`         │
└────────┬────────┴────────┬────────┴───────────┬────────────┘
         │                  │                    │
         │                  ▼                    │
         │      ┌─────────────────────────────────┐         │
         │      │ Validation and calculations     │         │
         │      │ local helpers in `Form.jsx`     │         │
         │      └──────────────┬──────────────────┘         │
         │                     │                            │
         │                     ▼                            │
         │      ┌─────────────────────────────────┐         │
         │      │ PPTX package transformation     │◄────────┘
         │      │ `src/utils/pptxGenerator.js`   │  File objects
         │      └──────────────┬──────────────────┘
         │                     │
         │            fetch   │  JSZip load/write/generate
         │                     ▼
         │      ┌─────────────────────────────────┐
         └─────►│ Static template / output Blob │
                │ `public/template.pptx`        │
                │ FileSaver browser download    │
                └─────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Browser bootstrap | Mounts the React tree in strict mode and loads global CSS. | `src/main.jsx` |
| Application shell | Supplies the page title and hosts the report form. | `src/App.jsx` |
| Form/controller | Owns report mode, text values, uploaded `File` objects, validation, derived timing values, generation status, and orchestration. | `src/components/Form.jsx` |
| Form input | Renders controlled text/time/date fields and the read-only visual treatment for derived values. | `src/components/FormInput.jsx` |
| Report-mode contract | Defines retained slides, download prefixes, and positional evidence-image slots through `REPORT_MODES`, `SLIDE_UPLOAD_SLOTS`, `uploadSlotsFor`, and `ALL_UPLOAD_SLOTS`. | `src/utils/pptxGenerator.js` |
| PPTX transformer | Fetches, validates, unzips, prunes, edits, repackages, and downloads the template in `generatePPTX`. | `src/utils/pptxGenerator.js` |
| Static document model | Supplies the three-slide Open XML package, text placeholders, image relationships, layouts, notes, and media. | `public/template.pptx` |
| Template inspector | Examines picture shapes in the live template and appends diagnostic logs; it is not part of the browser bundle. | `analyze_pptx.cjs` |

## Pattern Overview

**Overall:** Client-only, template-driven document generator with a stateful form controller and an imperative Open XML transformation pipeline.

**Key Characteristics:**
- Keep all incident data and uploads in browser memory; no persistence, authentication, API client, server route, database, or telemetry layer is present in `src/` or `package.json`.
- Treat `src/components/Form.jsx` as the application/domain controller: UI visibility, validation, parsing, calculations, warnings, and generator invocation are co-located.
- Treat `public/template.pptx` as both a static asset and an implicit schema. Placeholder names, slide part names, relationship IDs, picture order, and frame sizes must remain compatible with `src/utils/pptxGenerator.js`.
- Transform the PPTX as a ZIP of XML parts. The application does not use a PowerPoint object-model library.
- Select output shape by report mode: `late_response` retains slides 1–3; `late_activation` retains slide 2 only.

## Layers

**Bootstrap and Page Shell:**
- Purpose: Start React and establish the single-page container.
- Location: `index.html`, `src/main.jsx`, `src/App.jsx`, `src/index.css`
- Contains: Root DOM element, module entry, React mount, page heading, shared CSS variables and utility classes.
- Depends on: React, React DOM, browser DOM.
- Used by: The Vite development server and production bundle.

**Presentation Components:**
- Purpose: Render mode-dependent inputs, uploads, status messages, and the download action.
- Location: `src/components/Form.jsx`, `src/components/FormInput.jsx`
- Contains: Controlled form elements and inline layout/state styling.
- Depends on: React state and the report-mode exports in `src/utils/pptxGenerator.js`.
- Used by: `src/App.jsx`.

**Domain Processing:**
- Purpose: Enforce report-specific correctness and derive official timing fields before document generation.
- Location: Local constants and functions in `src/components/Form.jsx`
- Contains: `TIME_FIELDS`, `DURATION_FIELDS`, `REPORT_FIELDS`, `MODE_FIELDS`, `LATE_THRESHOLD_SECONDS`, `parseTimeToSeconds`, `parseDurationToSeconds`, `elapsedBetween`, `formatSecondsToVerbose`, `findBlockingProblems`, and the processing block in `handleSubmit`.
- Depends on: Raw `formData`, selected `mode`, and the policy threshold of 480 seconds.
- Used by: `handleSubmit` and the read-only `timeExceededPreview`.

**Document Transformation:**
- Purpose: Turn processed text and uploaded images into a valid mode-specific `.pptx` download.
- Location: `src/utils/pptxGenerator.js`
- Contains: Mode/slot contracts, picture-frame discovery, slide pruning, image magic-byte detection, relationship rewriting, XML escaping/replacement, ZIP generation, and download naming.
- Depends on: JSZip, FileSaver, browser `fetch`, `File.arrayBuffer`, `Blob`, `import.meta.env.BASE_URL`, and `public/template.pptx`.
- Used by: `handleSubmit` in `src/components/Form.jsx`.

**Static Template:**
- Purpose: Supply all layouts, fixed wording, placeholders, notes pages, media, and presentation relationships.
- Location: `public/template.pptx`
- Contains: Three `ppt/slides/slideN.xml` parts and their relationships/notes, plus shared media and package content types.
- Depends on: Deployment copying Vite `public/` assets to the output root/base path.
- Used by: `generatePPTX` in `src/utils/pptxGenerator.js` and `analyze_pptx.cjs`.

## Data Flow

### Primary Request Path

1. Vite serves `index.html`; `src/main.jsx:6` mounts `App`, which renders `Form` from `src/components/Form.jsx`.
2. `Form` initializes three independent state domains: `formData` (`src/components/Form.jsx:99`), `images` keyed by `ALL_UPLOAD_SLOTS` (`src/components/Form.jsx:135`), and `mode` (`src/components/Form.jsx:139`). Mode changes hide irrelevant inputs without discarding state.
3. Controlled `FormInput` values call `handleChange` (`src/components/Form.jsx:144`); file inputs call `handleImageChange` and retain the first browser `File` under its semantic slot key (`src/components/Form.jsx:150`).
4. `timeExceededPreview` recomputes a display-only value from `response_time` and `LATE_THRESHOLD_SECONDS`; `FormInput` renders it read-only (`src/components/Form.jsx:284`, `src/components/Form.jsx:492`, `src/components/FormInput.jsx:26`).
5. Form submission enters `handleSubmit` (`src/components/Form.jsx:293`) and calls `findBlockingProblems`. Validation is filtered through `MODE_FIELDS`, rejects non-parseable printed time/duration values, rejects half-filled calculation pairs for late response, and rejects late-activation actual activation of 60 seconds or more (`src/components/Form.jsx:229`).
6. `handleSubmit` clones rather than mutates React state, adds the slide-2 compatibility alias `incident_no`, normalizes clock values to `HH:mm:ss`, and parses clock times separately from `MM:SS` durations (`src/components/Form.jsx:305`).
7. Derived values are calculated only when every input exists and parses: real response uses midnight-safe `elapsedBetween(moveOff, arrival)`, actual response adds activation and real response, time exceeded subtracts 480 seconds, and each SFTL duration uses midnight-safe red-to-green elapsed time (`src/components/Form.jsx:335`).
8. `handleSubmit` calls `generatePPTX(processedData, images, mode)` (`src/components/Form.jsx:383`). Errors are caught into UI status; success is followed by mode-filtered missing-field and missing-image warnings (`src/components/Form.jsx:386`).
9. `generatePPTX` resolves `${import.meta.env.BASE_URL}template.pptx`, verifies HTTP success and ZIP `PK` magic bytes, and opens the bytes with JSZip (`src/utils/pptxGenerator.js:189`).
10. Required retained slides are asserted and `pruneSlides` removes excluded slide XML, slide relationships, owned notes parts, presentation relationships/IDs, and content-type overrides (`src/utils/pptxGenerator.js:97`, `src/utils/pptxGenerator.js:212`). Media remains because layout/master parts can share it.
11. For every retained slide, each `{{key}}` occurrence is replaced with XML-escaped processed data (`src/utils/pptxGenerator.js:219`). The live template uses `incident_number` on slide 1 and `incident_no` on slides 2–3, which is why `handleSubmit` creates the alias.
12. For each retained slide, `findPictureFrames` scans `<p:pic>` blocks in document order and retains frames wider than one inch. Each frame is paired positionally with that slide's `SLIDE_UPLOAD_SLOTS` entry (`src/utils/pptxGenerator.js:74`, `src/utils/pptxGenerator.js:246`).
13. Each present upload is read via `File.arrayBuffer`, identified from magic bytes, rejected if unsupported/HEIC/WebP, and stored as a new `ppt/media/lr_upload_<slot>.<ext>` part. Only the frame's relationship target is repointed, preventing shared template media from changing multiple pictures (`src/utils/pptxGenerator.js:264`).
14. Newly introduced file extensions receive `[Content_Types].xml` defaults, JSZip generates a browser `Blob`, and FileSaver downloads `<mode prefix>_<incident_no or Draft>.pptx` (`src/utils/pptxGenerator.js:293`, `src/utils/pptxGenerator.js:307`).

### Late Activation Flow

1. Selecting `late_activation` makes `isLateResponse` false and `uploadSlotsFor` return only the ACES slot (`src/components/Form.jsx:290`, `src/utils/pptxGenerator.js:61`).
2. The UI prints only incident number, activation values, ACES evidence, and appliance data; hidden late-response state remains intact (`src/components/Form.jsx:447`).
3. Validation considers only `LATE_ACTIVATION_FIELDS` and the fixed slide-2 "within 1 Min" constraint (`src/components/Form.jsx:65`, `src/components/Form.jsx:251`).
4. `REPORT_MODES.late_activation` retains `ppt/slides/slide2.xml`; `pruneSlides` removes slides 1 and 3 plus their package references (`src/utils/pptxGenerator.js:54`).
5. The file downloads with the `Late_Activation` prefix; post-download warnings consider only the four printed fields and ACES image (`src/components/Form.jsx:386`).

**State Management:**
- Use local React `useState` only. `formData`, `images`, `mode`, `isLoading`, and `status` live in the `Form` component (`src/components/Form.jsx`).
- No context provider, reducer, state library, URL state, local/session storage, backend persistence, or page-refresh recovery exists.
- Preserve values across report-mode switches by hiding irrelevant controls instead of deleting their keys.

## Key Abstractions

**Report Mode:**
- Purpose: Couples a user-visible report name to retained slide parts and download filename prefix.
- Examples: `REPORT_MODES.late_response`, `REPORT_MODES.late_activation` in `src/utils/pptxGenerator.js`.
- Pattern: Configuration object shared by rendering and generation.

**Upload Slot:**
- Purpose: Couples an evidence-image state key and label to a specific slide's positional picture frame.
- Examples: `SLIDE_UPLOAD_SLOTS`, `uploadSlotsFor`, `ALL_UPLOAD_SLOTS` in `src/utils/pptxGenerator.js`.
- Pattern: Per-slide ordered mapping; preserve order because `<p:pic>` document order is the binding contract.

**Processed Report Data:**
- Purpose: Separates editable raw state from formatted/calculated placeholder values passed to the generator.
- Examples: `processedData` in `src/components/Form.jsx:305`.
- Pattern: Shallow clone followed by normalization and derived-field assignment.

**Open XML Part:**
- Purpose: Address a PPTX-internal file by its package path.
- Examples: `SLIDE_1`, `SLIDE_2`, `SLIDE_3`, `relsPathFor`, and `[Content_Types].xml` in `src/utils/pptxGenerator.js`.
- Pattern: Direct ZIP part reads/writes and targeted string/regex transformations.

## Entry Points

**HTML Entry:**
- Location: `index.html`
- Triggers: Browser navigation through Vite dev/preview or a static host.
- Responsibilities: Defines `#root` and loads `/src/main.jsx` during Vite processing.

**React Entry:**
- Location: `src/main.jsx`
- Triggers: ES module load from `index.html`.
- Responsibilities: Loads global CSS and mounts `App` in `StrictMode`.

**User Workflow Entry:**
- Location: `src/components/Form.jsx`
- Triggers: Form rendering, input events, mode-button clicks, file selections, and submit.
- Responsibilities: Own all workflow state and correctness gates.

**Document Generation Entry:**
- Location: `generatePPTX` in `src/utils/pptxGenerator.js`
- Triggers: A validation-clean form submission.
- Responsibilities: Produce and download the presentation or throw a user-displayable error.

**Developer Template Inspection Entry:**
- Location: `analyze_pptx.cjs`
- Triggers: Manual `node analyze_pptx.cjs` execution from the repository root.
- Responsibilities: Read `public/template.pptx` and append shape-size diagnostics to gitignored `slide3_log.txt` and `large_images_log.txt`.

## Architectural Constraints

- **Threading:** The browser event loop performs validation and XML work; asynchronous `fetch`, `File.arrayBuffer`, and JSZip promises yield, but no Web Worker isolates ZIP processing from the UI thread (`src/components/Form.jsx`, `src/utils/pptxGenerator.js`).
- **Global state:** No mutable application singleton exists. Module-level constants define modes, fields, content types, and slide paths; mutable workflow state is component-local (`src/components/Form.jsx`, `src/utils/pptxGenerator.js`).
- **Circular imports:** Not detected. Dependencies flow `src/main.jsx` → `src/App.jsx` → `src/components/Form.jsx` → `src/components/FormInput.jsx` and `src/utils/pptxGenerator.js`.
- **Template schema:** `public/template.pptx` must retain slide paths, placeholders, relationship structure, and ordered picture frames expected by `src/utils/pptxGenerator.js`.
- **Picture-frame invariant:** The live template has ten frames wider than one inch: one on slide 1, one on slide 2, and eight on slide 3. The smallest retained frame is 1.57 inches wide; mapping remains positional within each slide.
- **Crop invariant:** Among the ten upload targets, slide 3's first target (`rId4`, Move Off) carries non-zero `<a:srcRect>` cropping in `public/template.pptx`; replacement preserves that crop.
- **Shared media:** Six small decoy/icon pictures on slide 3 share relationship `rId3` and `ppt/media/image19.png`. Always add a new media part and repoint one upload-target relationship; do not overwrite template media in place (`public/template.pptx`, `src/utils/pptxGenerator.js:280`).
- **Image types:** The template declares only PNG image content by default. Upload extensions must be inferred from bytes and added to `[Content_Types].xml` (`src/utils/pptxGenerator.js:10`, `public/template.pptx`).
- **Time semantics:** Keep clock parsers and duration parsers distinct. Parsers must return `null`, and clock differences must use `elapsedBetween` for midnight rollover (`src/components/Form.jsx:158`).
- **Deployment:** The production target is static hosting. Vite copies `public/template.pptx` into `dist/`; `generatePPTX` uses `import.meta.env.BASE_URL`, so non-root deployment works when built with the corresponding Vite base. No host-specific CI/deployment manifest exists.

## Anti-Patterns

### Bypassing Form Processing

**What happens:** Calling `generatePPTX` directly with raw UI values skips aliases, duration formatting, derived timings, and correctness validation.
**Why it's wrong:** Slides may retain blanks or display raw `MM:SS` values, and the official document can contain internally contradictory data.
**Do this instead:** Route generation through `handleSubmit` in `src/components/Form.jsx`, or extract the processing/validation pipeline as a reusable domain module before adding another caller.

### Treating Upload Slots as a Flat Cross-Slide Sequence

**What happens:** A flat image list shifts later uploads when a report mode drops a slide or an earlier upload is absent.
**Why it's wrong:** Evidence can land in the wrong labeled frame without a package-level error.
**Do this instead:** Preserve the per-slide arrays and indexed matching in `SLIDE_UPLOAD_SLOTS` and `generatePPTX` in `src/utils/pptxGenerator.js`.

### Overwriting Existing Template Media

**What happens:** Replacing bytes at an existing `ppt/media/imageN.png` target can modify every picture relationship sharing that part and can mismatch bytes with declared content type.
**Why it's wrong:** Multiple pictures can change together, and non-PowerPoint consumers can render the image as broken.
**Do this instead:** Follow `src/utils/pptxGenerator.js:280`: create `lr_upload_<slot>.<detected extension>`, repoint only the selected relationship, and declare the extension.

### Assuming Successful Fetch Means a PPTX

**What happens:** Static hosts with SPA rewrites can return `index.html` with status 200 for a missing template.
**Why it's wrong:** JSZip then fails with an opaque package error.
**Do this instead:** Keep the `PK` header check and `BASE_URL` resolution in `generatePPTX` (`src/utils/pptxGenerator.js:189`).

### Using Truthy/NaN Guards for Timing Arithmetic

**What happens:** Invalid values or valid midnight zero values are misclassified, allowing wrong calculations or suppressing legitimate ones.
**Why it's wrong:** Official durations can become plausible but false numbers.
**Do this instead:** Return `null` from parsers and use explicit `!== null` guards as in `src/components/Form.jsx:173` and `src/components/Form.jsx:335`.

## Error Handling

**Strategy:** Block known-invalid reports before generation, throw precise transformation errors inside the generator, and convert caught errors into visible form status while always releasing the loading state.

**Patterns:**
- `findBlockingProblems` accumulates all actionable input errors so the user can correct them together (`src/components/Form.jsx:229`).
- Empty optional values remain allowed and become post-download completeness warnings rather than blockers (`src/components/Form.jsx:386`).
- `generatePPTX` throws for unknown modes, failed template fetches, non-ZIP responses, missing required slides, and unsupported image bytes (`src/utils/pptxGenerator.js:182`).
- `generatePPTX` logs and rethrows; `handleSubmit` catches, logs, and displays `error.message`, with a generic fallback (`src/utils/pptxGenerator.js:311`, `src/components/Form.jsx:409`).
- Optional relationship anomalies currently cause an image replacement to be skipped via `continue`, leaving the template placeholder graphic (`src/utils/pptxGenerator.js:264`).

## Cross-Cutting Concerns

**Logging:** Browser errors use `console.error` in `src/components/Form.jsx` and `src/utils/pptxGenerator.js`; manual template inspection appends gitignored text logs in `analyze_pptx.cjs`. No remote logging exists.
**Validation:** Native HTML `required` covers incident number/date where visible; report-aware semantic validation is centralized in `findBlockingProblems` in `src/components/Form.jsx`; image compatibility is validated from magic bytes in `src/utils/pptxGenerator.js`.
**Authentication:** Not applicable. No authentication, authorization, backend, or user identity implementation exists in the tracked code or dependencies.
**Privacy:** Incident text and images stay in browser memory and are processed locally. The only network read initiated by application logic is the same-origin static `template.pptx` fetch (`src/utils/pptxGenerator.js:192`).

---

*Architecture analysis: 2026-09-09*
