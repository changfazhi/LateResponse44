import React from 'react';

const FormInput = ({ label, name, type = 'text', value, onChange, required = false, placeholder = '', readOnly = false, fromNotes = false, ...props }) => {
    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <label
                htmlFor={name}
                style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                }}
            >
                {label} {required && <span style={{ color: 'var(--accent-secondary)' }}>*</span>}
                {/* Where the value came from, until the operator types over it. */}
                {fromNotes && (
                    <span
                        title="Applied from extracted notes — check it before generating"
                        style={{
                            marginLeft: '0.5rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.6875rem',
                            fontWeight: '600',
                            letterSpacing: '0.02em',
                            color: '#93c5fd',
                            backgroundColor: 'rgba(59, 130, 246, 0.18)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                        }}
                    >
                        from notes
                    </span>
                )}
            </label>
            <input
                id={name}
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                required={required}
                placeholder={placeholder}
                readOnly={readOnly}
                style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    backgroundColor: readOnly ? 'var(--card-bg)' : 'var(--input-bg)',
                    border: `1px solid ${fromNotes ? 'rgba(59, 130, 246, 0.5)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-md)',
                    color: readOnly ? 'var(--text-secondary)' : 'var(--text-primary)',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    cursor: readOnly ? 'default' : 'text',
                }}
                onFocus={(e) => {
                    if (readOnly) return;
                    e.target.style.borderColor = 'var(--accent-primary)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                    if (readOnly) return;
                    e.target.style.borderColor = fromNotes ? 'rgba(59, 130, 246, 0.5)' : 'var(--border-color)';
                    e.target.style.boxShadow = 'none';
                }}
                {...props}
            />
        </div>
    );
};

export default FormInput;
