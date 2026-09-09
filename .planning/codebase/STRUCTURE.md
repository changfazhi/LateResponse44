# Codebase Structure

**Analysis Date:** 2026-09-09

## Directory Layout

```
LateResponse44/
├── .planning/
│   └── codebase/                 # GSD codebase reference documents
├── public/
│   ├── template.pptx             # Canonical report template and implicit document schema
│   └── vite.svg                  # Default favicon asset referenced by index.html
├── src/
│   ├── components/
│   │   ├── Form.jsx              # Workflow state, domain calculations, validation, and full form UI
│   │   └── FormInput.jsx         # Reusable controlled input component
│   ├── utils/
│   │   └── pptxGenerator.js     # Report contracts and PPTX ZIP/XML transformation
│   ├── App.jsx                   # Page shell
│   ├── index.css                 # Global theme, layout, animation, and button styles
│   └── main.jsx                  # React browser bootstrap
├── .gitignore                    # Build, log, editor, and template-scratch exclusions
├── CLAUDE.md                    # Project-specific implementation and correctness guidance
├── README.md                    # Product and stack overview
├── analyze_pptx.cjs             # Manual Node template-frame inspection tool
├── eslint.config.js             # ESLint flat configuration for JS/JSX
├── index.html                   # Vite HTML entry
├── package.json                 # Scripts and runtime/dev dependency declarations
├── package-lock.json            # Locked npm dependency graph
└── vite.config.js              # Vite React plugin configuration
```

Generated/local directories may also exist but are not source: `node_modules/`, `dist/`, `slide3_log.txt`, `large_images_log.txt`, and template inspection scratch files are excluded by `.gitignore`.

## Directory Purposes

**`src/`:**
- Purpose: All browser application source.
- Contains: React bootstrap/shell, global CSS, feature components, and PPTX transformation utilities.
- Key files: `src/main.jsx`, `src/App.jsx`, `src/index.css`.

**`src/components/`:**
- Purpose: React UI and interaction workflow.
- Contains: The stateful report form and reusable controlled input.
- Key files: `src/components/Form.jsx`, `src/components/FormInput.jsx`.
- Boundary: `Form.jsx` currently owns domain behavior as well as rendering; new UI-only inputs belong here, while reusable non-React document logic belongs under `src/utils/`.

**`src/utils/`:**
- Purpose: Browser-side document generation and its mode/slot contracts.
- Contains: `generatePPTX`, PPTX part helpers, image sniffing, slide pruning, and exported report configuration.
- Key files: `src/utils/pptxGenerator.js`.
- Boundary: Keep Open XML package paths and ZIP mutations in this directory rather than embedding them in JSX.

**`public/`:**
- Purpose: Static assets copied by Vite without bundling.
- Contains: The canonical PowerPoint template and favicon.
- Key files: `public/template.pptx`, `public/vite.svg`.
- Boundary: Treat `public/template.pptx` as production data with schema-like coupling to `src/utils/pptxGenerator.js`; replacement requires re-verifying placeholders, parts, relationships, frame ordering, crops, and content types.

**`.planning/codebase/`:**
- Purpose: Generated GSD reference material for later planning and execution.
- Contains: Architecture, structure, stack, integrations, conventions, testing, and concern maps as produced by mapper tasks.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

## Key File Locations

**Entry Points:**
- `index.html`: Declares the root element and Vite module entry.
- `src/main.jsx`: Mounts the React application with `createRoot` and `StrictMode`.
- `src/App.jsx`: Defines the single page and renders `Form`.
- `src/components/Form.jsx`: Begins the user workflow and handles submission.
- `generatePPTX` in `src/utils/pptxGenerator.js`: Begins the document transformation workflow.

**Configuration:**
- `package.json`: npm scripts, ESM mode, runtime dependencies, and development dependencies.
- `package-lock.json`: Exact npm resolution used for reproducible installs.
- `vite.config.js`: Vite configuration with `@vitejs/plugin-react`; no hard-coded base path is set.
- `eslint.config.js`: Flat ESLint configuration for `*.js`/`*.jsx`, browser globals, React hooks, refresh rules, and unused-variable policy.
- `.gitignore`: Excludes generated bundles, installed dependencies, debug logs, and template inspection scratch artifacts.
- `CLAUDE.md`: Authoritative project-local implementation guidance; its no-backend/no-auth and browser-only pipeline claims match the tracked implementation.

**Core Logic:**
- `src/components/Form.jsx`: State model, mode-aware printed-field model, parsing, validation, midnight rollover, derived timings, warning construction, and orchestration.
- `src/utils/pptxGenerator.js`: Slide/slot model, ZIP part removal, placeholder replacement, image validation/injection, content types, output packaging, and download.
- `public/template.pptx`: Fixed slide text and placeholders consumed by core logic.

**Testing:**
- No tracked test directory, `*.test.*`/`*.spec.*` file, or test-runner configuration exists.
- `analyze_pptx.cjs`: Manual developer inspection of template picture shapes; output goes to gitignored root logs.
- `CLAUDE.md`: Documents the repository's manual source-extraction and mocked-browser verification approach, but those temporary harnesses are not tracked.

**Styling:**
- `src/index.css`: Global CSS variables, root/body layout, glass-panel utility, typography, animation, and button styles.
- `src/components/Form.jsx`: Feature-specific grid, status, toggle, select, upload, and heading styles are inline.
- `src/components/FormInput.jsx`: Input/label styles and focus/blur mutations are inline.

**Static/Deployment Assets:**
- `public/template.pptx`: Must be deployed beside the built app at the configured base URL.
- `public/vite.svg`: Browser favicon referenced as `/vite.svg` by `index.html`.
- `dist/`: Vite production output; generated by `npm run build`, gitignored, and not source-controlled.

## Naming Conventions

**Files:**
- Use PascalCase `.jsx` for React component modules: `src/App.jsx`, `src/components/Form.jsx`, `src/components/FormInput.jsx`.
- Use camelCase `.js` for browser utility modules: `src/utils/pptxGenerator.js`.
- Use camelCase `.cjs` for CommonJS developer scripts: `analyze_pptx.cjs`.
- Use conventional lowercase names for tool entry/config files: `index.html`, `package.json`, `vite.config.js`, `eslint.config.js`.
- Use uppercase Markdown names for generated GSD maps: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

**Directories:**
- Use lowercase plural role directories beneath `src/`: `src/components/`, `src/utils/`.
- Put unbundled static assets in `public/`.
- Put GSD-generated repository understanding in `.planning/codebase/`.

**Symbols and Data Keys:**
- Use PascalCase for React components: `App`, `Form`, `FormInput`.
- Use camelCase for functions and local state: `handleSubmit`, `parseTimeToSeconds`, `formData`, `isLoading`.
- Use uppercase snake case for configuration constants: `REPORT_MODES`, `SLIDE_UPLOAD_SLOTS`, `ALL_UPLOAD_SLOTS`, `LATE_THRESHOLD_SECONDS`.
- Preserve template-facing snake_case and existing case exactly: `incident_number`, `incident_no`, `actual_activation_time`, `SFTL1_redTime`. These keys are external schema names embedded in `public/template.pptx`, not ordinary internal naming choices.

## Where to Add New Code

**New Report Field:**
- Primary code: Add initial state, mode visibility, semantic metadata/validation, processing, and form control in `src/components/Form.jsx`.
- Template binding: Add the matching `{{key}}` placeholder to the appropriate slide inside `public/template.pptx`; preserve exact key case.
- Generator changes: Usually unnecessary because `generatePPTX` replaces every processed-data key generically in `src/utils/pptxGenerator.js`.
- Verification: Inspect the generated slide XML from `public/template.pptx` and exercise both modes because `MODE_FIELDS` controls validation and warnings.

**New Derived Timing Rule:**
- Primary code: Add the rule beside existing parsers/calculations in `src/components/Form.jsx`.
- UI: Render derived values through read-only `src/components/FormInput.jsx` controls.
- Correctness: Use `null` for parse failure, explicit `!== null` guards, and `elapsedBetween` for clock-time differences crossing midnight.
- Refactor path: If rules are needed outside `Form`, first move parsing/validation/calculation functions into a focused module under `src/utils/` and import them from `src/components/Form.jsx`.

**New Report Mode:**
- Primary code: Add label, retained slide paths, and filename prefix to `REPORT_MODES` in `src/utils/pptxGenerator.js`.
- Field scope/UI: Add the printed-field subset and visibility behavior in `MODE_FIELDS` and JSX in `src/components/Form.jsx`.
- Images: Define ordered per-slide slots in `SLIDE_UPLOAD_SLOTS` and let `uploadSlotsFor` drive both rendering and warning/generation behavior.
- Template: Add or modify the corresponding parts in `public/template.pptx`; update `pruneSlides` only if the package structure differs from existing slides/notes.

**New Evidence Image:**
- Primary code: Add `{ key, label }` at the correct positional index under its owning slide in `SLIDE_UPLOAD_SLOTS` in `src/utils/pptxGenerator.js`.
- Template: Add a `<p:pic>` upload target wider than one inch at the matching document-order position in `public/template.pptx`.
- State/UI: No manual state or input duplication is needed; `ALL_UPLOAD_SLOTS` and `uploadSlotsFor` feed `src/components/Form.jsx` automatically.
- Verification: Extend or use `analyze_pptx.cjs` to verify frame count/order, relationship targets, source crops, and decoy-size margin.

**New UI Component:**
- Implementation: `src/components/<PascalCaseName>.jsx`.
- Composition: Import into `src/components/Form.jsx` for feature controls or `src/App.jsx` for page-level content.
- Styling: Reuse shared variables/classes from `src/index.css`; keep component-only interaction styling with the component until a reusable class emerges.

**Utilities:**
- Shared browser/document helpers: `src/utils/<camelCaseName>.js`.
- PPTX package helpers: Keep in `src/utils/pptxGenerator.js` while private and tightly coupled; split into a sibling module only when reused or independently testable.
- Developer-only template diagnostics: Repository root beside `analyze_pptx.cjs`, with generated output patterns added to `.gitignore`.

**Tests:**
- New runner-based unit tests: Co-locate as `src/**/*.test.js` or establish one consistent top-level test directory and add the runner/config/scripts to `package.json`.
- Domain test priority: Parsing, midnight rollover, mode-aware validation, derived calculations, and late-activation threshold behavior currently live in `src/components/Form.jsx`.
- Integration test priority: Exercise `src/utils/pptxGenerator.js` against the real `public/template.pptx`, mock `fetch`/FileSaver, and inspect the generated ZIP parts.

## Special Directories

**`public/`:**
- Purpose: Vite static assets served verbatim.
- Generated: No.
- Committed: Yes.

**`dist/`:**
- Purpose: Production static bundle created by `npm run build`.
- Generated: Yes.
- Committed: No; excluded by `.gitignore`.

**`node_modules/`:**
- Purpose: Installed npm dependency tree.
- Generated: Yes.
- Committed: No; excluded by `.gitignore`.

**`.planning/codebase/`:**
- Purpose: GSD mapper outputs consumed by planning and execution workflows.
- Generated: Yes.
- Committed: Determined by the parent/orchestrator workflow; this mapper does not commit.

**Template Inspection Scratch:**
- Purpose: `slide3_log.txt`, `large_images_log.txt`, `temp_img_pptx/`, and `*.pptx.zip` support manual inspection of `public/template.pptx`.
- Generated: Yes.
- Committed: No; excluded by `.gitignore`.

---

*Structure analysis: 2026-09-09*
