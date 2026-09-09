import React, { useState } from 'react';
import FormInput from './FormInput';
import ExtractionPanel from '../features/extraction/ExtractionPanel';
import {
    DURATION_FIELDS,
    REPORT_FIELDS,
    TIME_FIELDS,
    modePrintsField,
} from '../domain/reportFields';
import {
    LATE_THRESHOLD_SECONDS,
    elapsedBetween,
    formatSecondsToVerbose,
    formatTimeSeconds,
    parseDurationToSeconds,
    parseTimeToSeconds,
    todayLocalISO,
} from '../domain/time';
import { generatePPTX, REPORT_MODES, uploadSlotsFor, ALL_UPLOAD_SLOTS } from '../utils/pptxGenerator';

const STATUS_STYLES = {
    error: { bg: 'rgba(239, 68, 68, 0.2)', fg: '#fca5a5', border: 'rgba(239, 68, 68, 0.5)' },
    warning: { bg: 'rgba(245, 158, 11, 0.2)', fg: '#fcd34d', border: 'rgba(245, 158, 11, 0.5)' },
    success: { bg: 'rgba(34, 197, 94, 0.2)', fg: '#86efac', border: 'rgba(34, 197, 94, 0.5)' },
};

const Form = () => {
    const [formData, setFormData] = useState({
        incident_number: '',
        date: todayLocalISO(),
        time: '',
        arrival_time: '',
        response_time: '',
        real_response_time: '',
        actual_response_time: '',
        time_exceeded: '',
        y_n: 'Y',
        incident_type: '',
        location: '',
        appliance_data: '',
        response_zone: '',
        sc: '',
        po: '',
        number_of_sftl: '',
        activation_time: '',
        actual_activation_time: '',
        move_off: '',
        sftl1: '',
        SFTL1_greenTime: '',
        SFTL1_duration: '',
        SFTL1_redTime: '',
        sftl2: '',
        SFTL2_greenTime: '',
        SFTL2_duration: '',
        SFTL2_redTime: '',
        sftl3: '',
        SFTL3_greenTime: '',
        SFTL3_duration: '',
        SFTL3_redTime: '',
    });

    // Separate state for images, keyed by every slot any report type can use so an
    // upload survives a mode switch that hides it.
    const [images, setImages] = useState(() =>
        Object.fromEntries(ALL_UPLOAD_SLOTS.map(slot => [slot.key, null]))
    );

    const [mode, setMode] = useState('late_response');

    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState(null);

    // Fields the operator accepted from extracted notes, so each input can show
    // where its value came from until it is edited by hand.
    const [extractedFields, setExtractedFields] = useState(() => new Set());

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Typed over: it is the operator's value now, so drop the badge.
        setExtractedFields(prev => {
            if (!prev.has(name)) return prev;
            const next = new Set(prev);
            next.delete(name);
            return next;
        });
        if (status) setStatus(null);
    };

    const handleImageChange = (e) => {
        const { name, files } = e.target;
        if (files && files[0]) {
            setImages(prev => ({ ...prev, [name]: files[0] }));
            if (status) setStatus(null);
        }
    };

    // The one place extraction is allowed to touch the report. It fills inputs
    // and nothing else: no validation is skipped, no derived value is carried
    // over, and the operator still has to press Download Presentation.
    const applyProposals = (patch) => {
        setFormData(prev => ({ ...prev, ...patch }));
        setExtractedFields(prev => new Set([...prev, ...Object.keys(patch)]));
        if (status) setStatus(null);
    };

    // Refuse to build a report we know would be wrong. Two things are blocking:
    // a value that was typed but cannot be parsed, and a half-filled pair that
    // leaves a calculation impossible. Everything merely left blank is reported
    // afterwards as a warning, since a partial draft is a legitimate thing to want.
    const findBlockingProblems = (data, reportMode) => {
        const problems = [];
        const prints = (key) => modePrintsField(reportMode, key);

        for (const [key, label] of TIME_FIELDS) {
            if (!prints(key)) continue;
            if (data[key] && parseTimeToSeconds(data[key]) === null) {
                problems.push(`${label}: "${data[key]}" is not a valid time. Use HH:mm or HH:mm:ss.`);
            }
        }

        for (const [key, label] of DURATION_FIELDS) {
            if (!prints(key)) continue;
            if (data[key] && parseDurationToSeconds(data[key]) === null) {
                problems.push(`${label}: "${data[key]}" is not a valid duration. Use MM:SS, for example 05:30.`);
            }
        }

        // The late activation slide carries fixed wording the form cannot rewrite:
        // "According to ACES logs, <appliance> responded within 1 Min." An Actual
        // Activation of a minute or more makes the slide contradict its own table,
        // which on an official document is worse than producing nothing at all.
        if (reportMode === 'late_activation') {
            const actualActivationSec = parseDurationToSeconds(data.actual_activation_time);
            if (actualActivationSec !== null && actualActivationSec >= 60) {
                problems.push(`The slide states the appliance activated within 1 minute, but Actual Activation is "${data.actual_activation_time}". Correct the figure, or this is not a late-activation justification.`);
            }
            // Every rule below is about the response, which this report makes no
            // claim about — they are what used to block a late activation report.
            return problems;
        }

        const filled = (key) => Boolean(data[key]);

        if (filled('arrival_time') !== filled('move_off')) {
            problems.push('Real Response Time needs both Move Off Time and Arrival Time. Fill in the missing one.');
        }

        if (filled('activation_time') && !(filled('arrival_time') && filled('move_off'))) {
            problems.push('Actual Response Time is Activation Time plus travel time, so it also needs Move Off Time and Arrival Time.');
        }

        for (const n of [1, 2, 3]) {
            if (filled(`SFTL${n}_redTime`) !== filled(`SFTL${n}_greenTime`)) {
                problems.push(`SFTL${n} Duration needs both SFTL${n} Red Time and SFTL${n} Green Time. Fill in the missing one.`);
            }
        }

        return problems;
    };

    // Time Exceeded is Response Time minus the threshold, by definition — there is
    // no legitimate reason to hand-enter a different figure on a justification
    // document. It is shown read-only and recomputed here as Response Time is
    // typed, so what the form displays is what the deck will print.
    const timeExceededPreview = (() => {
        const responseSec = parseDurationToSeconds(formData.response_time);
        if (responseSec === null) return '';
        return formatSecondsToVerbose(responseSec - LATE_THRESHOLD_SECONDS);
    })();

    const isLateResponse = mode === 'late_response';
    const uploadSlots = uploadSlotsFor(mode);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const problems = findBlockingProblems(formData, mode);
        if (problems.length > 0) {
            setStatus({ type: 'error', message: 'The report was not generated. Fix these first:', details: problems });
            return;
        }

        setIsLoading(true);
        setStatus(null);

        const processedData = { ...formData }; // Clone for processing

        // 1. Incident No
        processedData.incident_no = processedData.incident_number;

        // 2. Format Time-of-Day Fields (HH:mm:ss)
        processedData.move_off = formatTimeSeconds(processedData.move_off);
        processedData.arrival_time = formatTimeSeconds(processedData.arrival_time);
        processedData.time = formatTimeSeconds(processedData.time);

        // SFTL Times
        processedData.SFTL1_redTime = formatTimeSeconds(processedData.SFTL1_redTime);
        processedData.SFTL1_greenTime = formatTimeSeconds(processedData.SFTL1_greenTime);
        processedData.SFTL2_redTime = formatTimeSeconds(processedData.SFTL2_redTime);
        processedData.SFTL2_greenTime = formatTimeSeconds(processedData.SFTL2_greenTime);
        processedData.SFTL3_redTime = formatTimeSeconds(processedData.SFTL3_redTime);
        processedData.SFTL3_greenTime = formatTimeSeconds(processedData.SFTL3_greenTime);

        // 3. Logic & Calculations
        // Need seconds for calcs
        const arrivalSec = parseTimeToSeconds(processedData.arrival_time);
        const moveOffSec = parseTimeToSeconds(processedData.move_off);
        const activationSec = parseDurationToSeconds(processedData.activation_time);

        // Response Time is input, but we need it for 'Time Exceeded' calc
        const responseInputSec = parseDurationToSeconds(processedData.response_time);
        // Actual Activation is input (unless logic implies otherwise, but user provided format only), so we format it.
        const actualActivationInputSec = parseDurationToSeconds(processedData.actual_activation_time);


        // A. Real Response Time = Arrival - Move Off
        let realResponseSec = null;
        if (arrivalSec !== null && moveOffSec !== null) {
            realResponseSec = elapsedBetween(moveOffSec, arrivalSec);
            processedData.real_response_time = formatSecondsToVerbose(realResponseSec);
            // Backward compat
            processedData.rresponse_time = processedData.real_response_time;
        }

        // B. Actual Response Time = Activation + Real Response
        // Both halves are required. Without a Move Off / Arrival pair there is no
        // travel time, and adding activation to an assumed zero would understate
        // the response on the very document meant to justify it. Leave it blank.
        if (activationSec !== null && realResponseSec !== null) {
            processedData.actual_response_time = formatSecondsToVerbose(realResponseSec + activationSec);
        }

        // C. Time Exceeded = Response Time - the late threshold
        if (responseInputSec !== null) {
            processedData.time_exceeded = formatSecondsToVerbose(responseInputSec - LATE_THRESHOLD_SECONDS);
        }

        // D. Format simple Duration Inputs to "xx Min xx Sec"
        // activation_time, response_time, actual_activation_time
        if (activationSec !== null) processedData.activation_time = formatSecondsToVerbose(activationSec);
        if (responseInputSec !== null) processedData.response_time = formatSecondsToVerbose(responseInputSec);
        if (actualActivationInputSec !== null) processedData.actual_activation_time = formatSecondsToVerbose(actualActivationInputSec);

        // User Request: SFTL Duration = SFTL Green - SFTL Red
        const sftl1RedSec = parseTimeToSeconds(processedData.SFTL1_redTime);
        const sftl1GreenSec = parseTimeToSeconds(processedData.SFTL1_greenTime);
        if (sftl1RedSec !== null && sftl1GreenSec !== null) {
            processedData.SFTL1_duration = formatSecondsToVerbose(elapsedBetween(sftl1RedSec, sftl1GreenSec));
        }

        const sftl2RedSec = parseTimeToSeconds(processedData.SFTL2_redTime);
        const sftl2GreenSec = parseTimeToSeconds(processedData.SFTL2_greenTime);
        if (sftl2RedSec !== null && sftl2GreenSec !== null) {
            processedData.SFTL2_duration = formatSecondsToVerbose(elapsedBetween(sftl2RedSec, sftl2GreenSec));
        }

        const sftl3RedSec = parseTimeToSeconds(processedData.SFTL3_redTime);
        const sftl3GreenSec = parseTimeToSeconds(processedData.SFTL3_greenTime);
        if (sftl3RedSec !== null && sftl3GreenSec !== null) {
            processedData.SFTL3_duration = formatSecondsToVerbose(elapsedBetween(sftl3RedSec, sftl3GreenSec));
        }


        try {
            await generatePPTX(processedData, images, mode);

            const modeSlots = uploadSlotsFor(mode);
            const blankFields = REPORT_FIELDS
                .filter(([key]) => modePrintsField(mode, key) && !processedData[key])
                .map(([, label]) => label);
            const missingImages = modeSlots.filter(slot => !images[slot.key]).map(slot => slot.label);

            const details = [];

            // Not blocking: ACES having already logged the activation as under a
            // minute does not make the deck wrong, it makes it pointless.
            if (mode === 'late_activation' && activationSec !== null && activationSec < 60) {
                details.push('ACES logged this activation as within 1 minute, so there is nothing here to justify. Check the Activation Time.');
            }
            if (blankFields.length > 0) {
                details.push(`${blankFields.length} field${blankFields.length === 1 ? '' : 's'} printed blank: ${blankFields.join(', ')}.`);
            }
            if (missingImages.length > 0) {
                details.push(`${missingImages.length} of ${modeSlots.length} evidence images not uploaded, so the template's placeholder graphics remain: ${missingImages.join(', ')}.`);
            }

            setStatus(details.length > 0
                ? { type: 'warning', message: 'Presentation downloaded, but it is incomplete:', details }
                : { type: 'success', message: 'Presentation generated successfully!' });
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: error?.message || 'Failed to generate presentation. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="glass-panel animate-fade-in" style={{ width: '100%' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Incident Data Entry</h2>

            {/* Report type. The two documents justify different things, so each one
                shows only the fields its own slides print. */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                {Object.entries(REPORT_MODES).map(([key, reportMode]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => { setMode(key); setStatus(null); }}
                        aria-pressed={mode === key}
                        style={{
                            flex: 1,
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: '500',
                            backgroundColor: mode === key ? 'var(--accent-primary)' : 'var(--input-bg)',
                            color: mode === key ? '#fff' : 'var(--text-secondary)',
                            border: `1px solid ${mode === key ? 'var(--accent-primary)' : 'var(--border-color)'}`
                        }}
                    >
                        {reportMode.label}
                    </button>
                ))}
            </div>

            <ExtractionPanel
                mode={mode}
                formData={formData}
                onApply={applyProposals}
            />

            {/* Incident Identification */}
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Identification</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Incident Number" name="incident_number" fromNotes={extractedFields.has('incident_number')} value={formData.incident_number} onChange={handleChange} required placeholder="eg. /YYYYMMDD/XXXX" />
                {isLateResponse && <FormInput label="Date" name="date" fromNotes={extractedFields.has('date')} type="date" value={formData.date} onChange={handleChange} required />}
            </div>
            {isLateResponse && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <FormInput label="Incident Type" name="incident_type" fromNotes={extractedFields.has('incident_type')} value={formData.incident_type} onChange={handleChange} />
                    <FormInput label="Location" name="location" fromNotes={extractedFields.has('location')} value={formData.location} onChange={handleChange} />
                </div>
            )}

            {/* Time Data (HH:mm:ss) - Clock Times */}
            {isLateResponse && (
                <>
                    <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Timing (Clock Time)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="Incident Time" name="time" fromNotes={extractedFields.has('time')} type="time" step="1" value={formData.time} onChange={handleChange} />
                        <FormInput label="Arrival Time" name="arrival_time" fromNotes={extractedFields.has('arrival_time')} type="time" step="1" value={formData.arrival_time} onChange={handleChange} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="Move Off Time" name="move_off" fromNotes={extractedFields.has('move_off')} type="time" step="1" value={formData.move_off} onChange={handleChange} />
                    </div>
                </>
            )}

            {/* Durations */}
            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Durations (MM:SS)</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Enter as 05:30. Output will be formatted as "xx Min xx Sec".</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Activation Time" name="activation_time" fromNotes={extractedFields.has('activation_time')} value={formData.activation_time} onChange={handleChange} placeholder="05:30" />
                <FormInput label="Actual Activation" name="actual_activation_time" fromNotes={extractedFields.has('actual_activation_time')} value={formData.actual_activation_time} onChange={handleChange} placeholder="05:30" />
            </div>
            {isLateResponse && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <FormInput label="Response Time (Input)" name="response_time" fromNotes={extractedFields.has('response_time')} value={formData.response_time} onChange={handleChange} placeholder="10:00" />
                </div>
            )}

            {/* Other Metrics */}
            {isLateResponse && (
                <>
                    <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Metrics</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="Time Exceeded (Auto Calc)" name="time_exceeded" fromNotes={extractedFields.has('time_exceeded')} value={timeExceededPreview} readOnly placeholder="From Response Time" />
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label htmlFor="y_n" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Activation within 1 minute?</label>
                            <select name="y_n" id="y_n" value={formData.y_n} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', cursor: 'pointer' }}>
                                <option value="Y">Yes</option>
                                <option value="N">No</option>
                            </select>
                        </div>
                    </div>
                </>
            )}

            {/* Image Uploads, rendered from this report type's slot list so the
                labels here, the frames they land in and the "not uploaded" warning
                cannot drift apart. */}
            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Evidence Images</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {uploadSlots.map(slot => (
                    <div key={slot.key}>
                        <label htmlFor={slot.key} style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>{slot.label}</label>
                        <input type="file" id={slot.key} name={slot.key} onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                    </div>
                ))}
            </div>

            {/* Operational Details */}
            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Operational Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Appliance Data" name="appliance_data" fromNotes={extractedFields.has('appliance_data')} value={formData.appliance_data} onChange={handleChange} />
                {isLateResponse && <FormInput label="Response Zone" name="response_zone" fromNotes={extractedFields.has('response_zone')} value={formData.response_zone} onChange={handleChange} />}
            </div>
            {isLateResponse && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="Number of SFTL" name="number_of_sftl" fromNotes={extractedFields.has('number_of_sftl')} value={formData.number_of_sftl} onChange={handleChange} />
                        <FormInput label="SC" name="sc" fromNotes={extractedFields.has('sc')} value={formData.sc} onChange={handleChange} placeholder="eg. SGT1 Fa Zhi" />
                    </div>
                    <FormInput label="PO" name="po" fromNotes={extractedFields.has('po')} value={formData.po} onChange={handleChange} placeholder="eg. SGT1 Fa Zhi" />
                </>
            )}

            {/* SFTL Data */}
            {isLateResponse && (
                <>
                    <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>SFTL 1 Metrics</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="SFTL1 Location" name="sftl1" fromNotes={extractedFields.has('sftl1')} value={formData.sftl1} onChange={handleChange} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="SFTL1 Red Time" name="SFTL1_redTime" fromNotes={extractedFields.has('SFTL1_redTime')} type="time" step="1" value={formData.SFTL1_redTime} onChange={handleChange} />
                        <FormInput label="SFTL1 Green Time" name="SFTL1_greenTime" fromNotes={extractedFields.has('SFTL1_greenTime')} type="time" step="1" value={formData.SFTL1_greenTime} onChange={handleChange} />
                    </div>

                    <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>SFTL 2 Metrics</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="SFTL2 Location" name="sftl2" fromNotes={extractedFields.has('sftl2')} value={formData.sftl2} onChange={handleChange} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="SFTL2 Red Time" name="SFTL2_redTime" fromNotes={extractedFields.has('SFTL2_redTime')} type="time" step="1" value={formData.SFTL2_redTime} onChange={handleChange} />
                        <FormInput label="SFTL2 Green Time" name="SFTL2_greenTime" fromNotes={extractedFields.has('SFTL2_greenTime')} type="time" step="1" value={formData.SFTL2_greenTime} onChange={handleChange} />
                    </div>

                    <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>SFTL 3 Metrics</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="SFTL3 Location" name="sftl3" fromNotes={extractedFields.has('sftl3')} value={formData.sftl3} onChange={handleChange} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <FormInput label="SFTL3 Red Time" name="SFTL3_redTime" fromNotes={extractedFields.has('SFTL3_redTime')} type="time" step="1" value={formData.SFTL3_redTime} onChange={handleChange} />
                        <FormInput label="SFTL3 Green Time" name="SFTL3_greenTime" fromNotes={extractedFields.has('SFTL3_greenTime')} type="time" step="1" value={formData.SFTL3_greenTime} onChange={handleChange} />
                    </div>
                </>
            )}

            {status && (
                <div style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    marginBottom: '1.5rem',
                    backgroundColor: (STATUS_STYLES[status.type] || STATUS_STYLES.success).bg,
                    color: (STATUS_STYLES[status.type] || STATUS_STYLES.success).fg,
                    border: `1px solid ${(STATUS_STYLES[status.type] || STATUS_STYLES.success).border}`
                }}>
                    {status.message}
                    {status.details && status.details.length > 0 && (
                        <ul style={{ textAlign: 'left', margin: '0.75rem 0 0', paddingLeft: '1.25rem' }}>
                            {status.details.map((detail, i) => (
                                <li key={i} style={{ marginBottom: '0.35rem' }}>{detail}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%' }}>
                {isLoading ? 'Generating...' : 'Download Presentation'}
            </button>
        </form>
    );
};

export default Form;
