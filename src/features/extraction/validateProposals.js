// Everything Gemini returns passes through here before a human sees it.
//
// The model is a helpful stranger, not a trusted source. A finding is demoted
// rather than the batch being thrown away, so one bad value does not cost the
// operator the other fifteen good ones. Only `valid` proposals can be applied.

import {
    extractableFieldsFor,
    FIELD_LABELS,
    FIELD_TYPE,
    REPORT_FIELDS,
} from '../../domain/reportFields';
import { normalizeClock, normalizeDate, normalizeDuration } from '../../domain/time';

const MAX_TEXT_LENGTH = 200;

// A ceiling on how much a single response can propose. The provider schema
// cannot express this (see buildSchema), so it is enforced here — a runaway
// response should not turn into a thousand-row review panel.
const MAX_FINDINGS = 40;

// Whitespace and case are the two things that differ harmlessly between a note
// and a quote of it. Everything else must match.
const flatten = (str) => str.replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeText = (raw) => {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value) return null;
    // A model that drops a paragraph into Location has misunderstood the field;
    // the template has one line for it.
    if (value.length > MAX_TEXT_LENGTH) return null;
    return value;
};

const normalizeCount = (raw) => {
    const value = raw.trim();
    return /^\d{1,2}$/.test(value) ? String(Number(value)) : null;
};

const NORMALIZERS = {
    clock: normalizeClock,
    duration: normalizeDuration,
    date: normalizeDate,
    count: normalizeCount,
    text: normalizeText,
};

const REJECTION_REASON = {
    clock: 'not a valid time (expected HH:mm or HH:mm:ss)',
    duration: 'not a valid duration (expected MM:SS)',
    date: 'not an unambiguous date',
    count: 'not a whole number',
    text: 'empty or too long for this field',
};

const FIELD_ORDER = REPORT_FIELDS.map(([key]) => key);

/**
 * @param {Array} findings  raw `findings` from the model
 * @param {string} notes    the exact text that was submitted
 * @param {string} mode     report mode the extraction was run for
 * @returns {Array} proposals: { field, label, rawValue, value, evidence, status, reason }
 *                  status is 'valid' | 'rejected' | 'conflicting'
 */
export const validateProposals = (findings, notes, mode) => {
    if (!Array.isArray(findings)) return [];

    const allowed = extractableFieldsFor(mode);
    const flatNote = flatten(notes || '');
    const proposals = [];

    for (const finding of findings.slice(0, MAX_FINDINGS)) {
        // 1. Shape.
        if (
            !finding ||
            typeof finding.field !== 'string' ||
            typeof finding.value !== 'string' ||
            typeof finding.evidence !== 'string'
        ) {
            continue;
        }

        const { field, value: rawValue, evidence } = finding;

        // 2. Allowlist. The response schema's enum should already have made this
        // impossible; it is checked again because a derived field reaching the
        // form is the one failure this feature must not have.
        if (!allowed.includes(field)) continue;

        const base = {
            field,
            label: FIELD_LABELS[field] || field,
            rawValue,
            evidence,
            value: null,
            status: 'rejected',
            reason: '',
        };

        // 3. Grounding. This is what separates a reading from a plausible
        // invention: the quoted span has to actually be in the note, and the
        // value has to be inside the span that supposedly supports it.
        if (!evidence.trim() || !flatNote.includes(flatten(evidence))) {
            proposals.push({ ...base, reason: 'the quoted evidence is not in the note' });
            continue;
        }
        if (!flatten(evidence).includes(flatten(rawValue))) {
            proposals.push({ ...base, reason: 'the value does not appear in its own evidence' });
            continue;
        }

        // 4. Normalization. The model hands back note text; the deterministic
        // parsers decide whether it is a value this form can hold.
        const type = FIELD_TYPE[field];
        const value = NORMALIZERS[type](rawValue);
        if (value === null) {
            proposals.push({ ...base, reason: REJECTION_REASON[type] });
            continue;
        }

        proposals.push({ ...base, value, status: 'valid', reason: '' });
    }

    // 5. Conflict. The model was told to report both readings when the note
    // disagrees with itself rather than silently picking one. Two different
    // values for the same field means the operator has to look at the note.
    const valuesByField = new Map();
    for (const proposal of proposals) {
        if (proposal.status !== 'valid') continue;
        const seen = valuesByField.get(proposal.field) || new Set();
        seen.add(proposal.value);
        valuesByField.set(proposal.field, seen);
    }

    const emitted = new Set();
    const result = [];
    for (const proposal of proposals) {
        if (proposal.status === 'valid') {
            if (valuesByField.get(proposal.field).size > 1) {
                result.push({
                    ...proposal,
                    status: 'conflicting',
                    reason: 'the note gives more than one value for this field',
                });
                continue;
            }
            // Same field, same value, quoted twice — one row is enough.
            const dedupeKey = `${proposal.field}::${proposal.value}`;
            if (emitted.has(dedupeKey)) continue;
            emitted.add(dedupeKey);
        }
        result.push(proposal);
    }

    // Display in form order so the review panel reads like the form below it.
    return result.sort(
        (a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field)
    );
};
