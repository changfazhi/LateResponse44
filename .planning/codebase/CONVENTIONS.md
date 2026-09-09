# Coding Conventions

**Analysis Date:** 2026-09-09

## Naming Patterns

**Files:**
- Use PascalCase for React component modules: `src/App.jsx`, `src/components/Form.jsx`, and `src/components/FormInput.jsx`.
- Use camelCase for non-component JavaScript modules and diagnostic scripts: `src/utils/pptxGenerator.js` and `analyze_pptx.cjs`.
- Keep reusable UI under `src/components/` and browser-side document logic under `src/utils/`; do not add business calculations to `src/App.jsx`.

**Functions:**
- Use camelCase for functions and event handlers: `todayLocalISO`, `modePrintsField`, `uploadSlotsFor`, `handleChange`, `handleImageChange`, and `handleSubmit` in `src/components/Form.jsx` and `src/utils/pptxGenerator.js`.
- Prefix UI event handlers with `handle`, as in `handleSubmit` and `handleImageChange` in `src/components/Form.jsx`.
- Name conversion helpers for their input/output contract: `parseTimeToSeconds`, `parseDurationToSeconds`, `formatSecondsToVerbose`, and `formatTimeSeconds` in `src/components/Form.jsx`.
- Use `For` suffixes for path/lookup derivation (`relsPathFor`, `uploadSlotsFor`) in `src/utils/pptxGenerator.js`.

**Variables:**
- Use camelCase for local variables and React state (`formData`, `processedData`, `reportMode`, `isLoading`) in `src/components/Form.jsx`.
- Preserve snake_case keys where they are the PPTX placeholder/data contract (`incident_number`, `actual_activation_time`, `SFTL1_redTime`) in `src/components/Form.jsx`; these names intentionally mirror `{{key}}` tokens consumed by `src/utils/pptxGenerator.js`.
- Use `Sec` suffixes for numeric seconds (`arrivalSec`, `responseInputSec`, `actualActivationSec`) in `src/components/Form.jsx`.
- Use `Path`/`Part` suffixes for Open Packaging Convention paths (`typesPath`, `slidePart`, `notesPart`) in `src/utils/pptxGenerator.js`.

**Types:**
- The codebase is JavaScript/JSX without TypeScript or PropTypes. Keep data shapes explicit through named constants such as `REPORT_MODES`, `SLIDE_UPLOAD_SLOTS`, `TIME_FIELDS`, and `REPORT_FIELDS` in `src/utils/pptxGenerator.js` and `src/components/Form.jsx`.
- Model absence or parse failure as `null`, not `NaN`, in time/image parsers. Callers in `src/components/Form.jsx` and `src/utils/pptxGenerator.js` consistently test for `!== null` or supported lookup membership.

## Code Style

**Formatting:**
- No formatter is configured: there is no Prettier/Biome dependency or configuration in `package.json` or the repository root.
- Preserve the style of the file being edited. `src/components/Form.jsx`, `src/components/FormInput.jsx`, and `src/App.jsx` use semicolons and four-space indentation; `src/main.jsx`, `eslint.config.js`, and `vite.config.js` omit semicolons and use two-space indentation; `src/utils/pptxGenerator.js` uses semicolons with two-space indentation.
- Use single quotes in JavaScript imports and strings; use template literals for interpolated user-facing messages and XML fragments, as in `src/components/Form.jsx` and `src/utils/pptxGenerator.js`.
- Keep trailing commas in multiline objects/arrays where the surrounding file does so, notably `src/utils/pptxGenerator.js` and `eslint.config.js`.
- Inline style objects are the established UI convention in `src/App.jsx`, `src/components/Form.jsx`, and `src/components/FormInput.jsx`; shared theme primitives and reusable classes belong in `src/index.css`.

**Linting:**
- Run `npm run lint`, which invokes `eslint .` from `package.json`.
- `eslint.config.js` uses ESLint flat config with `@eslint/js` recommended rules, browser globals, React Hooks recommended rules, and the Vite React Refresh preset.
- `eslint.config.js` treats unused variables as errors, except names matching `^[A-Z_]`; this permits constants such as `TIME_FIELDS` while still keeping the baseline warning-free.
- `dist/` is globally ignored by `eslint.config.js`; source, root scripts, and configuration files remain in lint scope when they match `**/*.{js,jsx}`.
- Current verification on 2026-09-09: `npm run lint` exits successfully with no warnings or errors; `npm run build` also succeeds.

## Import Organization

**Order:**
1. Import framework/runtime and third-party packages first (`react`, `react-dom/client`, `jszip`, `file-saver`) in `src/main.jsx`, `src/components/Form.jsx`, and `src/utils/pptxGenerator.js`.
2. Import local components/utilities next (`./components/Form`, `./FormInput`, `../utils/pptxGenerator`) in `src/App.jsx` and `src/components/Form.jsx`.
3. Import side-effect styles after runtime imports and before the local root component, as `src/main.jsx` does with `./index.css`.

**Path Aliases:**
- Not detected. Use relative imports; neither `vite.config.js` nor another resolver configuration defines aliases.
- Existing imports inconsistently include extensions (`src/main.jsx`) or omit them (`src/App.jsx`, `src/components/Form.jsx`). Match the local file until a repository-wide rule is introduced.

## Error Handling

**Patterns:**
- Prefer rejecting a confidently wrong official-document value over fabricating a fallback. `src/components/Form.jsx` returns `null` for invalid/ambiguous time input, blocks malformed or half-filled calculations through `findBlockingProblems`, and only calculates when all operands are valid.
- Keep validation mode-aware. `modePrintsField` and `findBlockingProblems` in `src/components/Form.jsx` validate only fields printed by the selected `REPORT_MODES` entry from `src/utils/pptxGenerator.js`.
- Treat incomplete but internally consistent drafts as non-blocking: `src/components/Form.jsx` downloads the presentation, then emits an amber warning listing blank printed fields and missing evidence images.
- Throw specific, actionable `Error` objects at document-generation boundaries in `src/utils/pptxGenerator.js`: unknown report type, failed template fetch, non-ZIP response, missing slide, and unsupported image bytes.
- Preserve error context across layers. `generatePPTX` logs and rethrows in `src/utils/pptxGenerator.js`; `handleSubmit` catches it in `src/components/Form.jsx` and displays `error.message`, with a generic fallback only when no message exists.
- Guard optional ZIP parts and relationships with optional chaining/early continuation in `src/utils/pptxGenerator.js`; do not let one absent optional relationship crash unrelated processing.

## Logging

**Framework:** console and file-appending diagnostic script

**Patterns:**
- Log generation failures with context using `console.error('PPTX Generation Error:', error)` in `src/utils/pptxGenerator.js`. The UI layer also logs the caught error in `src/components/Form.jsx` before presenting it.
- Use `analyze_pptx.cjs` only as a local template inspector. It appends frame dimensions to gitignored `slide3_log.txt` and `large_images_log.txt`; `.gitignore` keeps both artifacts out of version control.
- Clear or account for the inspector logs before interpreting counts. `analyze_pptx.cjs` uses `appendFileSync`, so every run duplicates prior entries; the current run produced cumulative logs rather than a clean snapshot.
- Do not add routine browser logs to the user flow. Existing console output is limited to exceptional generation failures in `src/components/Form.jsx` and `src/utils/pptxGenerator.js`.

## Comments

**When to Comment:**
- Explain correctness-sensitive constraints and the failure they prevent. Strong examples include midnight wraparound and `null` parsing in `src/components/Form.jsx`, and shared PPTX media parts/content-type consistency in `src/utils/pptxGenerator.js`.
- Explain template/package invariants immediately above regex/XML surgery in `src/utils/pptxGenerator.js`, especially document-order image mapping, relationship removal, and content-type declarations.
- Explain policy constants where defined, such as the eight-minute `LATE_THRESHOLD_SECONDS` in `src/components/Form.jsx`.
- Avoid stale intent comments. The comment above `parseDurationToSeconds` in `src/components/Form.jsx` still says “or plain minutes,” while the implementation deliberately rejects bare numbers; update comments whenever behavior changes.

**JSDoc/TSDoc:**
- Not used. The repository relies on focused inline comments and descriptive helper names in `src/components/Form.jsx` and `src/utils/pptxGenerator.js`.
- For new public utilities, continue the compact explanatory-comment style unless a type/documentation tool is introduced across the project.

## Function Design

**Size:**
- Extract focused pure helpers for parsing, formatting, path derivation, and frame discovery, following `splitTimeParts`, `elapsedBetween`, `relsPathFor`, and `findPictureFrames` in `src/components/Form.jsx` and `src/utils/pptxGenerator.js`.
- The two orchestration functions are intentionally broad but are already high-risk: `Form` spans most of `src/components/Form.jsx`, and `generatePPTX` owns the entire package mutation pipeline in `src/utils/pptxGenerator.js`. New calculations should be pure module-level helpers so they can be verified independently.

**Parameters:**
- Use default parameters at API boundaries for optional state (`generatePPTX(formData, images = {}, mode = 'late_response')`) in `src/utils/pptxGenerator.js`.
- Pass report mode explicitly into mode-sensitive validation and generation (`findBlockingProblems(data, reportMode)`, `uploadSlotsFor(mode)`) in `src/components/Form.jsx` and `src/utils/pptxGenerator.js`.
- Pass complete objects for related form/image state rather than long positional argument lists, as in `generatePPTX(processedData, images, mode)`.

**Return Values:**
- Pure parsers return a usable numeric value or `null`; never return `NaN` from helpers in `src/components/Form.jsx`.
- Lookup helpers return empty arrays for unknown/unselected modes (`uploadSlotsFor`) while the document generation boundary throws on unknown modes in `src/utils/pptxGenerator.js`.
- React event handlers mutate state and return early on validation failure; async generation propagates failures via rejected promises in `src/components/Form.jsx` and `src/utils/pptxGenerator.js`.

## Module Design

**Exports:**
- Use default exports for React components (`src/App.jsx`, `src/components/Form.jsx`, `src/components/FormInput.jsx`).
- Use named exports for reusable report contracts and utilities (`REPORT_MODES`, `SLIDE_UPLOAD_SLOTS`, `ALL_UPLOAD_SLOTS`, `uploadSlotsFor`, `generatePPTX`) in `src/utils/pptxGenerator.js`.
- Keep correctness-sensitive report metadata centralized in `src/utils/pptxGenerator.js`; UI code in `src/components/Form.jsx` consumes it rather than duplicating slide lists.

**Barrel Files:**
- Not used. Import modules directly by relative path, as in `src/App.jsx` and `src/components/Form.jsx`.

---

*Convention analysis: 2026-09-09*
