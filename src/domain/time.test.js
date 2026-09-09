import { describe, expect, it } from 'vitest';
import {
    elapsedBetween,
    formatSecondsToVerbose,
    normalizeClock,
    normalizeDate,
    normalizeDuration,
    parseDurationToSeconds,
    parseTimeToSeconds,
} from './time';

describe('parseTimeToSeconds', () => {
    it('reads valid clock times', () => {
        expect(parseTimeToSeconds('00:00')).toBe(0);
        expect(parseTimeToSeconds('23:59:59')).toBe(86399);
        expect(parseTimeToSeconds('09:45')).toBe(35100);
    });

    // These all used to parse: the check was Number.isFinite, which accepts
    // anything Number() can coerce. Each one produced a confident wrong figure.
    it('rejects impossible components', () => {
        expect(parseTimeToSeconds('25:00')).toBeNull();
        expect(parseTimeToSeconds('12:99')).toBeNull();
        expect(parseTimeToSeconds('12:30:99')).toBeNull();
        expect(parseTimeToSeconds('1e2:00')).toBeNull();
        expect(parseTimeToSeconds('-1:00')).toBeNull();
        expect(parseTimeToSeconds('1.5:00')).toBeNull();
    });

    it('rejects malformed input without returning NaN', () => {
        expect(parseTimeToSeconds('')).toBeNull();
        expect(parseTimeToSeconds('12')).toBeNull();
        expect(parseTimeToSeconds('12:')).toBeNull();
        expect(parseTimeToSeconds('noon')).toBeNull();
        expect(parseTimeToSeconds('1:2:3:4')).toBeNull();
    });
});

describe('parseDurationToSeconds', () => {
    it('reads MM:SS and HH:MM:SS', () => {
        expect(parseDurationToSeconds('05:30')).toBe(330);
        expect(parseDurationToSeconds('01:00:00')).toBe(3600);
    });

    it('rejects a bare number', () => {
        // "90" meant as 90 seconds would otherwise silently become 90 minutes.
        expect(parseDurationToSeconds('90')).toBeNull();
    });

    it('rejects out-of-range seconds', () => {
        expect(parseDurationToSeconds('05:75')).toBeNull();
    });

    it('allows minutes above 59', () => {
        expect(parseDurationToSeconds('90:00')).toBe(5400);
    });
});

describe('elapsedBetween', () => {
    it('wraps over midnight', () => {
        // Move off 23:58:40, arrive 00:06:05 — 7m25s, not minus 23 hours.
        expect(elapsedBetween(86320, 365)).toBe(445);
    });

    it('handles same-day intervals', () => {
        expect(elapsedBetween(100, 500)).toBe(400);
    });
});

describe('formatSecondsToVerbose', () => {
    it('pads and signs', () => {
        expect(formatSecondsToVerbose(485)).toBe('08 Min 05 Sec');
        expect(formatSecondsToVerbose(-95)).toBe('-01 Min 35 Sec');
    });
});

describe('normalizeClock', () => {
    it('accepts the shapes officers write', () => {
        expect(normalizeClock('23:56')).toBe('23:56:00');
        expect(normalizeClock('23:56:20')).toBe('23:56:20');
        expect(normalizeClock('2356')).toBe('23:56:00');
        expect(normalizeClock('2356h')).toBe('23:56:00');
        expect(normalizeClock('2356 hrs')).toBe('23:56:00');
        expect(normalizeClock('235620')).toBe('23:56:20');
    });

    it('refuses impossible times rather than clamping them', () => {
        expect(normalizeClock('25:00')).toBeNull();
        expect(normalizeClock('2599')).toBeNull();
        expect(normalizeClock('about midnight')).toBeNull();
    });
});

describe('normalizeDuration', () => {
    it('accepts written units', () => {
        expect(normalizeDuration('09:45')).toBe('09:45');
        expect(normalizeDuration('9m45s')).toBe('09:45');
        expect(normalizeDuration('9 min 45 sec')).toBe('09:45');
        expect(normalizeDuration('45s')).toBe('00:45');
        expect(normalizeDuration('9 minutes')).toBe('09:00');
    });

    it('still refuses a bare number', () => {
        expect(normalizeDuration('90')).toBeNull();
        expect(normalizeDuration('9')).toBeNull();
    });

    it('refuses vague quantities', () => {
        expect(normalizeDuration('about 9 min')).toBeNull();
        expect(normalizeDuration('a few minutes')).toBeNull();
    });
});

describe('normalizeDate', () => {
    it('accepts ISO and named months', () => {
        expect(normalizeDate('2026-09-09')).toBe('2026-09-09');
        expect(normalizeDate('09 Sep 2026')).toBe('2026-09-09');
        expect(normalizeDate('9 September 2026')).toBe('2026-09-09');
        expect(normalizeDate('Sep 9, 2026')).toBe('2026-09-09');
    });

    it('refuses all-numeric separated dates', () => {
        // 09/10/2026 is 9 October or 10 September depending on who wrote it.
        // Guessing puts a real, wrong date on a filed document.
        expect(normalizeDate('09/10/2026')).toBeNull();
        expect(normalizeDate('09-10-2026')).toBeNull();
    });

    it('refuses dates that do not exist', () => {
        expect(normalizeDate('2026-02-30')).toBeNull();
        expect(normalizeDate('31 Feb 2026')).toBeNull();
        expect(normalizeDate('2026-13-01')).toBeNull();
    });
});
