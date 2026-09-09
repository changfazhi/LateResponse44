// Time parsing, formatting and normalization for the report.
//
// These functions used to live inside the Form component, which meant nothing
// could import them and the only way to test them was to slice them out of the
// source text. They are pure and dependency-free so both manual entry and the
// note-extraction path can share one set of rules — two copies of "what counts
// as a valid time" on an official document is exactly how they drift apart.

export const SECONDS_PER_DAY = 24 * 3600;

// SCDF treats a response as late beyond 8 minutes; Time Exceeded is measured
// against that threshold. It is the one policy number in the app, so it lives
// here rather than inline in a calculation.
export const LATE_THRESHOLD_SECONDS = 8 * 60;

const pad2 = (n) => String(n).padStart(2, '0');

// Only plain digits count as a component. The old test was `Number.isFinite`,
// which waves through "1e2", "-5", "1.5" and " " — all of which then became a
// confident, wrong number on the slide.
const DIGITS = /^\d{1,4}$/;

// Split "HH:mm[:ss]" into numeric parts, or null if a part is empty or not a
// plain integer. Returning null rather than NaN is what lets the callers below
// tell "no value given" apart from "a value we can safely calculate with" —
// every guard downstream is a !== null check, and NaN passes those.
const splitTimeParts = (str, maxParts) => {
    const parts = str.split(':');
    if (parts.length < 2 || parts.length > maxParts) return null;
    const nums = [];
    for (const part of parts) {
        const trimmed = part.trim();
        if (!DIGITS.test(trimmed)) return null;
        nums.push(Number(trimmed));
    }
    return nums;
};

// Parse a clock time "HH:mm[:ss]" to seconds from the start of the day.
// Components are range-checked: 25:00 and 12:99 are not times, and a report
// that prints them is wrong in a way nobody notices until it is filed.
export const parseTimeToSeconds = (timeStr) => {
    if (!timeStr) return null;
    const parts = splitTimeParts(String(timeStr).trim(), 3);
    if (!parts) return null;
    const [h, m, s = 0] = parts;
    if (h > 23 || m > 59 || s > 59) return null;
    return h * 3600 + m * 60 + s;
};

// Parse a duration "MM:SS" (or "HH:MM:SS") to seconds.
//
// A bare number is rejected on purpose: someone writing "90" for 90 seconds
// would silently get 90 minutes. The form asks for MM:SS, so require it and let
// validation say so rather than guessing at a 10x error.
export const parseDurationToSeconds = (durStr) => {
    if (!durStr) return null;
    const str = String(durStr).trim();
    if (!str.includes(':')) return null;
    const parts = splitTimeParts(str, 3);
    if (!parts) return null;
    if (parts.length === 3) {
        const [h, m, s] = parts;
        if (m > 59 || s > 59) return null;
        return h * 3600 + m * 60 + s;
    }
    const [m, s] = parts;
    if (s > 59) return null;
    return m * 60 + s;
};

// Elapsed time between two clock times, wrapping over midnight so an incident
// that moves off at 23:58 and arrives at 00:05 reads as 7 minutes rather than
// as a negative duration.
export const elapsedBetween = (fromSec, toSec) => {
    const diff = toSec - fromSec;
    return diff < 0 ? diff + SECONDS_PER_DAY : diff;
};

// Format seconds to "xx Min xx Sec", the shape the template prints.
export const formatSecondsToVerbose = (totalSeconds) => {
    const isNegative = totalSeconds < 0;
    const absSeconds = Math.abs(totalSeconds);
    const m = Math.floor(absSeconds / 60);
    const s = Math.floor(absSeconds % 60);
    const formatted = `${pad2(m)} Min ${pad2(s)} Sec`;
    return isNegative ? `-${formatted}` : formatted;
};

// "23:58" -> "23:58:00". The template prints seconds, the browser time input
// may omit them.
export const formatTimeSeconds = (timeStr) => {
    if (!timeStr) return '';
    if (timeStr.length === 5) return `${timeStr}:00`;
    return timeStr;
};

// toISOString() reports the UTC date, which is the previous day for the whole
// 00:00-08:00 local window here — disproportionately the hours this tool is
// used for. Build the default from local calendar fields instead.
export const todayLocalISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

// ---------------------------------------------------------------------------
// Normalizers for extracted note text.
//
// These accept the looser shapes an officer actually writes and return the
// canonical form the form fields hold, or null when the text cannot be read
// unambiguously. Null is a result, not a failure: the value is shown to the
// operator as rejected rather than guessed at.
// ---------------------------------------------------------------------------

// "23:56", "23:56:20", "2356", "2356h", "235620" -> "23:56:20"
//
// Seconds are never invented — a source with minute precision pads to :00,
// which is exactly what formatTimeSeconds already does at submit time.
export const normalizeClock = (raw) => {
    if (typeof raw !== 'string') return null;
    let str = raw.trim().toLowerCase();
    if (!str) return null;

    // Military shorthand: "2356h", "2356 hrs".
    str = str.replace(/\s*(?:h|hr|hrs|hours)$/, '').trim();

    // Separatorless forms.
    if (/^\d{4}$/.test(str)) str = `${str.slice(0, 2)}:${str.slice(2)}`;
    else if (/^\d{6}$/.test(str)) str = `${str.slice(0, 2)}:${str.slice(2, 4)}:${str.slice(4)}`;

    const seconds = parseTimeToSeconds(str);
    if (seconds === null) return null;

    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds / 60) % 60;
    const s = seconds % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

// "09:45", "9m45s", "9 min 45 sec", "45s" -> "09:45"
//
// A bare "90" returns null for the same reason parseDurationToSeconds rejects
// it: minutes and seconds are not distinguishable without a unit.
export const normalizeDuration = (raw) => {
    if (typeof raw !== 'string') return null;
    const str = raw.trim().toLowerCase();
    if (!str) return null;

    let totalSeconds;

    if (str.includes(':')) {
        totalSeconds = parseDurationToSeconds(str);
    } else {
        const match = str.match(
            /^(?:(\d{1,3})\s*(?:m|min|mins|minute|minutes)\.?)?\s*(?:(\d{1,2})\s*(?:s|sec|secs|second|seconds)\.?)?$/
        );
        if (!match || (match[1] === undefined && match[2] === undefined)) return null;
        const m = match[1] === undefined ? 0 : Number(match[1]);
        const s = match[2] === undefined ? 0 : Number(match[2]);
        if (s > 59) return null;
        totalSeconds = m * 60 + s;
    }

    if (totalSeconds === null || totalSeconds === undefined) return null;
    return `${pad2(Math.floor(totalSeconds / 60))}:${pad2(totalSeconds % 60)}`;
};

const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const isRealDate = (y, m, d) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

// "2026-09-09", "09 Sep 2026", "Sep 9, 2026" -> "2026-09-09"
//
// All-numeric separated forms like "09/10/2026" are rejected rather than
// guessed: day-first and month-first are both plausible here and the wrong
// choice puts a real, wrong date on a filed document.
export const normalizeDate = (raw) => {
    if (typeof raw !== 'string') return null;
    const str = raw.trim();
    if (!str) return null;

    const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
        const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
        return isRealDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : null;
    }

    const monthName = '([a-z]{3,9})';
    const lower = str.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

    // "09 Sep 2026"
    let match = lower.match(new RegExp(`^(\\d{1,2}) ${monthName} (\\d{4})$`));
    if (match) {
        const m = MONTHS[match[2].slice(0, 3)];
        const [d, y] = [Number(match[1]), Number(match[3])];
        return m && isRealDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : null;
    }

    // "Sep 09 2026"
    match = lower.match(new RegExp(`^${monthName} (\\d{1,2}) (\\d{4})$`));
    if (match) {
        const m = MONTHS[match[1].slice(0, 3)];
        const [d, y] = [Number(match[2]), Number(match[3])];
        return m && isRealDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : null;
    }

    return null;
};
