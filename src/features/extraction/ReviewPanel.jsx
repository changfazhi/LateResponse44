import React, { useState } from 'react';

// The gap between what the model said and what goes on the document.
//
// Nothing here writes to the form. The operator ticks rows and presses Apply;
// everything else is display. Rows that failed validation are shown rather than
// hidden — knowing the model misread "resp abt 9 min" is worth more than a
// shorter list, and it tells the operator which field still needs typing.

const ROW_STYLES = {
    valid: { border: 'rgba(34, 197, 94, 0.35)', bg: 'rgba(34, 197, 94, 0.08)' },
    overwrite: { border: 'rgba(245, 158, 11, 0.45)', bg: 'rgba(245, 158, 11, 0.08)' },
    conflicting: { border: 'rgba(245, 158, 11, 0.45)', bg: 'rgba(245, 158, 11, 0.06)' },
    rejected: { border: 'rgba(148, 163, 184, 0.3)', bg: 'rgba(148, 163, 184, 0.05)' },
};

const ReviewPanel = ({ proposals, formData, onApply, onDiscard }) => {
    // The field already holds exactly this value, so there is nothing to apply.
    // Worth showing — it confirms the note agrees with the form — but flagging
    // it as an overwrite would be teaching the operator to wave those through.
    // The Date field defaults to today, so this is the common case for it.
    const isUnchanged = (proposal) =>
        (formData[proposal.field] ?? '') === proposal.value;

    // A proposal is an overwrite when the field already holds something
    // different. Those start unticked: the operator typed that value, and a
    // model is not a reason to silently replace it.
    const isOverwrite = (proposal) =>
        Boolean(formData[proposal.field]) && !isUnchanged(proposal);

    const isActionable = (proposal) =>
        proposal.status === 'valid' && !isUnchanged(proposal);

    const [selected, setSelected] = useState(() => {
        const initial = {};
        for (const proposal of proposals) {
            if (!isActionable(proposal)) continue;
            initial[proposal.field] = !isOverwrite(proposal);
        }
        return initial;
    });

    const validCount = proposals.filter(isActionable).length;
    const selectedCount = Object.values(selected).filter(Boolean).length;

    const toggle = (field) =>
        setSelected((prev) => ({ ...prev, [field]: !prev[field] }));

    const apply = () => {
        const patch = {};
        for (const proposal of proposals) {
            if (proposal.status === 'valid' && selected[proposal.field]) {
                patch[proposal.field] = proposal.value;
            }
        }
        onApply(patch);
    };

    if (proposals.length === 0) {
        return (
            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                No values could be read from these notes. Fill the form in manually.
                <button type="button" onClick={onDiscard} style={linkButtonStyle}>Dismiss</button>
            </div>
        );
    }

    return (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
            <h4 style={{ margin: '0 0 0.25rem', color: 'var(--accent-primary)' }}>
                {validCount} value{validCount === 1 ? '' : 's'} read from the notes
            </h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Check each value against its quoted evidence before applying. Calculated
                fields are not proposed — the form still works those out itself.
            </p>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {proposals.map((proposal, index) => {
                    const actionable = isActionable(proposal);
                    const overwrite = actionable && isOverwrite(proposal);
                    const styleKey = actionable
                        ? (overwrite ? 'overwrite' : 'valid')
                        : (proposal.status === 'valid' ? 'rejected' : proposal.status);
                    const rowStyle = ROW_STYLES[styleKey] || ROW_STYLES.rejected;
                    const inputId = `proposal-${proposal.field}-${index}`;

                    return (
                        <li
                            key={`${proposal.field}-${index}`}
                            style={{
                                border: `1px solid ${rowStyle.border}`,
                                backgroundColor: rowStyle.bg,
                                borderRadius: 'var(--radius-md)',
                                padding: '0.625rem 0.75rem',
                                display: 'flex',
                                gap: '0.625rem',
                                alignItems: 'flex-start',
                            }}
                        >
                            {actionable ? (
                                <input
                                    type="checkbox"
                                    id={inputId}
                                    checked={Boolean(selected[proposal.field])}
                                    onChange={() => toggle(proposal.field)}
                                    style={{ marginTop: '0.3rem', cursor: 'pointer' }}
                                />
                            ) : (
                                <span aria-hidden="true" style={{ color: 'var(--text-secondary)', marginTop: '0.1rem' }}>—</span>
                            )}

                            <div style={{ minWidth: 0, flex: 1 }}>
                                <label
                                    htmlFor={actionable ? inputId : undefined}
                                    style={{ display: 'block', fontSize: '0.9375rem', cursor: actionable ? 'pointer' : 'default' }}
                                >
                                    <strong>{proposal.label}</strong>{' '}
                                    {actionable ? (
                                        <>
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                {formData[proposal.field] || '(blank)'}
                                            </span>
                                            {' → '}
                                            <span style={{ color: 'var(--text-primary)' }}>{proposal.value}</span>
                                        </>
                                    ) : proposal.status === 'valid' ? (
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                            {proposal.value} — already in the form
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                            “{proposal.rawValue}” — {proposal.reason}
                                        </span>
                                    )}
                                </label>

                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem', wordBreak: 'break-word' }}>
                                    “{proposal.evidence}”
                                </div>

                                {overwrite && (
                                    <div style={{ fontSize: '0.8125rem', color: '#fcd34d', marginTop: '0.25rem' }}>
                                        Replaces a value you already entered.
                                    </div>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={apply}
                    disabled={selectedCount === 0}
                    className="btn btn-primary"
                    style={{ flex: '1 1 12rem', opacity: selectedCount === 0 ? 0.5 : 1 }}
                >
                    Apply {selectedCount} selected
                </button>
                <button
                    type="button"
                    onClick={onDiscard}
                    style={{
                        flex: '1 1 8rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        fontSize: '1rem',
                    }}
                >
                    Discard
                </button>
            </div>
        </div>
    );
};

const linkButtonStyle = {
    marginLeft: '0.5rem',
    background: 'none',
    border: 'none',
    color: 'var(--accent-primary)',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: 'inherit',
    padding: 0,
};

export default ReviewPanel;
