# Codebase Concerns

**Analysis Date:** 2026-09-09

## Priority Summary

| Priority | Classification | Concern | Primary files |
|----------|----------------|---------|---------------|
| Critical | Confirmed correctness defect | Late-activation validation rejects the value that appears to justify the report and permits the contradictory case | `src/components/Form.jsx`, `public/template.pptx`, `CLAUDE.md` |
| High | Confirmed correctness defect | Numeric parsers accept impossible and ambiguous time/duration values | `src/components/Form.jsx` |
| High | Confirmed correctness defect | Missing evidence leaves realistic template artwork in the official output | `src/utils/pptxGenerator.js`, `src/components/Form.jsx`, `public/template.pptx` |
| High | Confirmed correctness defect | Image-placement failures are silently treated as successful uploads | `src/utils/pptxGenerator.js`, `src/components/Form.jsx` |
| High | Fragility / missing coverage | PPTX generation depends on undocumented XML serialization and positional frame order with no contract test | `src/utils/pptxGenerator.js`, `public/template.pptx` |
| High | Security/privacy risk | A document marked `RESTRICTED` is shipped as a public static asset with no access control | `public/template.pptx`, `src/utils/pptxGenerator.js` |
| Medium | Performance risk | Uploads have no size or pixel limits and generation duplicates them in browser memory | `src/components/Form.jsx`, `src/utils/pptxGenerator.js` |
| Medium | Missing coverage | No automated tests or CI protect official-document calculations or package validity | `package.json`, `CLAUDE.md` |
| Medium | Deployment risk | The generated app depends on separately deployed `template.pptx`, with no release-time integrity/version check | `public/template.pptx`, `src/utils/pptxGenerator.js`, `vite.config.js` |

## Tech Debt

**Monolithic form and policy logic:**
- Issue: `Form` owns UI state, parsing, policy validation, calculations, warnings, and submission in one 593-line component. The core functions are nested inside the component and cannot be imported directly for tests.
- Files: `src/components/Form.jsx`
- Impact: Official-document rules are difficult to review independently, and the current verification technique described in `CLAUDE.md` slices source text between anchors. Moving comments or functions can break that test harness without changing behavior.
- Fix approach: Extract pure time parsing, calculations, report-field policy, and validation into importable modules. Keep `Form` responsible for rendering and orchestration only.

**Duplicated template schema:**
- Issue: Placeholder names and mode fields are separately encoded in `REPORT_FIELDS`, `MODE_FIELDS`, `SLIDE_UPLOAD_SLOTS`, `REPORT_MODES`, and the XML inside `public/template.pptx`.
- Files: `src/components/Form.jsx`, `src/utils/pptxGenerator.js`, `public/template.pptx`
- Impact: A template edit can create a field that is not replaced, not validated, or not included in incomplete-document warnings.
- Fix approach: Add a template-contract validator that extracts placeholders and picture targets from `public/template.pptx`, compares them with the JavaScript schema, and fails tests/builds on drift.

**Raw XML string surgery:**
- Issue: XML is modified with regular expressions and literal `replaceAll` calls rather than an OOXML-aware parser.
- Files: `src/utils/pptxGenerator.js`
- Impact: Namespace prefix changes, split text runs, non-self-closing relationship elements, attribute escaping, or reordered package structures can invalidate assumptions while still producing a downloadable file.
- Fix approach: Parse XML with a namespace-aware library or constrain and validate a versioned template contract before and after mutation. Preserve XML escaping and add package referential-integrity checks.

**Analyzer does not match production selection:**
- Issue: The production generator selects frames by width alone (`cx > 914400`), while `analyze_pptx.cjs` logs “large” images only when both width and height exceed one inch.
- Files: `src/utils/pptxGenerator.js`, `analyze_pptx.cjs`
- Impact: The analyzer reports only five slide-3 upload targets even though production uses eight; maintainers can approve an incorrect template based on misleading diagnostics.
- Fix approach: Import one shared frame-selection function or make the analyzer apply the exact production predicate and assert per-slide slot counts.

**Documentation drift in crop invariant:**
- Issue: `CLAUDE.md` says two slide-3 upload frames have non-zero `<a:srcRect>` crops. In the current `public/template.pptx`, only the first of the eight width-qualified upload frames has a non-zero crop; the other non-zero crop belongs to a 0.29-inch decoy icon excluded by production.
- Files: `CLAUDE.md`, `public/template.pptx`, `src/utils/pptxGenerator.js`
- Impact: Image-layout debugging starts from an inaccurate invariant.
- Fix approach: Generate invariant documentation from the template-contract test, including frame name, dimensions, relationship ID, and crop.

## Known Bugs

**Late-activation policy check is reversed or attached to the wrong field:**
- Symptoms: Slide 2 is explicitly an ACES-versus-actual activation report and contains fixed text that ACES logged activation “within 1 Min.” The form warns that `activation_time < 60` means “nothing here to justify,” yet blocks `actual_activation_time >= 60`. This permits an actual activation below one minute and rejects the late actual activation that the comparison appears designed to document.
- Files: `src/components/Form.jsx` (late-activation rules around lines 247-258 and warning around lines 394-398), `public/template.pptx` (`ppt/slides/slide2.xml`), `CLAUDE.md`
- Trigger: Select Late Activation, enter `00:45` for Activation Time and `01:30` for Actual Activation, then submit. Generation is blocked because the actual value is at least 60 seconds. Reversing those values produces a deck despite the ACES column no longer matching the fixed “within 60 sec” statement.
- Workaround: None safe. Confirm the operational definition with an SCDF domain owner before changing code; then validate the ACES value against the fixed wording and the actual value against the late-activation criterion.

**Clock parser accepts impossible clock times:**
- Symptoms: `parseTimeToSeconds` accepts values such as `25:00`, `12:99`, negative components, decimals, and `1e2:00` because it checks only that components are finite numbers.
- Files: `src/components/Form.jsx` (lines 160-180)
- Trigger: Call the shipped parsing logic with an out-of-range value or set form state outside native `type="time"` constraints. The value is treated as valid and used in elapsed calculations.
- Workaround: Browser time controls reduce manual entry risk but are not a correctness boundary. Enforce integer hours `0-23`, minutes `0-59`, and seconds `0-59` in the parser.

**Duration parser accepts non-canonical and misleading values:**
- Symptoms: Despite the UI requiring `MM:SS`, the parser accepts three-part durations, negative components, decimal components, and seconds/minutes of 60 or more. Examples include `1:99`, `-1:30`, `1.5:00`, and `01:02:03`.
- Files: `src/components/Form.jsx` (lines 182-197), `CLAUDE.md`
- Trigger: Enter one of these strings in Activation, Actual Activation, or Response Time. It passes validation and is formatted as a plausible official figure.
- Workaround: Require a documented grammar such as non-negative integer minutes plus `00-59` seconds; decide explicitly whether hours are supported.

**Implausible backward times become almost-24-hour elapsed values:**
- Symptoms: Every negative difference is assumed to cross midnight. A simple reversed or mistyped pair such as Move Off `12:00` and Arrival `11:59` becomes `23 Hr 59 Min` expressed as `1439 Min`, rather than an error.
- Files: `src/components/Form.jsx` (lines 199-205 and 335-379)
- Trigger: Enter any later “from” clock with an earlier “to” clock outside a real midnight incident.
- Workaround: Validate elapsed values against operationally plausible maximums and require an explicit next-day indicator when ambiguity matters.

**Evidence upload can be silently ignored:**
- Symptoms: If the expected picture frame, slide `.rels`, relationship ID, or media target is missing, generation uses `continue` and still succeeds. The post-download warning counts only whether a `File` was selected, not whether it was inserted.
- Files: `src/utils/pptxGenerator.js` (lines 246-290), `src/components/Form.jsx` (lines 386-408)
- Trigger: Resize a target below one inch, reorder/delete a frame, alter its relationship, or change the target path in `public/template.pptx`; then upload a file for that slot.
- Workaround: None visible to the operator. Treat every selected-but-unplaced upload as blocking, return an insertion result per slot, and verify every rewritten relationship targets the new media part.

**Missing evidence preserves template imagery:**
- Symptoms: A skipped upload leaves the template’s existing picture in place. The warning appears only after the deck has already downloaded, so sample/placeholding artwork may be mistaken for incident evidence.
- Files: `src/utils/pptxGenerator.js` (lines 257-263), `src/components/Form.jsx` (lines 390-408), `public/template.pptx`
- Trigger: Generate with any evidence slot empty.
- Workaround: Inspect every deck manually. Prefer replacing unused targets with an unmistakable “EVIDENCE NOT PROVIDED” marker or block final report generation while offering an explicitly watermarked draft mode.

**Semantic contradictions are not checked in Late Response:**
- Symptoms: `y_n` defaults to `Y` and remains manually editable independently of `activation_time`. A user can print `Y` with activation at or above one minute. Response Time can be below eight minutes while Time Exceeded becomes negative, and `number_of_sftl` can disagree with populated SFTL sections.
- Files: `src/components/Form.jsx`, `public/template.pptx`
- Trigger: Enter contradictory values and submit; no blocking rule compares them.
- Workaround: Manually cross-check the output. Derive fields that are factual consequences and validate cross-field consistency for any field that remains editable.

## Security Considerations

**Restricted template is publicly retrievable:**
- Risk: The sole template contains `RESTRICTED` markings and operational content, yet Vite copies it verbatim to `dist/template.pptx`. Any person who can reach the deployed static site can request the template directly; there is no authentication or authorization.
- Files: `public/template.pptx`, `src/utils/pptxGenerator.js`, `vite.config.js`, `CLAUDE.md`
- Current mitigation: Processing is local and the code sends no incident data to a backend. This protects entered data in transit but does not protect the static template.
- Recommendations: Confirm the template’s classification and approved distribution boundary. If access must be restricted, host behind organizational authentication and access controls; do not rely on an obscure URL.

**Original evidence bytes and metadata are embedded unchanged:**
- Risk: Uploaded files are copied byte-for-byte into `ppt/media/`. EXIF/GPS/device metadata present in evidence photos can remain in the report and be disclosed to recipients.
- Files: `src/utils/pptxGenerator.js` (lines 274-286)
- Current mitigation: Files remain client-side until the user saves the generated deck.
- Recommendations: Define evidence-retention requirements. If metadata is not required, decode and re-encode supported images locally to strip metadata, with explicit tests that evidentiary quality is preserved.

**No content-security policy or deployment hardening is defined:**
- Risk: The app handles operationally sensitive text and images in a browser page. A compromised hosting origin or injected third-party script could read all form state and selected files.
- Files: `index.html`, `vite.config.js`, `package.json`
- Current mitigation: The current code has no analytics, remote API, or third-party runtime calls beyond bundled dependencies.
- Recommendations: Serve over HTTPS with a restrictive CSP, no third-party scripts, immutable hashed JS/CSS assets, and controlled dependency updates. Document the approved deployment origin.

## Performance Bottlenecks

**Unbounded in-memory upload processing:**
- Problem: Ten uploads may be selected with no per-file or aggregate size limit. Each is read into an `ArrayBuffer`, retained in React as a `File`, added to JSZip, and then the complete package is materialized again as a Blob.
- Files: `src/components/Form.jsx` (lines 150-156 and 504-514), `src/utils/pptxGenerator.js` (lines 274-308)
- Cause: Client-only generation and JSZip’s whole-package generation require multiple live copies; phone photos can be tens of megabytes each.
- Improvement path: Validate file size and decoded dimensions before generation, show an aggregate estimate, downscale/re-encode locally when policy permits, yield progress, and test on target mobile hardware.

**Synchronous XML and ZIP work has no progress/cancellation:**
- Problem: Fetching, parsing, rewriting, and compressing happens in the UI execution context behind a generic “Generating...” label.
- Files: `src/components/Form.jsx`, `src/utils/pptxGenerator.js`
- Cause: Generation is a single promise chain with no worker or stage callbacks.
- Improvement path: Move ZIP/image processing to a Web Worker or expose progress stages; add cancellation and prevent repeat generation after navigation/mode changes.

## Fragile Areas

**Positional picture-frame mapping:**
- Files: `src/utils/pptxGenerator.js`, `public/template.pptx`, `analyze_pptx.cjs`
- Why fragile: The current template has 10 width-qualified frames (1/1/8), but mapping uses `<p:pic>` document order, which is z-order rather than visual position. Re-adding or resizing a picture in PowerPoint can silently reorder or shift later evidence.
- Safe modification: Give target pictures stable semantic names in `p:cNvPr` and map by those names; at minimum assert exact per-slide counts, relationship types, and expected names before placing any upload.
- Test coverage: No committed automated template-contract test exists.

**Placeholder replacement:**
- Files: `src/utils/pptxGenerator.js`, `public/template.pptx`
- Why fragile: Literal replacement works only while each `{{key}}` remains contiguous in serialized XML. PowerPoint may split visible text across `<a:r>/<a:t>` runs after editing. Unknown or split placeholders remain in the official deck without an error.
- Safe modification: Replace placeholders over parsed text runs or enforce contiguity with a contract test; scan surviving output XML for `{{...}}` after replacement and fail generation if any remain.
- Test coverage: Current template placeholders are contiguous, but there is no regression test for split runs, unknown keys, long values, or XML control characters.

**Slide pruning:**
- Files: `src/utils/pptxGenerator.js` (lines 97-148), `public/template.pptx`
- Why fragile: Pruning assumes conventional paths, exact namespace prefixes (`p:`), self-closing relationship/override elements, one matched notes relationship, and direct presentation relationships. Future comments, handouts, sections, custom shows, or alternate OOXML serialization are not handled.
- Safe modification: Resolve relationships by type through parsed XML, remove all transitive slide-owned parts, and validate that every relationship and content-type override in the output resolves. Keep shared media unless reachability analysis proves it unused.
- Test coverage: The branch commit records an ad hoc real-template inspection, but no durable fixture asserts slide count, relationship integrity, content types, or opening in multiple office suites.

**Image format support:**
- Files: `src/utils/pptxGenerator.js`
- Why fragile: Format detection reads only selected magic bytes and then assumes PowerPoint interoperability for GIF, BMP, and TIFF. Animated GIFs, unusual TIFF encodings, corrupt/truncated files, and MIME/extension edge cases are not decoded or validated.
- Safe modification: Decode images before insertion or narrow support to formats verified across required office clients. Validate minimum header length and actual decodability.
- Test coverage: No format matrix is committed for PowerPoint, Google Slides, LibreOffice, or Keynote.

**Long free-text values:**
- Files: `src/components/Form.jsx`, `src/utils/pptxGenerator.js`, `public/template.pptx`
- Why fragile: Most text fields have no length limits and retain the template’s fixed text-box geometry and formatting. Long incident numbers, locations, appliance lists, or names can overflow, shrink unexpectedly, or obscure adjacent content.
- Safe modification: Define per-placeholder length/line constraints from rendered template tests and show validation before download.
- Test coverage: No rendered-output or visual regression checks exist.

## Scaling Limits

**Single static template and fixed report modes:**
- Current capacity: One 700,325-byte template, three numbered slides, two hard-coded report modes, and ten hard-coded upload slots.
- Limit: Adding/reordering slides, supporting a revised official form, or carrying more than three SFTLs requires coordinated edits across binary template and two source modules.
- Scaling path: Version templates and their schemas together, load a declarative manifest, and validate compatibility before allowing generation.

**Browser-only generation:**
- Current capacity: One report at a time in the active page with all state held in memory.
- Limit: Batch generation, autosave, audit trails, centralized template rollout, and controlled retention are not supported.
- Scaling path: Keep local processing if privacy requires it, but add versioned offline storage and signed template updates; consider a controlled backend only after explicit security review.

## Dependencies at Risk

**JSZip / FileSaver custom document pipeline:**
- Risk: The libraries provide ZIP and download primitives, not OOXML correctness. Most package-integrity responsibility remains in handwritten code.
- Impact: Library upgrades may pass lint/build while generated decks regress; cross-client rendering problems are outside the dependency guarantees.
- Migration plan: Keep dependencies pinned by `package-lock.json`, add artifact-level tests before upgrades, and evaluate an OOXML-aware generation library only if it can preserve the official template faithfully.

**Unverified dependency security posture:**
- Risk: No dependency audit or automated update workflow is present, and there is no CI configuration in the repository.
- Impact: Vulnerable transitive code executes in the same browser context as restricted incident data and evidence files.
- Migration plan: Add a reviewed lockfile-update process, dependency scanning in CI, and browser-side supply-chain controls. Treat scanner findings by exploitability rather than updating blindly.

## Missing Critical Features

**Pre-download review and final-vs-draft distinction:**
- Problem: The application downloads first and only then reports blank fields or missing evidence. The saved file has no visible draft watermark and may already contain template imagery.
- Blocks: Operators cannot reliably distinguish complete official reports from partial drafts at the point of creation.

**Template version/integrity indication:**
- Problem: Neither the UI nor filename records which template revision generated the report, and the fetch check validates only ZIP magic bytes.
- Blocks: Auditors cannot reproduce a report or prove it used the approved official form.

**Operational policy source of truth:**
- Problem: The eight-minute threshold and one-minute activation semantics are comments/constants without a cited, versioned policy artifact, and the live late-activation rule appears internally contradictory.
- Blocks: Code reviewers cannot determine correctness from repository evidence alone.

## Test Coverage Gaps

**Official-document business rules:**
- What's not tested: Parser ranges, midnight boundaries, plausible maximum elapsed time, threshold equality, negative Time Exceeded, cross-field contradictions, blank/partial drafts, and both late-activation sides of 60 seconds.
- Files: `src/components/Form.jsx`, `CLAUDE.md`
- Risk: Plausible but wrong measurements can ship in an official justification.
- Priority: High

**PPTX package integrity and pruning:**
- What's not tested: Placeholder exhaustion, stable frame mapping, selected-image insertion, media content types, dangling relationships, notes removal, slide order/count, and office-client compatibility.
- Files: `src/utils/pptxGenerator.js`, `public/template.pptx`, `analyze_pptx.cjs`
- Risk: Downloads may be corrupt, retain unintended parts, or silently show wrong evidence.
- Priority: High

**User interface and accessibility:**
- What's not tested: Keyboard flow, responsive layout, native time controls across browsers, file-picker errors, focus after validation, loading behavior, and screen-reader announcement of status.
- Files: `src/components/Form.jsx`, `src/components/FormInput.jsx`, `src/index.css`
- Risk: Status is a visually rendered `<div>` without `role="alert"`, `aria-live`, or programmatic focus; mobile users may miss errors/warnings below the long form. Two-column grids have no small-screen breakpoint.
- Priority: Medium

**Deployment artifact:**
- What's not tested: Root and sub-path hosting, MIME/cache headers for `template.pptx`, offline/fetch failures, asset integrity, and presence of the template in every release.
- Files: `vite.config.js`, `src/utils/pptxGenerator.js`, `public/template.pptx`
- Risk: The UI can deploy successfully while generation fails or uses a stale cached template.
- Priority: Medium

## Current Branch and Release State

**Feature branch not merged to local main:**
- Issue: The working branch is `feat/late-activation-mode` at `65b5583`, tracking `origin/feat/late-activation-mode`; it is six commits ahead of local `main`. Local `main` is itself reported three commits behind `origin/main`.
- Files: `.git/`, `CLAUDE.md`, `src/components/Form.jsx`, `src/utils/pptxGenerator.js`
- Impact: The mapped late-activation behavior is branch-specific and should not be assumed deployed. Release validation must run against the actual merge target and deployed commit.
- Fix approach: Reconcile with current `origin/main`, review the critical late-activation semantic defect, and rerun artifact-level tests after merge conflict resolution.

**Build health snapshot:**
- Issue: `npm run lint` and `npm run build -- --base=/LateResponse44/` pass on 2026-09-09, and the built artifact contains `dist/template.pptx`. These checks do not exercise report generation or open the resulting deck.
- Files: `package.json`, `eslint.config.js`, `vite.config.js`, `public/template.pptx`
- Impact: Green lint/build can create false confidence in official-output correctness.
- Fix approach: Gate release on executable business-rule tests plus generated-PPTX structural and rendered inspection.

---

*Concerns audit: 2026-09-09*
