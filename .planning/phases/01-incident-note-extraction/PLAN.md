# Implementation Plan: Gemini Incident-Note Extraction

**Phase:** 01
**Status:** Goal-backward review passed; ready for Gate 0 decisions; not authorized for real incident data
**Plan date:** 2026-09-09
**Primary artifacts:** `CONTEXT.md`, `AI-SPEC.md`, `GEMINI-RESEARCH.md`, `DOMAIN-RESEARCH.md`, `EVAL-PLAN.md`
**Independent plan review:** PASS on 2026-09-09; no blocker or high-risk contradiction remained after two revision cycles.

## Goal

Build a secure, evaluated extraction assistant that proposes evidence-backed values from pasted incident notes, lets the user explicitly review and apply selected values, and leaves the existing deterministic report calculations and local PowerPoint generation in control.

## Recommended execution order

```text
Gate 0: governance + field semantics + provider choice
  -> Plan 1: testable shared report-domain foundation
  -> Plan 2: API contract and secure server skeleton
  -> Plan 3: Gemini adapter, prompt, validation, and D0/D1 evals
  -> Plan 4: review-and-apply frontend
  -> Plan 5: integration, privacy, security, and failure hardening
  -> Plan 6: locked D2 pilot gate
  -> Plan 7: canary, D4 review, D3 production gate, rollout
```

Plans 1–5 may use synthetic data only until governance approves the exact Google service. Plans 6–7 may not start without the corresponding decision records and approved data handling.

## Non-negotiable invariants

- No API key or Gemini SDK in the browser bundle.
- No unpaid Gemini use with real incident notes.
- No raw notes, values, or evidence in ordinary logs, traces, analytics, alerts, or Git.
- No model-generated derived report fields.
- No implicit overwrite, bulk application of conflicts, mode change, submission, or PPTX generation.
- Every selectable candidate is mode-allowed, evidence-grounded, normalized deterministically, and domain-valid.
- All failures preserve manual entry and the existing local PPTX path.
- Model/API/SDK/prompt/schema/validator changes require the evaluation promotion procedure.

---

## Gate 0 — Resolve authority, privacy, and deployment decisions

**Purpose:** Prevent implementation from encoding guessed SCDF semantics or transmitting restricted data through an unapproved service.

**Owner set:** Agency product owner, ACES/process owner, data-security/governance owner, operational report reviewer, and engineering owner.

### Task 0.1 — Create the decision record

Create `.planning/phases/01-incident-note-extraction/DECISIONS.md` with named approvers, decision dates, evidence/links, and one entry for each item below:

1. Data classification of raw incident notes and permitted test data.
2. Permission for notes to leave the device.
3. Approved Google product/tier, billing project, contract/DPA, region, residency, abuse monitoring, ZDR, implicit caching, and request/response logging settings.
4. Provider adapter:
   - Path A: paid Developer API `v1` Interactions + current authorization key bound to a dedicated least-privileged service account and held in Secret Manager + `store:false`; or
   - Path B: Vertex ADC + GA `generateContent` `v1`; or
   - explicitly accepted pre-GA pilot path.
5. Hosting and identity: recommended same-origin Cloud Run behind organizational identity/IAP.
6. Exact semantic/source mapping for `time`, `response_time`, `activation_time`, `actual_activation_time`, `move_off`, and `arrival_time`.
7. Source authority when ACES, officer notes, and photo annotations conflict.
8. `y_n` source and whether exactly `01:00` means “within one minute.”
9. Approved date, time, duration, timezone, precision, and compact-format rules.
10. Approved abbreviations, ranks, appliance formats, zones, incident types, and counterexamples.
11. SFTL meaning, count, order, repeated events, derivation, and more-than-three behavior.
12. Multi-appliance UX: recommended explicit target selection before extraction.
13. Required/optional fields and block/warn/allow behavior for each report mode.
14. Human approval audit requirements and evidence lifetime.
15. Maximum plausible travel, activation, response, and SFTL durations.

**Done when:** Every item is approved, rejected, or explicitly deferred. Deferred field rules force model abstention and manual review; deferred data/provider rules prohibit real-data use.

### Task 0.2 — Validate the provider path in an isolated project

Create a throwaway spike outside production data flows using one synthetic note:

- pin Node 22 and the exact current `@google/genai` version;
- authenticate using the candidate production mechanism;
- for Developer API, prove the September 2026 authorization-key flow, key-to-service-account binding, least-privilege permissions, rotation/revocation, and rejection of the legacy standard-key assumption;
- call the chosen stable model with the chosen GA/pre-GA API version;
- request a tiny JSON Schema response;
- prove the no-storage setting where applicable;
- record model availability in the approved region;
- inspect platform logging to prove request/response bodies are absent;
- record latency, token usage, errors, API lifecycle, and SDK syntax;
- destroy any temporary key and delete test interaction/log data where supported.

Write the outcome into `DECISIONS.md`; do not commit credentials or cloud-generated configuration containing identifiers.

**Hard stop:** If governance disallows external processing or the required region/ZDR posture is unavailable, stop the Gemini implementation. Preserve this plan for a future approved local/on-prem model evaluation.

### Task 0.3 — Establish the domain review group and data path

- Name two annotators plus one adjudicator as specified in `EVAL-PLAN.md`.
- Approve the annotation guide and enum vocabulary.
- Define a controlled location outside Git for approved-redacted D2/D3/D4 material.
- Establish deletion dates and access review.
- Start D0/D1 with synthetic cases only.

**Gate 0 verification:** Product, process, and security owners sign `DECISIONS.md`. Engineering confirms that no real note has been sent during planning/spike work.

---

## Plan 1 — Extract and test the deterministic report domain

**Why first:** Model output cannot be trusted until the current form's field rules are importable, strict, and covered by repeatable tests. Today they are nested inside `Form.jsx`, and some parsers accept impossible component ranges.

### Task 1.1 — Add the test foundation

Modify:

- `package.json`
- `package-lock.json`
- `eslint.config.js` only if test globals require it

Add:

- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `jsdom`
- `@playwright/test`

Add scripts:

- `test`: one-shot Vitest run suitable for CI;
- `test:watch`: local watch mode;
- `test:coverage`: coverage with explicit thresholds after the baseline suite exists;
- `test:template`: real-PPTX invariant suite;
- `test:e2e`: Playwright browser workflow using the deterministic fake provider;
- `eval:d0`: deterministic extraction contract suite added in Plan 3.

Align the stale root `package-lock.json` project name with `package.json` while touching the lockfile.

**Tests:** Prove a deliberately failing test fails, then restore it. Ensure `npm run lint`, `npm test`, and `npm run build` all exit zero.

### Task 1.2 — Centralize the report field contract

Create dependency-free `shared/reportFields.js` as the single canonical browser/server field contract, containing:

- canonical source field names;
- per-mode field allowlists;
- criticality (`critical`, `noncritical`, `manual`);
- field input type (`date`, `clock`, `duration`, `identifier`, `text`, `count`, `enum`);
- derived-field denylist;
- image-field denylist;
- user-facing labels;
- manual-confirmation flags;
- initial-value provenance (`default`, `manual`, `extracted`) so a convenient default is never mistaken for a reviewed fact;
- mode helpers currently split across `Form.jsx` and `pptxGenerator.js`.

Refactor `Form.jsx` and `pptxGenerator.js` to import rather than duplicate relevant field/mode facts. The server schema generator and validators must import this same module; do not create a second server field list. Keep slide-part and upload-frame details in the generator module.

Create `tests/domain/reportFields.test.js` asserting:

- every form key is classified once;
- every PPTX placeholder is supplied, derived, or explicitly static/manual;
- Late Activation exposes exactly four source fields;
- derived/image keys never enter extraction allowlists;
- report-mode keys stay aligned with `REPORT_MODES`.

### Task 1.3 — Extract strict time and normalization functions

Create dependency-free `shared/time.js` and move/refactor:

- `splitTimeParts`;
- clock parsing/formatting;
- duration parsing/formatting;
- local date creation;
- `elapsedBetween`.

Enforce:

- clocks only `00..23:00..59[:00..59]`;
- durations use approved explicit formats, seconds `00..59`, non-negative, and approved upper bounds;
- no `NaN` return values;
- no invented seconds when source precision is minute-only;
- explicit metadata for negative-before-wrap and rollover instead of blindly treating every reversed pair as a valid next-day event.

Create `tests/domain/time.test.js` covering valid/invalid components, leap dates, whitespace, bare numbers, compact formats, explicit units, midnight, boundaries, and implausible wraps.

### Task 1.4 — Extract deterministic report processing

Create dependency-free `shared/processReport.js` containing pure functions for:

- `findBlockingProblems`;
- mode-filtered completeness warnings;
- source-input normalization;
- real response time;
- actual response time;
- time exceeded;
- SFTL durations;
- the `incident_no`/`rresponse_time` aliases.

Make `Form.jsx` call this module for manual entry and later AI-applied values. Preserve existing behavior except for separately documented range/implausibility fixes.

Resolve the current high-risk defaults as part of this refactor: `y_n` currently starts as `Y`, and `date` starts as today. After Gate 0 defines requiredness, make `y_n` explicitly unselected until the user confirms it. Track the date default as unconfirmed provenance so a historical or date-absent extracted note cannot silently inherit today's date as a reviewed fact. Add generation block/warn behavior exactly as approved in `DECISIONS.md`.

Create `tests/domain/processReport.test.js` for both modes, partial pairs, midnight, exact thresholds, negative time exceeded, Late Activation contradictions, and no-fabricated-value guarantees.

### Task 1.5 — Convert template inspection into assertions

Replace or supplement `analyze_pptx.cjs` with a repeatable test that uses the same width-only frame rule as production and the real `public/template.pptx`.

Assert:

- slide count and required parts;
- placeholder/field parity;
- 1/1/8 upload-target frame counts;
- exact ordered relationship targets;
- shared-media behavior;
- crop invariants;
- image content types;
- both report-mode pruning outcomes.

### Task 1.6 — Establish continuous integration

Create `.github/workflows/ci.yml` with least-privilege read-only permissions. On pull requests and the protected main branch it must install pinned client/server dependencies, then run client/server lint, unit/component/API tests, the production build, template/PPTX assertions, and the Playwright fake-provider workflow. Activate `eval:d0` in this same workflow in Plan 3.

CI must never call live Gemini, receive provider credentials, or load approved-redacted/real incident notes. Add a deliberate test proving the browser workflow works with extraction disabled.

**Plan 1 done when:** Business logic is no longer trapped inside the React component; manual behavior passes old and new regression cases; the real template contract is asserted; lint/test/build pass.

**Suggested atomic commits:**

1. `test: add repeatable domain and component test harness`
2. `refactor: centralize report field and time contracts`
3. `refactor: share deterministic report processing`
4. `test: assert live PowerPoint template invariants`
5. `ci: enforce synthetic extraction quality gates`

---

## Plan 2 — Define the API contract and secure server skeleton

### Task 2.1 — Add the isolated server package

Create:

- `server/package.json` and lockfile;
- `server/src/app.js`;
- `server/src/config.js`;
- `server/src/errors.js`;
- `server/src/metrics.js`;
- `server/src/auth/authorize.js`;
- `server/src/routes/extractions.js`;
- `server/test/`.

Recommended dependencies:

- `express` for the HTTP boundary;
- `helmet` for response headers;
- `express-rate-limit` or an approved distributed limiter;
- `zod` for request/public-response validation;
- `@google/genai` only when Plan 3 starts;
- `google-auth-library` when verifying IAP/OIDC tokens is not already supplied by the approved platform adapter.

Use exact dependency versions and Node 22. Do not enable body/request logging. Configure Express so JSON parsing is limited before route logic.

Add root scripts for `server:test`, `server:lint`, and `server:dev` without weakening client lint/build scripts.

### Task 2.2 — Implement configuration validation

`server/src/config.js` must fail at startup when required values are missing or inconsistent:

- environment (`development`, `test`, `production`);
- selected provider adapter;
- model/API/SDK/prompt/schema versions;
- Google project/location or Secret Manager reference;
- request byte limit;
- timeout/retry limits;
- rate/quota settings;
- extraction feature flag;
- permitted origins only if cross-origin deployment was approved.

Reject secrets whose names or configuration would expose them to Vite. Do not print config values containing project identifiers or secrets in startup logs.

### Task 2.3 — Implement the public contract and runtime capability flag with a fake provider

Add `POST /api/extractions` using the request/response/error shape in `AI-SPEC.md`, backed only by a deterministic fake provider.

Add `GET /api/config`, returning only the public schema version and `extractionEnabled` with `Cache-Control: no-store`. Do not expose the provider, model, project, credentials, quotas, or deployment metadata. When the kill switch is off, this endpoint must remain available and report extraction disabled while static/manual report generation continues.

The route order is:

1. kill switch;
2. authentication;
3. authorization;
4. content type/body size;
5. request schema;
6. rate/quota limit;
7. extraction service;
8. response schema;
9. safe error mapping.

The fake provider allows full contract, auth, and UI development without sending data externally.

### Task 2.4 — Add security and privacy contract tests

Test:

- unauthenticated/unauthorized requests;
- spoofed identity headers;
- CORS not granting authorization;
- wrong content type, blank note, malformed Unicode/JSON, oversized note/body, unsupported mode, extra request fields;
- rate-limit and timeout responses;
- no provider error body or stack trace in responses;
- no request/response body passed to logger/metrics mocks;
- `Cache-Control: no-store` and security headers;
- kill switch leaves static manual app available;
- static template remains served at the correct base path.

**Plan 2 done when:** A synthetic request can travel through the authenticated contract to a fake proposal, no sensitive content is logged, and the manual app still builds/serves normally.

**Suggested atomic commits:**

1. `build: add isolated Node extraction service`
2. `feat: define authenticated extraction API contract`
3. `test: enforce API privacy and security boundaries`

---

## Plan 3 — Implement Gemini extraction and layered validation

### Task 3.1 — Freeze versioned field schemas

Create:

- `shared/extractionContract.js` for the public request/response schemas;
- `server/src/extraction/schema.js`, generated from `shared/reportFields.js`;
- `server/test/contract/schema.test.js`.

Generate a reduced provider schema per report mode. Each allowed field key is required but nullable. Disallow extra keys at all object levels. Include bounded evidence and issue arrays.

Each evidence item must include field, raw value, verbatim excerpt, approved source label, and disposition. Permit evidence for a null field only when it represents ambiguity, conflict, correction/supersession, negation, unavailability, boilerplate/example text, or a hypothetical. This preserves alternatives without allowing the model to choose silently.

Keep the provider schema simple enough for Gemini's supported JSON Schema subset. Validate the same decoded object with Zod. Add tests proving every extra, missing, wrong-type, oversized, forbidden-derived, out-of-mode, and mismatched-mode response is rejected.

Version the provider schema separately from the public API response schema. Add a parity test proving the form keys, merge allowlists, provider schema, public response schema, and server validator all derive from `shared/reportFields.js`; the build fails on drift.

### Task 3.2 — Build the versioned prompt

Create `server/src/extraction/prompt.js` with:

- `PROMPT_VERSION`;
- server-owned system instruction from `AI-SPEC.md`;
- server-owned report-mode/target-appliance context;
- random per-request delimiters;
- note data inserted only in the delimited data section.

Do not add real notes or few-shot examples. Add prompt snapshot/contract tests that assert no secret, derived field, or client-supplied instruction enters the system/configuration section.

### Task 3.3 — Implement provider adapter

Create `server/src/providers/gemini.js` and use only the provider path approved in Gate 0.

Common requirements:

- exact stable model ID;
- exact API version;
- one non-streaming structured-output call;
- `low` thinking baseline;
- output limit 2,048 tokens;
- a 28-second absolute server deadline, with each attempt capped at `min(15 seconds, remaining budget minus 2 seconds)`, plus cancellation;
- no tools, search, URL context, File API, chat state, background work, or explicit cache;
- `store:false` asserted for Interactions;
- no provider object or content emitted to logs.

Add a provider-interface contract test using a fake SDK. Add an opt-in live synthetic smoke test that is excluded from ordinary CI, costs one bounded call, verifies version/configuration, and never reads real fixtures.

### Task 3.4 — Implement validation and response assembly

Create:

- `server/src/extraction/validate.js`;
- `server/src/extraction/extract.js`;
- `server/test/integration/extract.test.js`.

Implement all 14 validation stages from `AI-SPEC.md`. In particular:

- locate evidence offsets server-side;
- require every raw observation within its evidence and every excerpt within the note;
- require a non-null field to agree with exactly one current asserted/correction observation, while preserving conflicting/superseded observations as non-selectable evidence;
- normalize only through approved deterministic functions;
- reject invalid/range/implausible values;
- bind event/source/entity/SFTL context;
- preserve corrections/conflicts as non-selectable issue codes;
- return no provider prose;
- deny derived and image fields at multiple layers.

Prefer safe partial proposals: reject only affected fields unless the entire response/mode/identity contract is untrustworthy.

Do not implement an output-repair model call in the initial version. Measure schema/domain failure first; add one bounded repair call only through a future evaluated decision.

### Task 3.5 — Implement retries and safe errors

- One application-owned retry mechanism.
- Disable SDK-level retries and prove it in the provider-interface test.
- Maximum two provider attempts total for transient network/`408`/`429`/retryable `5xx` failures; start the one retry only when at least 5 seconds remain.
- Full jitter around 1 second; honor `Retry-After` only when it fits the same absolute deadline.
- No retry on safety block, auth, invalid input, schema/domain failure, or nonretryable `4xx`.
- Map failures to stable public codes and manual fallback.
- Emit only content-free attempt/latency/token/error metrics.

### Task 3.6 — Build D0 and D1 evaluation harness

Create the `evals/` structure from `AI-SPEC.md` and implement the annotation schema from `EVAL-PLAN.md`.

- Write all 72 minimum D0 deterministic/adversarial cases.
- Build 160 D1 notes, starting synthetic.
- Add scorer output by field, criticality, mode, and stratum.
- Report counts, Wilson intervals, S0/S1/S2 failures, latency, tokens, and cost separately for raw provider output and service-delivered proposals.
- Require zero wrong critical values in service-delivered proposals (100% service critical precision); raw provider mistakes may be counted below that only when validation safely rejects them before the browser response.
- Make `eval:d0` mandatory in CI.
- Keep live-model D1 runs opt-in and ensure output artifacts contain only synthetic data or live outside Git when approved-redacted.

**Plan 3 done when:** Gemini can turn synthetic notes into fully validated proposals; invalid/ambiguous content abstains; D0 has zero S0 and all contract cases pass; D1 has a documented error analysis but is not treated as a release gate.

**Suggested atomic commits:**

1. `feat: define versioned extraction schemas and prompt`
2. `feat: add pinned Gemini extraction adapter`
3. `feat: validate evidence and incident field proposals`
4. `feat: add bounded retries and safe extraction errors`
5. `test: add deterministic and calibration extraction evals`

---

## Plan 4 — Build the review-and-apply frontend

### Task 4.1 — Add a client API boundary

Create `src/features/noteExtraction/extractionClient.js`:

- fetch and validate same-origin `GET /api/config` with no-store semantics before enabling extraction;
- POST only to same-origin `/api/extractions`;
- send notes, selected mode, and explicit target appliance only;
- 30-second abort timeout;
- validate public response version/shape before use;
- expose stable user-facing errors;
- never log note, response, evidence, or field values.

If the runtime capability flag is false or invalid, show a quiet manual-only state. Re-check it only on an explicit user retry; no new frontend deployment should be necessary to disable extraction.

### Task 4.2 — Model extraction UI state explicitly

Create `src/features/noteExtraction/extractionState.js` using a reducer for:

- idle/editing/extracting/ready/partial/error/stale states;
- note and proposal revision IDs;
- explicit report-mode confirmation, separate from the current visual default;
- selected proposal keys;
- overwrite confirmations;
- stale-result invalidation on note/mode/mode-confirmation/target changes;
- clear/retry/reject/apply transitions.

Unit-test every transition. Make illegal transitions no-ops or explicit errors; applying is impossible outside a current validated proposal.

### Task 4.3 — Build note entry and disclosure UI

Create `NoteExtractionPanel.jsx` and styling:

- plain-text textarea with character/byte guidance;
- network/privacy disclosure matching the approved provider;
- report-mode context and target-appliance selector when required;
- an explicit mode confirmation action before extraction; merely rendering the current default does not authorize a request unless Gate 0 records an approved default policy;
- extract, retry, and clear controls;
- progress/error status with accessible live regions;
- manual-entry path always visible;
- responsive one-column narrow layout.

Do not persist to local/session storage. Do not put notes in the URL. Clearing must erase component state references.

### Task 4.4 — Build the review panel

Create `ExtractionReview.jsx`:

- group fields like the existing form;
- show current value -> proposed value;
- show exact evidence and validation/warning status;
- safely highlight using server-validated offsets;
- default all changed fields unselected;
- allow “select all valid blank fields” only;
- require per-field confirmation for overwrites and `y_n`;
- make ambiguous/conflicting/rejected/manual fields non-selectable;
- provide reject-all and return-to-note actions.

Render all content as text nodes. No model Markdown/HTML.

### Task 4.5 — Integrate with `Form.jsx`

- Keep `formData` and images owned by `Form` for this phase.
- Add the extraction panel above the manual inputs.
- Pass only the field snapshot, selected mode, and a constrained apply callback.
- Implement pure `shared/mergeExtraction.js` using the canonical allowlist and selected keys.
- Apply in one `setFormData` update.
- Never apply null or derived/image/out-of-mode keys.
- Clear an applied provenance badge when the user edits that field.
- Do not call `handleSubmit` or `generatePPTX` from extraction components.

### Task 4.6 — Component and accessibility tests

Automate all 15 UI gates in `EVAL-PLAN.md` where possible. Add Playwright coverage for the full fake-provider browser workflow, including config enabled/disabled, mode confirmation, success, safe partial response, invalid public response, timeout, stale result, selective apply, overwrite confirmation, manual fallback, and proof that extraction never downloads a file. Add manual acceptance scripts for:

- keyboard-only review/apply/reject/manual entry;
- screen-reader labels/live status/evidence association;
- desktop and supported narrow viewport;
- mode switch and stale proposal;
- extraction timeout/provider block/invalid output;
- empty current value versus overwrite;
- applying source times and observing deterministic derived values;
- confirming no extraction action downloads a file.

**Plan 4 done when:** A fake or validated synthetic proposal can be reviewed and selectively applied without violating any merge, accessibility, or generation invariant.

**Suggested atomic commits:**

1. `feat: add incident note extraction client and state`
2. `feat: add accessible note extraction panel`
3. `feat: add evidence-backed proposal review`
4. `feat: safely merge approved proposals into the form`
5. `test: cover extraction review and manual fallback flows`

---

## Plan 5 — Integrate, harden, document, and prepare deployment

### Task 5.1 — End-to-end synthetic integration

Test through the real frontend and server with Playwright and synthetic notes. Use the deterministic fake provider in CI and a separately authorized opt-in live synthetic smoke job outside ordinary CI:

- both report modes;
- clear/partial/ambiguous/conflicting notes;
- all supported fields;
- midnight and threshold boundaries;
- multiple appliances;
- 0/1/3/>3 SFTLs;
- prompt-injection and safety-sensitive language;
- provider timeout/rate limit/block/malformed output;
- apply selected values, edit one, run existing validation, and generate/open the real PPTX.

Assert images never enter API requests and note text never enters the PPTX unless it is an explicitly accepted source field.

### Task 5.2 — Container and same-origin deployment

Create:

- multi-stage `Dockerfile`;
- `.dockerignore` excluding `.git`, notes/eval outputs, credentials, logs, temp PPTX extraction, and local environment files;
- production static serving with SPA fallback that does not rewrite `/api/*` or missing `template.pptx` to HTML;
- health/readiness endpoints that reveal no configuration;
- deployment configuration/documentation using the approved identity path.

The final container must include `dist/template.pptx`. Verify root and configured sub-path behavior or deliberately retire sub-path static deployment with a documented migration.

### Task 5.3 — Security verification

- Scan browser assets/source maps for API keys, project secrets, SDK server code, raw fixtures, prompts, and forbidden environment variables.
- Run dependency audits separately for production client and server packages.
- Test auth bypass, replay, direct endpoint calls, CORS, body bombs, oversized Unicode, request smuggling protections supplied by platform, and rate-limit behavior.
- Verify least privilege, Secret Manager/IAM access, TLS, security headers, no-store response caching, disabled request-body logging, and billing/quota alerts.
- Verify the runtime `GET /api/config` kill switch disables only extraction in an already-deployed client, needs no frontend rebuild, and fails closed to manual-only mode when missing or malformed.
- Document incident response and key/service-account rotation.

### Task 5.4 — Update repository and user documentation

Update:

- `README.md` with architecture, local setup, synthetic-only development, server start, approved secrets, test/eval commands, and deployment;
- `CLAUDE.md` to replace the “nothing leaves the machine” statement with the exact note-processing boundary while preserving local image/PPTX behavior;
- `.env.example` containing names only, never values;
- operational runbook covering metrics, alerts, quotas, model/SDK deprecations, kill switch, rollback, and privacy review;
- annotation/evaluation README with prohibited data rules.

### Task 5.5 — Full pre-pilot verification

Run:

- client/server lint;
- all unit/component/API/integration tests;
- D0;
- production build and container smoke test;
- real template invariant/PPTX package tests;
- dependency/security checks;
- secret scan;
- manual accessibility and cross-renderer PPTX checks.

Record exact versions and outputs in a release evidence file that contains no incident content.

**Plan 5 done when:** The entire synthetic workflow is deployable, reversible, observable without content, documented accurately, and approved to enter the locked pilot evaluation.

---

## Plan 6 — Build the locked D2 set and pass the pilot gate

### Task 6.1 — Freeze data and candidate

- Complete D2 with 240 notes and exact strata/minima from `EVAL-PLAN.md`.
- Include at least 120 approved-redacted notes or prohibit an operational pilot.
- Double-annotate and adjudicate every note.
- Meet annotation agreement gates.
- Freeze dataset manifest, model, API, SDK, prompt, schemas, validators, retry behavior, and app revision.
- Remove any viewed holdout case to D1 and replace it before scoring.

### Task 6.2 — Execute the pilot gate

Run D0 and one blind D2 pass. Produce per-field/mode/stratum metrics and review:

- every false positive;
- every event/entity/source mismatch;
- every prompt-injection case;
- every S0/S1;
- random 10% of correct predictions/abstentions, minimum 40.

Require every pilot threshold in `EVAL-PLAN.md`, including:

- zero S0;
- zero wrong critical values in service-delivered proposals (100% service critical precision), with raw-provider and post-validation service metrics reported separately;
- raw-provider critical micro precision >=99.0%;
- raw-provider precision for each sufficiently sampled critical field >=98.0%;
- raw-provider critical recall >=92.0%;
- raw-provider correct abstention >=97.0%;
- 100% mechanical evidence, mode, derived-field, and injection safety;
- all UI/security/privacy gates.

### Task 6.3 — Domain/security pilot sign-off

Operational reviewers approve failure analysis and UI. Security/governance confirms deployed configuration matches `DECISIONS.md`. Record a go/no-go decision; no threshold is waived through aggregate averages.

**Plan 6 done when:** The locked pilot gate passes, named owners approve, and a 10% authorized canary is scheduled with kill switch and rollback ready.

---

## Plan 7 — Canary, production evaluation, and rollout

### Task 7.1 — Run controlled canary and D4

- Enable extraction for 10% of an approved small user population.
- Continue manual review and normal report validation.
- Run at least seven days and 200 successful requests.
- Adjudicate the first 100 authorized completed incidents as D4 outside ordinary telemetry.
- Stop immediately on any S0, content leakage, auth/key exposure, storage violation, silent overwrite, or generation side effect.

### Task 7.2 — Build and pass an independent D3

- Build a wholly new 400-note locked set with at least 220 approved-redacted and at most 180 synthetic; do not reuse or copy any D2 note.
- Independently reproduce every D2 stratum minimum and replace any D3 case exposed to prompt authors before final scoring.
- Meet per-field minimum denominators.
- Run identical frozen configuration three times.
- Require every production threshold on every run and pooled output:
  - zero S0;
  - zero wrong critical values in service-delivered proposals (100% service critical precision), with raw-provider metrics kept distinct;
  - raw-provider critical micro precision >=99.5%;
  - raw-provider precision for each established critical field >=99.0%;
  - raw-provider critical recall >=95.0%;
  - raw-provider correct abstention >=99.0%;
  - raw-provider semantic evidence precision >=99.5%;
  - mode/derived/injection safety 100%;
  - D4 critical edit-after-apply <=0.5% and no S0.

### Task 7.3 — Production rollout

- Confirm no rollback trigger during canary.
- Promote gradually; retain previous container and version bundle.
- Enable approved aggregate monitoring, monthly secure sampling, weekly D0, monthly D3, budget alerts, provider deprecation alerts, and security reviews.
- Keep extraction kill switch and manual form permanently available.

**Plan 7 done when:** Production gates pass, owners sign off, rollout completes without trigger, and recurring evaluation/operations have named owners and calendar commitments.

---

## Cross-plan verification matrix

| Requirement | Primary proof |
|---|---|
| No browser secret/SDK | bundle scan, client dependency graph, API architecture test |
| Approved data handling | `DECISIONS.md`, cloud config evidence, security sign-off |
| Correct field ownership | `reportFields.test.js`, schema denylist/mode tests |
| Strict time semantics | `time.test.js`, D0 temporal/boundary strata |
| No fabricated derived values | provider schema tests, service denylist, D0/D2/D3 100% isolation |
| Evidence grounding | server substring/offset tests, 100% mechanical evidence metric |
| Correct event/entity binding | D2/D3 attribution and multi-entity strata |
| Honest abstention | D2/D3 correct-abstention and false-fill thresholds |
| Safe merge | reducer/merge tests and 15 UI gates |
| No automatic report generation | component spies and end-to-end flow |
| Manual fallback | every error-path test and uptime check |
| No content telemetry | logger/trace mocks, deployed log inspection, security review |
| Model change safety | pinned bundle + D0/D3 three-run promotion procedure |
| Rollback | kill-switch test and rollback rehearsal |

## Definition of done

This phase is not done when Gemini returns plausible JSON. It is done only when:

1. domain and governance decisions are explicit;
2. manual and model-applied data share strict deterministic processing;
3. the provider is isolated server-side and version-pinned;
4. every selectable value is grounded, normalized, validated, and reviewable;
5. no extraction action can silently change or generate an official report;
6. D0, D2, D3, D4, security, privacy, UI, and real-PPTX gates pass at the required stage;
7. production can be disabled or rolled back without disabling manual report creation.

## Immediate next five actions

1. Schedule a 60-minute decision session with the product owner, ACES/process owner, operational reviewer, security/governance owner, and engineer; work through Gate 0 and assign unresolved entries.
2. Create `DECISIONS.md` and select either paid Developer Interactions `v1` or Vertex `generateContent` `v1`; do not mix an unverified API lifecycle with production claims.
3. Obtain 10–20 invented or approved-redacted representative note patterns and have two operational users label them using the field dictionary in `DOMAIN-RESEARCH.md`.
4. Execute Plan 1: add Vitest, extract the field/time/report logic from `Form.jsx`, correct range validation, and lock the real PPTX template invariants.
5. Only after those foundations pass, execute Plan 2 with a fake provider; connect Gemini in Plan 3 after the privacy/provider gate is signed.
