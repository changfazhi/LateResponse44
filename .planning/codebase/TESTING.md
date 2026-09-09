# Testing Patterns

**Analysis Date:** 2026-09-09

## Test Framework

**Runner:**
- Not detected. `package.json` has no `test` script or test dependency, and the repository contains no `*.test.*`, `*.spec.*`, Jest, Vitest, Playwright, or Cypress configuration.
- Config: Not applicable

**Assertion Library:**
- Not detected in `package.json` or repository source.

**Run Commands:**
```bash
npm run lint                         # Static analysis; currently clean
npm run build                        # Production compile to dist/; currently succeeds
node analyze_pptx.cjs                # Inspect real template frames; appends ignored logs
vite build --base=/LateResponse44/   # Verify sub-path asset resolution described in CLAUDE.md
```

- Do not use `npm test`; no such script exists in `package.json`.
- `npm run lint` and `npm run build` were executed successfully on 2026-09-09. The build transformed 39 modules and emitted `dist/index.html`, CSS, JavaScript, and the copied `dist/template.pptx`.

## Test File Organization

**Location:**
- No committed automated tests or reusable ad-hoc harnesses are present.
- `CLAUDE.md` documents historical verification by extracting shipped helpers from `src/components/Form.jsx` into a temporary `.mjs`, then running Node assertions; no extraction script or assertions are currently stored in the repository.
- `CLAUDE.md` also documents copying `src/utils/pptxGenerator.js` beside a stub `file-saver`, mocking `fetch`, running against `public/template.pptx`, and inspecting the generated ZIP; that harness is not committed.
- The only committed diagnostic executable is `analyze_pptx.cjs`, which reads the real `public/template.pptx` and appends picture dimensions to ignored root logs.

**Naming:**
- Not established for tests. If introducing a runner, co-locate focused files as `src/components/Form.test.jsx` and `src/utils/pptxGenerator.test.js`, or establish one consistent repository-wide alternative.

**Structure:**
```text
Repository root/
├── analyze_pptx.cjs          # Ad-hoc template inspection, not assertions
├── slide3_log.txt            # Ignored, cumulative output
├── large_images_log.txt      # Ignored, cumulative output
├── public/template.pptx      # Real package fixture
├── src/components/Form.jsx   # Embedded time/validation logic
└── src/utils/pptxGenerator.js# Embedded PPTX package logic
```

## Test Structure

**Suite Organization:**
```javascript
// No committed suite exists. CLAUDE.md prescribes testing the shipped implementation:
// 1. slice helpers from src/components/Form.jsx between stable source anchors;
// 2. write the slice to a temporary .mjs outside the repository;
// 3. import that module and assert behavior in Node;
// 4. never retype helper implementations into the test harness.
```

**Patterns:**
- Setup pattern: use the real `public/template.pptx` for package-level checks. Stub only browser boundaries such as `file-saver` and `fetch` when exercising `src/utils/pptxGenerator.js` in Node.
- Teardown pattern: use temporary files/directories and remove them after the run. Existing ignored inspector logs are append-only and therefore require explicit cleanup or before/after line-count accounting.
- Assertion pattern: assert exact derived strings and exact ZIP structure, not merely that generation resolves. Official-document accuracy requires checking values, relationship targets, content types, retained slides, and filenames.
- Source-of-truth pattern: tests must execute code extracted/imported from `src/components/Form.jsx` and `src/utils/pptxGenerator.js`; do not duplicate implementations in test code.

## Mocking

**Framework:**
- No mocking library is installed. Historical verification described in `CLAUDE.md` uses plain Node stubs and a mocked `fetch`.

**Patterns:**
```javascript
// Conceptual boundary documented in CLAUDE.md; no committed harness exists.
globalThis.fetch = async () => ({
  ok: true,
  arrayBuffer: async () => templateBytes,
});

// Replace file-saver only to capture the generated Blob; keep JSZip and
// public/template.pptx real so package mutations are exercised end to end.
```

**What to Mock:**
- Mock browser-only I/O at the edge: `fetch`, `saveAs` from `file-saver`, `File.arrayBuffer()`, and potentially `import.meta.env.BASE_URL` when loading `src/utils/pptxGenerator.js` under Node.
- For component tests, mock only `generatePPTX` when the purpose is to verify status/validation behavior in `src/components/Form.jsx`.

**What NOT to Mock:**
- Do not mock time arithmetic helpers when testing calculations in `src/components/Form.jsx`.
- Do not mock JSZip, XML contents, or the template when testing `src/utils/pptxGenerator.js`; use `public/template.pptx` and inspect the actual output archive.
- Do not synthesize a replacement template fixture as the only coverage. Image-frame order, shared media, relationships, crops, and content types are properties of `public/template.pptx`.

## Fixtures and Factories

**Test Data:**
```javascript
// High-value table cases for helpers extracted from src/components/Form.jsx:
[
  ['23:58:00', '00:05:00', '07 Min 00 Sec'], // midnight rollover
  ['o5:30', null],                           // malformed value, never NaN
  ['5:30:', null],                           // trailing empty segment
  ['90', null],                              // ambiguous bare duration rejected
  ['05:30', 330],                            // MM:SS accepted
]
```

```javascript
// High-value report-mode cases for src/components/Form.jsx and
// src/utils/pptxGenerator.js:
[
  { mode: 'late_response', expectedSlides: [1, 2, 3], expectedSlots: 10 },
  { mode: 'late_activation', expectedSlides: [2], expectedSlots: 1 },
]
```

**Location:**
- `public/template.pptx` is the canonical integration fixture and the only committed template copy.
- There is no fixture/factory directory. Keep future scalar cases in their focused test modules and reserve `public/template.pptx` for real-package integration tests.

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Not available: no runner or coverage provider is configured in package.json.
```

- ESLint/build success does not measure behavioral coverage.
- Git history records manual/extracted verification for accuracy fixes (`f35881e`, `c1681e0`) and the late-activation mode (`65b5583`), but those assertions are not reproducible from committed files.

## Test Types

**Unit Tests:**
- Not automated. Highest-priority pure logic lives inside `Form` in `src/components/Form.jsx`: `splitTimeParts`, `parseTimeToSeconds`, `parseDurationToSeconds`, `elapsedBetween`, `formatSecondsToVerbose`, `formatTimeSeconds`, `findBlockingProblems`, and the Time Exceeded preview.
- Required unit cases: blank versus malformed input; `null` rather than `NaN`; `HH:mm`/`HH:mm:ss`; `MM:SS`/three-part duration; bare-number rejection; midnight rollover; negative Time Exceeded formatting; half-filled time pairs; SFTL pair validation; and mode-specific field selection.
- Late Activation must block `actual_activation_time >= 01:00`, ignore late-response-only pair rules, and warn (without blocking) when ACES `activation_time < 01:00`, following `src/components/Form.jsx`.

**Integration Tests:**
- Ad hoc only. `analyze_pptx.cjs` reads `public/template.pptx`, but it logs instead of asserting and uses a stricter `width > 1 inch && height > 1 inch` filter than the generator's width-only filter in `src/utils/pptxGenerator.js`.
- Current-template verification must assert the generator-visible frame counts: one on `ppt/slides/slide1.xml`, one on `ppt/slides/slide2.xml`, and eight on `ppt/slides/slide3.xml`, in the exact positional order defined by `SLIDE_UPLOAD_SLOTS` in `src/utils/pptxGenerator.js`.
- The current inspector's `large_images_log.txt` shows only five slide-3 frames per run because three valid wide targets are shorter than one inch. Do not use that log alone to validate the ten-slot invariant stated in `CLAUDE.md`.
- Generated ZIP checks must cover: text XML escaping/replacement; slide and notes pruning; removal of presentation relationships and content-type overrides; no dangling references; new upload media parts; per-frame relationship repointing; PNG/JPEG/GIF/BMP/TIFF declarations; HEIC/WebP/unknown rejection; and filename prefix/fallback behavior in `src/utils/pptxGenerator.js`.
- Verify skipped uploads retain template graphics and do not shift later uploads, both within slide 3 and when `late_activation` prunes slides 1 and 3.
- Verify a production build includes `dist/template.pptx`, and use `vite build --base=/LateResponse44/` to cover the `import.meta.env.BASE_URL` contract in `src/utils/pptxGenerator.js`.

**E2E Tests:**
- Not used. No browser automation framework is configured in `package.json`.
- Manual browser acceptance should exercise both mode toggles, visible fields, mode-preserved state, loading/disabled button state, red blocking errors, amber post-download warnings, successful download, and opening the deck in PowerPoint plus at least one stricter renderer such as Google Slides, LibreOffice, or Keynote.
- The late-response path should cover a night incident crossing midnight and mixed uploaded formats. The late-activation path should confirm a one-slide package, only the ACES upload slot, and refusal of contradictory `actual_activation_time` values.

## Common Patterns

**Async Testing:**
```javascript
// For src/utils/pptxGenerator.js, await generation and inspect the captured Blob.
await generatePPTX(formData, images, 'late_activation');
const outputZip = await JSZip.loadAsync(capturedBlob);
// Assert exact retained parts, rels, content types, text, and media bytes.
```

**Error Testing:**
```javascript
// Assert actionable errors from src/utils/pptxGenerator.js, not only rejection.
await assert.rejects(
  () => generatePPTX(formData, { acesPic: heicFile }, 'late_activation'),
  /HEIC\/HEIF photo/
);
```

## Current Verification Gaps

- `package.json` has no `test` or coverage command, so correctness regressions are not caught by the routine `npm run lint` / `npm run build` workflow.
- `src/components/Form.jsx` nests pure business rules inside the React component, making direct imports impossible and forcing brittle source slicing described in `CLAUDE.md`.
- `src/utils/pptxGenerator.js` has non-exported package helpers (`findPictureFrames`, `pruneSlides`, `detectImageExtension`) and depends directly on browser globals, increasing harness setup cost.
- `analyze_pptx.cjs` is diagnostic rather than assertive, appends duplicate log records, does not fail with a nonzero exit code on invariant drift, and its height filter does not match `findPictureFrames` in `src/utils/pptxGenerator.js`.
- No committed test protects XML regex behavior, report-mode pruning, shared-media handling, content-type declarations, crop persistence, field/placeholder parity, or template frame ordering.
- No automated UI/accessibility or cross-renderer check covers `src/components/Form.jsx`, `src/components/FormInput.jsx`, or generated PPTX compatibility.

---

*Testing analysis: 2026-09-09*
