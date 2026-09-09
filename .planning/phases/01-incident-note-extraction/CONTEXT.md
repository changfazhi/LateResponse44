# Phase 01 Context: Incident-Note Extraction

**Status:** Planning
**Created:** 2026-09-09
**User goal:** Add a Gemini-powered extraction assistant that turns pasted raw incident notes into reviewable proposals for the existing LateResponse44 form.

## Outcome

An authenticated user can paste raw incident notes, request extraction, review every proposed value beside its exact supporting note text, and explicitly apply selected values to the form. Existing deterministic validation, calculations, image uploads, and PPTX generation remain authoritative.

The feature is successful only when it saves manual entry time without allowing an unsupported or ambiguous model value to silently become part of an official report.

## Repository baseline

- The current application is a React 19 / Vite 7 static single-page application.
- It has no server, authentication, persistence, analytics, or AI dependency.
- `src/components/Form.jsx` owns form state, input parsing, report-mode validation, deterministic timing calculations, warnings, and generation orchestration.
- `src/utils/pptxGenerator.js` edits `public/template.pptx` locally in the browser and downloads the result.
- Evidence images and generated PPTX files do not leave the browser today.
- The local `CLAUDE.md` is authoritative. Its primary safety rule is that a missing value is preferable to a plausible but wrong value.

## Locked design decisions

1. Gemini is an assistive extractor, not an autonomous report-authoring agent.
2. Use the official `@google/genai` JavaScript SDK. Do not add LangChain, Google ADK, chat memory, tools, search, URL context, or function calling for Phase 1.
3. Never include a Gemini credential in Vite code, a `VITE_*` variable, the repository, or a browser request. All model calls go through a server-side endpoint.
4. Extraction returns a proposal. It never mutates the form automatically, chooses report eligibility, submits the form, or generates a PowerPoint.
5. The operator explicitly confirms the report mode before extraction. The form's current visual default does not count as confirmation unless `DECISIONS.md` deliberately approves that behavior. Gemini must echo the confirmed mode and must not change it.
6. Gemini extracts only facts explicitly supported by the submitted notes. Missing, ambiguous, conflicting, or unapproved shorthand returns `null` plus a warning.
7. Every non-null candidate must include a short exact evidence excerpt found verbatim in the submitted note. Evidence is necessary but not sufficient: deterministic validators must also accept the value.
8. Do not use model-reported confidence as an auto-acceptance gate. Use explicit statuses, evidence, validation, and human approval.
9. Gemini never supplies derived fields: `incident_no`, `rresponse_time`, `real_response_time`, `actual_response_time`, `time_exceeded`, or any `SFTL*_duration`.
10. Null candidates never erase existing user-entered values. Non-null candidates never overwrite them without explicit approval.
11. Evidence images remain manual browser uploads and are never sent to Gemini in Phase 1.
12. Raw notes remain in component memory only. They are not persisted, placed in URLs, analytics, traces, error reports, or application logs.
13. Manual form entry remains available during every extraction failure and is the permanent fallback.
14. The model ID, SDK, API version, prompt, and response schema are pinned and versioned. Any change requires the full evaluation suite.

## Provider boundary requiring a decision

Google's current documentation does not offer one verified path that simultaneously provides both of these properties:

- GA Interactions API lifecycle; and
- Vertex/ADC authentication and Google Cloud data controls.

Before provider implementation, the owner must select one supported production path:

### Path A: GA API lifecycle

- Cloud Run Node service.
- Paid Gemini Developer API.
- `@google/genai` Interactions API on explicit `v1`.
- `store: false` on every request.
- Use a current Gemini authorization key, not a legacy standard key. Bind it to a dedicated least-privileged service account, keep the key material only in Secret Manager, and expose it only to the Cloud Run service. Gate 0 must verify Google's September 2026 key transition behavior, rotation, and revocation in the intended project.
- Requires agency approval of the paid Developer API terms, processing region, abuse-monitoring retention, and any required ZDR exception.

### Path B: Google Cloud IAM and governance

- Cloud Run Node service with a dedicated service account and Application Default Credentials.
- Vertex AI / Gemini Enterprise backend.
- Use GA `generateContent` `v1` structured output for Phase 1, or accept the currently documented experimental Interactions route only with explicit approval.
- Requires confirmation of model availability, region, retention, request logging, implicit caching, and least-privilege IAM in the target project.

### Conditional path

Spike Vertex `v1` Interactions in the intended Google Cloud project. Adopt it only if both the request succeeds and current Google documentation or support confirms the lifecycle. An undocumented successful call is not sufficient.

Embedding a key in the browser, using unpaid Gemini for real notes, and treating CORS as authentication are rejected designs.

## Extractable field contract

### Late Activation

- `incident_number`
- `appliance_data`
- `activation_time`
- `actual_activation_time`

### Late Response

- `incident_number`
- `date`
- `time`
- `arrival_time`
- `move_off`
- `response_time`
- `activation_time`
- `actual_activation_time`
- `incident_type`
- `location`
- `appliance_data`
- `response_zone`
- `number_of_sftl`
- `sc`
- `po`
- `sftl1`, `SFTL1_redTime`, `SFTL1_greenTime`
- `sftl2`, `SFTL2_redTime`, `SFTL2_greenTime`
- `sftl3`, `SFTL3_redTime`, `SFTL3_greenTime`
- `y_n` only when explicitly stated, and always requiring operator confirmation until its source semantics are approved

## Required product behavior

1. Add an “Extract from notes” section before the current form fields.
2. Explain that notes are sent to the approved Google service; images and the PPTX remain local.
3. Accept pasted plain text only, with a visible character limit and clear button.
4. Disable extraction for blank or oversized notes.
5. Show progress without clearing the note or blocking manual entry.
6. Render results in a review panel grouped like the form.
7. For each candidate show current value, proposed value, exact evidence, validation state, and warning/ambiguity.
8. Default changed fields to unselected. Provide field-level selection and a safe “select all valid blank fields” action.
9. Never select conflicts, invalid values, ambiguous values, or overwrites by default.
10. “Apply selected fields” performs one React state update, then reruns the same client-side deterministic validation/derivation used by manual entry.
11. Keep applied-field provenance visible until the user edits that field, clears the notes, switches incident, or generates the report.
12. Do not download a presentation as a side effect of extraction or application.

## Decision gates before real-data development

1. Agency data owner confirms whether raw notes may leave the device and which classification they carry.
2. Security/governance owner approves the exact Gemini product, paid tier, contract, project, region, retention/ZDR configuration, caching, and logging posture.
3. Product owner selects provider Path A or Path B and the user-authentication/deployment design.
4. ACES/process owner defines the exact meaning and source authority of incident, dispatch, activation, actual activation, response, move-off, and arrival fields.
5. ACES/process owner defines `y_n` and whether “within one minute” includes exactly `01:00`.
6. Domain owner approves date ordering, timezone, seconds precision, compact timestamps, maximum plausible elapsed durations, and midnight rules.
7. Domain owner provides the approved abbreviation vocabulary and counterexamples.
8. Domain owner defines SFTL meaning, ordering, counting, repeated signals, and behavior above the three-entry template limit.
9. Product owner defines multi-appliance behavior; recommended default is explicit target-appliance selection before extraction.
10. Product owner confirms required versus optional fields for each report mode and the audit/provenance expectations for human approval.

Until gates 1–3 are approved, use synthetic notes only. Until gates 4–10 are approved, extraction results remain a non-production prototype and ambiguous mappings must abstain.

## Non-goals

- Reading evidence images, screenshots, PDFs, audio, email, or other documents.
- Automatically choosing a report mode or deciding whether an incident qualifies.
- Replacing existing validation or calculating report values with Gemini.
- Generating narrative remarks beyond fixed template content.
- Persisting notes or extraction history.
- Fine-tuning, RAG, web search, geocoding, or external tool use.
- Fully automating report submission or approval.

## Source material

- `CLAUDE.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONCERNS.md`
- `.planning/codebase/TESTING.md`
- `.planning/phases/01-incident-note-extraction/GEMINI-RESEARCH.md`
- `.planning/phases/01-incident-note-extraction/DOMAIN-RESEARCH.md`
