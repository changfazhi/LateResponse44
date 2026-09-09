# Technology Stack

**Analysis Date:** 2026-09-09

## Languages

**Primary:**
- JavaScript (ECMAScript modules, JSX) - All application logic and UI live in `src/main.jsx`, `src/App.jsx`, `src/components/Form.jsx`, `src/components/FormInput.jsx`, and `src/utils/pptxGenerator.js`. The package is explicitly ESM through `package.json` (`"type": "module"`).
- CSS - Global theme, layout, and reusable visual classes live in `src/index.css`; component-specific presentation is also expressed with inline React style objects in `src/App.jsx`, `src/components/Form.jsx`, and `src/components/FormInput.jsx`.

**Secondary:**
- CommonJS JavaScript - `analyze_pptx.cjs` is a standalone Node utility for inspecting picture frames in `public/template.pptx`; it is not included in the browser application.
- XML (Office Open XML inside PPTX) - `src/utils/pptxGenerator.js` directly rewrites XML parts inside `public/template.pptx`; there is no PowerPoint document-generation framework.
- HTML - `index.html` supplies the Vite entry document and `#root` mount point.

## Runtime

**Environment:**
- Modern web browser - The production application uses React DOM, `fetch`, `File.arrayBuffer()`, typed arrays, blobs, and browser-triggered downloads in `src/main.jsx`, `src/components/Form.jsx`, and `src/utils/pptxGenerator.js`.
- Node.js - Required for Vite, ESLint, npm scripts, and `analyze_pptx.cjs`. No version is pinned in `.nvmrc`, `.node-version`, or `package.json`. The installed Vite 7 line requires Node `^20.19.0 || >=22.12.0`; the repository currently builds under Node `v24.16.0`.

**Package Manager:**
- npm 11.13.0 observed in the working environment; no `packageManager` field pins a release in `package.json`.
- Lockfile: present at `package-lock.json` (lockfile version 3). Use `npm install`/`npm ci`; do not introduce a second lockfile.
- Metadata caveat: `package.json` names the project `lateresponse44`, while the root package record in `package-lock.json` still says `temp_app`. Dependency resolution remains functional, but update the lockfile when normalizing package metadata.

## Frameworks

**Core:**
- React 19.2.x (`react` 19.2.1 installed) - Component rendering and local form state in `src/main.jsx`, `src/App.jsx`, and `src/components/Form.jsx`.
- React DOM 19.2.x (`react-dom` 19.2.1 installed) - Browser root creation in `src/main.jsx`.
- Vite 7.2.x (`vite` 7.2.7 installed) - Development server, JSX transformation, asset copying, and production bundling configured by `vite.config.js`.

**Testing:**
- Not detected - `package.json` defines no test script and the repository has no Jest, Vitest, Playwright, Cypress, or other test dependency/configuration.
- Current verification approach is documented in `CLAUDE.md`: extract shipped functions into temporary Node modules and exercise them directly, while stubbing `file-saver` and `fetch` for PPTX package inspection. This is an ad hoc workflow, not a checked-in runner.

**Build/Dev:**
- `@vitejs/plugin-react` 5.1.2 installed - Enables React JSX/Fast Refresh via `vite.config.js`.
- ESLint 9.39.1 installed - Flat-config linting through `eslint.config.js` and `npm run lint`.
- `eslint-plugin-react-hooks` 7.0.1 and `eslint-plugin-react-refresh` 0.4.24 - React-specific rules enabled in `eslint.config.js`.
- Vanilla CSS - No CSS framework, preprocessor, CSS Modules, or CSS-in-JS dependency is declared in `package.json`.

## Key Dependencies

**Critical:**
- `jszip` 3.10.1 - Loads `public/template.pptx` as a ZIP, reads and rewrites Office Open XML, adds uploaded image parts, prunes unused slides, and emits the finished blob in `src/utils/pptxGenerator.js`.
- `file-saver` 2.0.5 - Calls `saveAs` to download the generated PPTX from `src/utils/pptxGenerator.js`.
- `react` 19.2.1 and `react-dom` 19.2.1 - Power the single-page UI and local-only application state in `src/`.

**Infrastructure:**
- `public/template.pptx` - Runtime data asset and the sole report template. It is a 3-slide Office Open XML package copied into `dist/template.pptx` by Vite.
- `analyze_pptx.cjs` - Developer-only JSZip inspection utility that reads `public/template.pptx` and appends results to gitignored `slide3_log.txt` and `large_images_log.txt`.
- No backend SDK, authentication library, database client, analytics SDK, cloud SDK, or telemetry package is present in `package.json` or imported under `src/`.

## Configuration

**Environment:**
- No `.env` files or application-specific environment variables are present. Do not add runtime secrets: all shipped frontend values are public to the browser.
- `src/utils/pptxGenerator.js` uses Vite's built-in `import.meta.env.BASE_URL` only, resolving `template.pptx` correctly for root and sub-path deployments.
- The application has no user accounts, auth session, persisted browser storage, server API, or upload endpoint. Form data and image `File` objects remain in React component memory in `src/components/Form.jsx`.

**Build:**
- `vite.config.js` applies only the React plugin; no aliases, proxy, target override, deployment adapter, or custom output path is configured.
- `eslint.config.js` uses ESLint flat config, browser globals, ECMAScript modules/JSX, recommended JavaScript rules, React Hooks rules, React Refresh rules, and an error-level unused-variable rule.
- `index.html` is the browser entry point. Vite builds to gitignored `dist/`; `public/template.pptx` and `public/vite.svg` are copied as static assets.
- Verified on 2026-09-09: `npm run lint` exits cleanly, and `npm run build` succeeds with 39 transformed modules and a roughly 316 kB JavaScript bundle (98.66 kB gzip).

## Platform Requirements

**Development:**
- Install a Node release supported by Vite 7 (`^20.19.0 || >=22.12.0`) and npm dependencies from `package-lock.json`.
- Use `npm run dev` for the Vite development server (default port 5173), `npm run lint` for static checks, `npm run build` for `dist/`, and `npm run preview` to serve a built bundle.
- Keep `public/template.pptx` beside the public build assets. Use `analyze_pptx.cjs` only as a diagnostic; its output logs are excluded by `.gitignore`.

**Production:**
- Static hosting with support for `index.html`, hashed files under `dist/assets/`, and the unmodified `dist/template.pptx` asset.
- No specific hosting provider, CI pipeline, container, server runtime, or deployment manifest is configured in the repository.
- Root hosting is the current documented assumption in `CLAUDE.md`. A sub-path build is supported by running Vite with a matching base (for example `vite build --base=/LateResponse44/`) because `src/utils/pptxGenerator.js` reads `import.meta.env.BASE_URL`.
- Target browsers must support React 19/Vite's emitted browser code plus `fetch`, `Blob`, `File.arrayBuffer`, `String.prototype.replaceAll`, and client-side downloads.

---

*Stack analysis: 2026-09-09*
