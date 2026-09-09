import React, { useState } from 'react';
import FormInput from './FormInput';
import { generatePPTX, UPLOAD_SLOTS } from '../utils/pptxGenerator';

// Clock-time and duration fields, paired with the label shown on the form so a
// validation message points at the box the user has to go and fix.
const TIME_FIELDS = [
    ['time', 'Incident Time'],
    ['arrival_time', 'Arrival Time'],
    ['move_off', 'Move Off Time'],
    ['SFTL1_redTime', 'SFTL1 Red Time'],
    ['SFTL1_greenTime', 'SFTL1 Green Time'],
    ['SFTL2_redTime', 'SFTL2 Red Time'],
    ['SFTL2_greenTime', 'SFTL2 Green Time'],
    ['SFTL3_redTime', 'SFTL3 Red Time'],
    ['SFTL3_greenTime', 'SFTL3 Green Time'],
];

const DURATION_FIELDS = [
    ['activation_time', 'Activation Time'],
    ['actual_activation_time', 'Actual Activation'],
    ['response_time', 'Response Time (Input)'],
];

// Every placeholder the template actually prints, so we can tell the user which
// ones will come out blank instead of letting them find out in the deck.
const REPORT_FIELDS = [
    ['incident_number', 'Incident Number'],
    ['date', 'Date'],
    ['time', 'Incident Time'],
    ['arrival_time', 'Arrival Time'],
    ['move_off', 'Move Off Time'],
    ['response_time', 'Response Time'],
    ['real_response_time', 'Real Response Time'],
    ['actual_response_time', 'Actual Response Time'],
    ['activation_time', 'Activation Time'],
    ['actual_activation_time', 'Actual Activation'],
    ['time_exceeded', 'Time Exceeded'],
    ['y_n', 'Activation within 1 minute'],
    ['incident_type', 'Incident Type'],
    ['location', 'Location'],
    ['appliance_data', 'Appliance Data'],
    ['response_zone', 'Response Zone'],
    ['number_of_sftl', 'Number of SFTL'],
    ['sc', 'SC'],
    ['po', 'PO'],
    ['sftl1', 'SFTL1 Location'],
    ['SFTL1_redTime', 'SFTL1 Red Time'],
    ['SFTL1_greenTime', 'SFTL1 Green Time'],
    ['SFTL1_duration', 'SFTL1 Duration'],
    ['sftl2', 'SFTL2 Location'],
    ['SFTL2_redTime', 'SFTL2 Red Time'],
    ['SFTL2_greenTime', 'SFTL2 Green Time'],
    ['SFTL2_duration', 'SFTL2 Duration'],
    ['sftl3', 'SFTL3 Location'],
    ['SFTL3_redTime', 'SFTL3 Red Time'],
    ['SFTL3_greenTime', 'SFTL3 Green Time'],
    ['SFTL3_duration', 'SFTL3 Duration'],
];

const STATUS_STYLES = {
    error: { bg: 'rgba(239, 68, 68, 0.2)', fg: '#fca5a5', border: 'rgba(239, 68, 68, 0.5)' },
    warning: { bg: 'rgba(245, 158, 11, 0.2)', fg: '#fcd34d', border: 'rgba(245, 158, 11, 0.5)' },
    success: { bg: 'rgba(34, 197, 94, 0.2)', fg: '#86efac', border: 'rgba(34, 197, 94, 0.5)' },
};

const Form = () => {
    const [formData, setFormData] = useState({
        incident_number: '',
        date: new Date().toISOString().split('T')[0],
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

    // Separate state for images
    const [images, setImages] = useState({
        googleMapPic: null,
        acesPic: null,
        moveOffPic: null,
        sftl1RedPic: null,
        sftl1GreenPic: null,
        sftl2RedPic: null,
        sftl2GreenPic: null,
        sftl3RedPic: null,
        sftl3GreenPic: null,
        arrivalPic: null
    });

    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (status) setStatus(null);
    };

    const handleImageChange = (e) => {
        const { name, files } = e.target;
        if (files && files[0]) {
            setImages(prev => ({ ...prev, [name]: files[0] }));
            if (status) setStatus(null);
        }
    };

    const SECONDS_PER_DAY = 24 * 3600;

    // Split "HH:mm[:ss]" into numeric parts, or null if a part is empty or not a
    // number. Returning null rather than NaN is what lets the callers below tell
    // "no value given" apart from "a value we can safely calculate with" — every
    // guard down there is a !== null check, and NaN passes those.
    const splitTimeParts = (str, maxParts) => {
        const parts = str.split(':');
        if (parts.length < 2 || parts.length > maxParts) return null;
        if (parts.some(part => part.trim() === '')) return null;
        const nums = parts.map(Number);
        if (nums.some(n => !Number.isFinite(n))) return null;
        return nums;
    };

    // Helper: Parse HH:mm:ss to seconds from start of day
    const parseTimeToSeconds = (timeStr) => {
        if (!timeStr) return null;
        const parts = splitTimeParts(timeStr.trim(), 3);
        if (!parts) return null;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return parts[0] * 3600 + parts[1] * 60;
    };

    // Helper: Parse Duration to seconds. Supports MM:SS or plain minutes.
    const parseDurationToSeconds = (durStr) => {
        if (!durStr) return null;
        const str = durStr.trim();
        if (!str) return null;
        if (str.includes(':')) {
            const parts = splitTimeParts(str, 3);
            if (!parts) return null;
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            return parts[0] * 60 + parts[1];
        }
        if (!isNaN(str)) return Number(str) * 60;
        return null;
    };

    // Elapsed time between two clock times, wrapping over midnight so an incident
    // that moves off at 23:58 and arrives at 00:05 reads as 7 minutes rather than
    // as a negative duration.
    const elapsedBetween = (fromSec, toSec) => {
        const diff = toSec - fromSec;
        return diff < 0 ? diff + SECONDS_PER_DAY : diff;
    };

    // Helper: Format seconds to HH:mm:ss (Time of Day)
    const formatSecondsToTime = (totalSeconds) => {
        if (totalSeconds < 0) totalSeconds = 0;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Helper: Format seconds to "xx Min xx Sec" (Verbose Duration)
    const formatSecondsToVerbose = (totalSeconds) => {
        const isNegative = totalSeconds < 0;
        const absSeconds = Math.abs(totalSeconds);
        const m = Math.floor(absSeconds / 60);
        const s = Math.floor(absSeconds % 60);
        // User asked for "xx Min xx Sec". 8 mins = "08 Min 00 Sec"? or "8 Min 0 Sec"?
        // Template usually looks better with padding. I'll pad.
        const formatted = `${String(m).padStart(2, '0')} Min ${String(s).padStart(2, '0')} Sec`;
        return isNegative ? `-${formatted}` : formatted;
    };

    const formatTimeSeconds = (timeStr) => {
        if (!timeStr) return '';
        if (timeStr.length === 5) return `${timeStr}:00`;
        return timeStr;
    };

    // Refuse to build a report we know would be wrong. Two things are blocking:
    // a value that was typed but cannot be parsed, and a half-filled pair that
    // leaves a calculation impossible. Everything merely left blank is reported
    // afterwards as a warning, since a partial draft is a legitimate thing to want.
    const findBlockingProblems = (data) => {
        const problems = [];

        for (const [key, label] of TIME_FIELDS) {
            if (data[key] && parseTimeToSeconds(data[key]) === null) {
                problems.push(`${label}: "${data[key]}" is not a valid time. Use HH:mm or HH:mm:ss.`);
            }
        }

        for (const [key, label] of DURATION_FIELDS) {
            if (data[key] && parseDurationToSeconds(data[key]) === null) {
                problems.push(`${label}: "${data[key]}" is not a valid duration. Use MM:SS, for example 05:30.`);
            }
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        const problems = findBlockingProblems(formData);
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

        // C. Time Exceeded = Response Time - 8 minutes
        if (responseInputSec !== null) {
            const eightMins = 8 * 60; // 480 sec
            const exceededSec = responseInputSec - eightMins;
            processedData.time_exceeded = formatSecondsToVerbose(exceededSec);
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
            await generatePPTX(processedData, images);

            const blankFields = REPORT_FIELDS.filter(([key]) => !processedData[key]).map(([, label]) => label);
            const missingImages = UPLOAD_SLOTS.filter(slot => !images[slot.key]).map(slot => slot.label);

            const details = [];
            if (blankFields.length > 0) {
                details.push(`${blankFields.length} field${blankFields.length === 1 ? '' : 's'} printed blank: ${blankFields.join(', ')}.`);
            }
            if (missingImages.length > 0) {
                details.push(`${missingImages.length} of ${UPLOAD_SLOTS.length} evidence images not uploaded, so the template's placeholder graphics remain: ${missingImages.join(', ')}.`);
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
            <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Incident Data Entry</h2>

            {/* Incident Identification */}
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-primary)' }}>Identification</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Incident Number" name="incident_number" value={formData.incident_number} onChange={handleChange} required placeholder="eg. /YYYYMMDD/XXXX" />
                <FormInput label="Date" name="date" type="date" value={formData.date} onChange={handleChange} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Incident Type" name="incident_type" value={formData.incident_type} onChange={handleChange} />
                <FormInput label="Location" name="location" value={formData.location} onChange={handleChange} />
            </div>

            {/* Time Data (HH:mm:ss) - Clock Times */}
            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Timing (Clock Time)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Incident Time" name="time" type="time" step="1" value={formData.time} onChange={handleChange} />
                <FormInput label="Arrival Time" name="arrival_time" type="time" step="1" value={formData.arrival_time} onChange={handleChange} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Move Off Time" name="move_off" type="time" step="1" value={formData.move_off} onChange={handleChange} />
            </div>

            {/* Durations */}
            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Durations (MM:SS)</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Enter as 05:30. Output will be formatted as "xx Min xx Sec".</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Activation Time" name="activation_time" value={formData.activation_time} onChange={handleChange} placeholder="05:30" />
                <FormInput label="Actual Activation" name="actual_activation_time" value={formData.actual_activation_time} onChange={handleChange} placeholder="05:30" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Response Time (Input)" name="response_time" value={formData.response_time} onChange={handleChange} placeholder="10:00" />
            </div>

            {/* Other Metrics */}
            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Time Exceeded calculated now, maybe read only or hidden input override? I'll leave as display/override-able if needed. */}
                <FormInput label="Time Exceeded (Auto Calc)" name="time_exceeded" value={formData.time_exceeded} onChange={handleChange} placeholder="Calculated" />
                <div style={{ marginBottom: '1.5rem' }}>
                    <label htmlFor="y_n" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Activation within 1 minute?</label>
                    <select name="y_n" id="y_n" value={formData.y_n} onChange={handleChange} style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none', cursor: 'pointer' }}>
                        <option value="Y">Yes</option>
                        <option value="N">No</option>
                    </select>
                </div>
            </div>

            {/* Image Uploads */}
            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Evidence Images</h3>

            {/* Slide 1 & 2 */}
            <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>General Images</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Google Map Picture</label>
                    <input type="file" name="googleMapPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>ACES Picture</label>
                    <input type="file" name="acesPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
            </div>

            {/* Slide 3 - Sequence */}
            <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>Sequence Images</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Move Off Picture</label>
                    <input type="file" name="moveOffPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>Arrival Picture</label>
                    <input type="file" name="arrivalPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
            </div>

            <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', marginTop: '1rem' }}>SFTL 1</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>SFTL1 Red</label>
                    <input type="file" name="sftl1RedPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>SFTL1 Green</label>
                    <input type="file" name="sftl1GreenPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
            </div>

            <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', marginTop: '1rem' }}>SFTL 2</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>SFTL2 Red</label>
                    <input type="file" name="sftl2RedPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>SFTL2 Green</label>
                    <input type="file" name="sftl2GreenPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
            </div>

            <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', marginTop: '1rem' }}>SFTL 3</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>SFTL3 Red</label>
                    <input type="file" name="sftl3RedPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>SFTL3 Green</label>
                    <input type="file" name="sftl3GreenPic" onChange={handleImageChange} accept="image/*" style={{ color: 'var(--text-primary)' }} />
                </div>
            </div>


            {/* Operational Details */}
            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>Operational Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Appliance Data" name="appliance_data" value={formData.appliance_data} onChange={handleChange} />
                <FormInput label="Response Zone" name="response_zone" value={formData.response_zone} onChange={handleChange} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="Number of SFTL" name="number_of_sftl" value={formData.number_of_sftl} onChange={handleChange} />
                <FormInput label="SC" name="sc" value={formData.sc} onChange={handleChange} placeholder="eg. SGT1 Fa Zhi" />
            </div>
            <FormInput label="PO" name="po" value={formData.po} onChange={handleChange} placeholder="eg. SGT1 Fa Zhi" />

            {/* SFTL Data */}
            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>SFTL 1 Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="SFTL1 Location" name="sftl1" value={formData.sftl1} onChange={handleChange} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="SFTL1 Red Time" name="SFTL1_redTime" type="time" step="1" value={formData.SFTL1_redTime} onChange={handleChange} />
                <FormInput label="SFTL1 Green Time" name="SFTL1_greenTime" type="time" step="1" value={formData.SFTL1_greenTime} onChange={handleChange} />
            </div>

            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>SFTL 2 Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="SFTL2 Location" name="sftl2" value={formData.sftl2} onChange={handleChange} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="SFTL2 Red Time" name="SFTL2_redTime" type="time" step="1" value={formData.SFTL2_redTime} onChange={handleChange} />
                <FormInput label="SFTL2 Green Time" name="SFTL2_greenTime" type="time" step="1" value={formData.SFTL2_greenTime} onChange={handleChange} />
            </div>

            <h3 style={{ marginBottom: '1rem', marginTop: '1.5rem', color: 'var(--accent-primary)' }}>SFTL 3 Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="SFTL3 Location" name="sftl3" value={formData.sftl3} onChange={handleChange} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <FormInput label="SFTL3 Red Time" name="SFTL3_redTime" type="time" step="1" value={formData.SFTL3_redTime} onChange={handleChange} />
                <FormInput label="SFTL3 Green Time" name="SFTL3_greenTime" type="time" step="1" value={formData.SFTL3_greenTime} onChange={handleChange} />
            </div>

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
