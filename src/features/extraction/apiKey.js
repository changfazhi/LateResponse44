// Where the Gemini key comes from.
//
// Two sources, in priority order:
//
//   1. A key the operator pasted into the panel, kept in this browser's
//      localStorage. This is the one that works in a deployed build.
//   2. VITE_GEMINI_API_KEY from .env.local — a development convenience so you
//      are not re-pasting a key into every fresh browser profile.
//
// Source 2 is deliberately unavailable in a production build. `import.meta.env.DEV`
// is replaced with a literal `false` at build time and the branch is then dead
// code, so the key never reaches dist/. That matters because this app deploys as
// static files: a key inlined into the bundle is a key published to everyone who
// loads the page, and they would be spending your quota.
//
// Every localStorage access is wrapped: storage throws outright in some
// private-window and blocked-cookie configurations, and a thrown getter here
// would take the whole form down with it.

const STORAGE_KEY = 'lr44_gemini_key';

const DEV_KEY = import.meta.env.DEV ? (import.meta.env.VITE_GEMINI_API_KEY || '') : '';

const storedKey = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
        return '';
    }
};

export const getKey = () => storedKey() || DEV_KEY;

// Which source answered, so the panel can explain itself rather than showing a
// "key saved" row for a key that actually came from a file.
export const getKeySource = () => {
    if (storedKey()) return 'stored';
    if (DEV_KEY) return 'env';
    return 'none';
};

export const setKey = (key) => {
    try {
        localStorage.setItem(STORAGE_KEY, key.trim());
        return true;
    } catch {
        return false;
    }
};

export const clearKey = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nothing to do — the key was never stored.
    }
};
