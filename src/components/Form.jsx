import React, { useState } from 'react';
import FormInput from './FormInput';
import { generatePPTX } from '../utils/pptxGenerator';

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
        }
    };

    // Helper: Parse HH:mm:ss to seconds from start of day
    const parseTimeToSeconds = (timeStr) => {
        if (!timeStr) return null;
        const parts = timeStr.split(':').map(Number);
        if (parts.length < 2) return null;
        let seconds = 0;
        if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) seconds = parts[0] * 3600 + parts[1] * 60;
        return seconds;
    };

    // Helper: Parse Duration to seconds. Supports MM:SS or plain minutes.
    const parseDurationToSeconds = (durStr) => {
        if (!durStr) return null;
        if (durStr.includes(':')) {
            const parts = durStr.split(':').map(Number);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
        }
        if (!isNaN(durStr)) return Number(durStr) * 60;
        return null;
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

    const handleSubmit = async (e) => {
        e.preventDefault();
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
        let realResponseSec = 0;
        if (arrivalSec !== null && moveOffSec !== null) {
            realResponseSec = arrivalSec - moveOffSec;
            processedData.real_response_time = formatSecondsToVerbose(realResponseSec);
            // Backward compat
            processedData.rresponse_time = processedData.real_response_time;
        }

        // B. Actual Response Time = Activation + Real Response
        if (activationSec !== null) {
            // Note: Use calculated realResponseSec (even if 0/failed? assume inputs exist)
            // If realResponseSec dependent on missing inputs, result might be weird. we handle minimal check:
            const actualTotal = realResponseSec + activationSec;
            processedData.actual_response_time = formatSecondsToVerbose(actualTotal);
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
            processedData.SFTL1_duration = formatSecondsToVerbose(sftl1GreenSec - sftl1RedSec);
        }

        const sftl2RedSec = parseTimeToSeconds(processedData.SFTL2_redTime);
        const sftl2GreenSec = parseTimeToSeconds(processedData.SFTL2_greenTime);
        if (sftl2RedSec !== null && sftl2GreenSec !== null) {
            processedData.SFTL2_duration = formatSecondsToVerbose(sftl2GreenSec - sftl2RedSec);
        }

        const sftl3RedSec = parseTimeToSeconds(processedData.SFTL3_redTime);
        const sftl3GreenSec = parseTimeToSeconds(processedData.SFTL3_greenTime);
        if (sftl3RedSec !== null && sftl3GreenSec !== null) {
            processedData.SFTL3_duration = formatSecondsToVerbose(sftl3GreenSec - sftl3RedSec);
        }


        try {
            await generatePPTX(processedData, images);
            setStatus({ type: 'success', message: 'Presentation generated successfully!' });
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Failed to generate presentation. Please try again.' });
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
                    backgroundColor: status.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                    color: status.type === 'error' ? '#fca5a5' : '#86efac',
                    border: `1px solid ${status.type === 'error' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`
                }}>
                    {status.message}
                </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%' }}>
                {isLoading ? 'Generating...' : 'Download Presentation'}
            </button>
        </form>
    );
};

export default Form;
