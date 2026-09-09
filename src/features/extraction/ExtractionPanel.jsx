import React, { useState } from 'react';
import { clearKey, getKey, getKeySource, setKey } from './apiKey';
import { extractFromNotes, MAX_NOTE_CHARS } from './geminiClient';
import { validateProposals } from './validateProposals';
import ReviewPanel from './ReviewPanel';

// Paste notes, get proposals, review them. Collapsed by default: the manual
// form is the primary path and stays exactly as it was for anyone who never
// opens this.

const ExtractionPanel = ({ mode, formData, onApply }) => {
    const [open, setOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const [keyInput, setKeyInput] = useState('');
    const [keySource, setKeySource] = useState(getKeySource);
    const hasKey = keySource !== 'none';
    const [showKeyEditor, setShowKeyEditor] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [error, setError] = useState(null);
    const [proposals, setProposals] = useState(null);

    const saveKey = () => {
        if (!keyInput.trim()) return;
        const stored = setKey(keyInput);
        setKeyInput('');
        setShowKeyEditor(false);
        setKeySource(getKeySource());
        if (!stored) setError('This browser would not let the key be saved. Check that site data is not blocked.');
    };

    const forgetKey = () => {
        clearKey();
        setKeySource(getKeySource());
        setProposals(null);
    };

    // A proposal describes one particular note read one particular way. Editing
    // the note or switching report type invalidates it, so it goes away rather
    // than sitting there looking current.
    const handleNotesChange = (event) => {
        setNotes(event.target.value);
        if (proposals) setProposals(null);
        if (error) setError(null);
    };

    const handleExtract = async () => {
        setIsExtracting(true);
        setError(null);
        setProposals(null);
        try {
            const findings = await extractFromNotes({ notes, mode, apiKey: getKey() });
            setProposals(validateProposals(findings, notes, mode));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleApply = (patch) => {
        onApply(patch);
        setProposals(null);
    };

    const overLimit = notes.length > MAX_NOTE_CHARS;

    return (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '2rem', overflow: 'hidden' }}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    backgroundColor: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '500',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}
            >
                <span>Fill from incident notes <span style={{ color: 'var(--text-secondary)', fontWeight: '400' }}>(optional)</span></span>
                <span aria-hidden="true" style={{ color: 'var(--text-secondary)' }}>{open ? '−' : '+'}</span>
            </button>

            {open && (
                <div style={{ padding: '1rem' }}>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Your notes are sent to Google&apos;s Gemini API to be read. Your evidence
                        images and the generated PowerPoint never leave this device. Every value
                        is shown for your approval before it reaches the form — nothing is filled
                        in automatically, and calculated fields are never proposed.
                    </p>

                    {/* API key */}
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(15, 23, 42, 0.4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        {keySource === 'env' && !showKeyEditor ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    Using the key from your local env file — development only, not included in a production build.
                                </span>
                                <button type="button" onClick={() => setShowKeyEditor(true)} style={linkButtonStyle}>Use a different key</button>
                            </div>
                        ) : keySource === 'stored' && !showKeyEditor ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Gemini API key saved in this browser.</span>
                                <button type="button" onClick={() => setShowKeyEditor(true)} style={linkButtonStyle}>Replace</button>
                                <button type="button" onClick={forgetKey} style={linkButtonStyle}>Forget</button>
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="gemini-key" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    Gemini API key — stored in this browser only.{' '}
                                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>
                                        Get one
                                    </a>
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <input
                                        id="gemini-key"
                                        type="password"
                                        value={keyInput}
                                        onChange={(e) => setKeyInput(e.target.value)}
                                        placeholder="AIza..."
                                        autoComplete="off"
                                        style={{ flex: '1 1 14rem', padding: '0.625rem 0.75rem', backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.9375rem', outline: 'none' }}
                                    />
                                    <button type="button" onClick={saveKey} disabled={!keyInput.trim()} style={{ padding: '0.625rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: keyInput.trim() ? 'pointer' : 'default', opacity: keyInput.trim() ? 1 : 0.5 }}>
                                        Save
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <label htmlFor="incident-notes" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>
                        Incident notes
                    </label>
                    <textarea
                        id="incident-notes"
                        value={notes}
                        onChange={handleNotesChange}
                        rows={8}
                        placeholder={'INC /20260909/0001\nDate 09 Sep 2026, incident time 23:56:20\nAppl P999; move-off 23:58:40; arrived scene 00:06:05\n...'}
                        style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--input-bg)', border: `1px solid ${overLimit ? 'rgba(239, 68, 68, 0.6)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: overLimit ? '#fca5a5' : 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                        {notes.length.toLocaleString()} / {MAX_NOTE_CHARS.toLocaleString()} characters
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={handleExtract}
                            disabled={!hasKey || !notes.trim() || overLimit || isExtracting}
                            className="btn btn-primary"
                            style={{ flex: '1 1 12rem', opacity: (!hasKey || !notes.trim() || overLimit || isExtracting) ? 0.5 : 1 }}
                        >
                            {isExtracting ? 'Reading notes…' : 'Extract values'}
                        </button>
                        {notes && (
                            <button
                                type="button"
                                onClick={() => { setNotes(''); setProposals(null); setError(null); }}
                                style={{ flex: '0 1 8rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--input-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '1rem' }}
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {!hasKey && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.75rem', marginBottom: 0 }}>
                            Add your Gemini API key above to use extraction. The form works
                            normally without it.
                        </p>
                    )}

                    <div aria-live="polite">
                        {error && (
                            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.5)', fontSize: '0.9375rem' }}>
                                {error}
                            </div>
                        )}
                    </div>

                    {proposals && (
                        <div style={{ marginTop: '1rem' }}>
                            <ReviewPanel
                                proposals={proposals}
                                formData={formData}
                                onApply={handleApply}
                                onDiscard={() => setProposals(null)}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const linkButtonStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: 'inherit',
    padding: 0,
};

export default ExtractionPanel;
