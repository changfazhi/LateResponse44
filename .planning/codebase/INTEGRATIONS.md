# External Integrations

**Analysis Date:** 2026-09-09

## APIs & External Services

**Runtime APIs:**
- No third-party network API is integrated. Searches across `src/` show no remote URL, API SDK, `XMLHttpRequest`, WebSocket, or server endpoint.
- Local report template fetch - `src/utils/pptxGenerator.js` fetches `${import.meta.env.BASE_URL}template.pptx`, which resolves to the statically deployed `public/template.pptx` rather than an external service.
  - SDK/Client: browser `fetch`
  - Auth: none
  - Integrity guard: `src/utils/pptxGenerator.js` checks the response status and the leading `PK` ZIP signature to reject SPA fallback HTML returned with HTTP 200.

**Browser Platform:**
- Browser file input - `src/components/Form.jsx` accepts local evidence image `File` objects and keeps them in React state; files are not posted anywhere.
  - SDK/Client: native `<input type="file">` and `File.arrayBuffer()`
  - Auth: none
- Browser download - `src/utils/pptxGenerator.js` passes a generated blob to FileSaver's `saveAs` for a local `.pptx` download.
  - SDK/Client: `file-saver` 2.0.5
  - Auth: none

**Named but not integrated services:**
- ACES appears only as domain terminology, a screenshot upload label, and fixed report wording in `src/components/Form.jsx` and `src/utils/pptxGenerator.js`; there is no ACES API client or live data retrieval.
- Google Maps appears only in the `googleMapPic` evidence slot label in `src/utils/pptxGenerator.js`; there is no Maps JavaScript API, geocoding client, key, or outbound Maps request.
- SCDF is the business context described in `README.md` and `CLAUDE.md`; no SCDF system endpoint or identity provider is connected.

## Data Storage

**Databases:**
- Not detected. `package.json` has no database/ORM dependency, and `src/` contains no database connection code.
  - Connection: not applicable
  - Client: not applicable

**File Storage:**
- Local/static files only. The source template is committed at `public/template.pptx`, Vite copies it to `dist/template.pptx`, uploads exist transiently as browser `File` objects in `src/components/Form.jsx`, and the finished report is downloaded to the user's machine by `src/utils/pptxGenerator.js`.
- No object storage, upload service, filesystem server, or persistence layer is integrated.

**Caching:**
- None. No service worker, Cache API use, Redis client, application cache, or query cache is present.
- No `localStorage`, `sessionStorage`, or IndexedDB use is present; a reload discards the form and selected images held in `src/components/Form.jsx`.

## Authentication & Identity

**Auth Provider:**
- None.
  - Implementation: the app renders directly from `src/main.jsx` and exposes the form in `src/App.jsx`; there are no login routes, tokens, cookies, user records, permission checks, or auth dependencies.
- The repository-level `CLAUDE.md` explicitly rejects the parent-directory description of Firebase anonymous auth and owner mode, and the live `package.json`/`src/` implementation confirms neither exists.

## Monitoring & Observability

**Error Tracking:**
- None. There is no Sentry, Datadog, OpenTelemetry, analytics, or hosted monitoring package/configuration.

**Logs:**
- `src/utils/pptxGenerator.js` writes generation failures to `console.error` and rethrows them; `src/components/Form.jsx` converts errors into an on-page status message.
- `analyze_pptx.cjs` appends diagnostic picture-frame data to `slide3_log.txt` and `large_images_log.txt`; both are development artifacts ignored in `.gitignore`.
- No logs are shipped to a remote collector.

## CI/CD & Deployment

**Hosting:**
- Provider not configured. The deployable artifact is the static `dist/` directory produced from `index.html`, `src/`, and `public/` by Vite.
- `CLAUDE.md` states the current deployment is served from a domain root, but the repository contains no provider manifest proving which host operates it.
- Sub-path deployment is supported when the Vite `base` is set at build time because `src/utils/pptxGenerator.js` constructs the template URL from `import.meta.env.BASE_URL`.

**CI Pipeline:**
- None detected. There is no `.github/workflows/`, GitLab CI file, CircleCI config, deployment script, Dockerfile, or cloud-provider configuration tracked in the repository.
- Manual quality commands are defined in `package.json`: `npm run lint` and `npm run build`. Both complete successfully in the current checkout as of 2026-09-09.

## Environment Configuration

**Required env vars:**
- None. The only environment-derived value is Vite's built-in `BASE_URL`, read as `import.meta.env.BASE_URL` in `src/utils/pptxGenerator.js`.
- No API keys, database URLs, Firebase configuration, or auth secrets are referenced by `src/`, `vite.config.js`, or `package.json`.

**Secrets location:**
- Not applicable. No secret files are present at the repository root, and a static browser bundle would not be an appropriate place for secrets.
- If an external service is added, put secret-bearing operations behind a server boundary rather than embedding credentials in Vite client variables.

## Webhooks & Callbacks

**Incoming:**
- None. The application has no HTTP server, API route, serverless function, or webhook handler.

**Outgoing:**
- None. The only fetch in `src/utils/pptxGenerator.js` retrieves the application's own static `template.pptx` asset.

## Office Document Boundary

**PowerPoint package processing:**
- `public/template.pptx` is the single external-format boundary. `src/utils/pptxGenerator.js` loads it with JSZip, prunes slide/relationship/content-type parts by report mode, XML-escapes and substitutes placeholders, creates image media parts, updates slide relationships and MIME declarations, and generates a blob.
- The implementation does not invoke Microsoft Office, Microsoft Graph, Google Slides, LibreOffice, a conversion SaaS, or a document-generation API.
- Supported upload byte signatures in `src/utils/pptxGenerator.js` are PNG, JPEG, GIF, BMP, and TIFF. HEIC/HEIF and WebP are detected and rejected with user guidance rather than sent to a conversion service.
- Template deployment is operationally required: if `template.pptx` is absent or a host rewrites its URL to `index.html`, report generation fails locally with a surfaced error.

---

*Integration audit: 2026-09-09*
