// What the report is made of: which fields exist, which report type prints
// which, what kind of value each one holds, and which ones only deterministic
// code is allowed to produce.
//
// These lists used to sit inside the Form component alongside the JSX. Pulling
// them out lets the extraction path derive its allowlist from the same source
// the form renders from, so a field can never be extractable without being a
// real field on a real slide.

// Clock-time and duration fields, paired with the label shown on the form so a
// validation message points at the box the user has to go and fix.
export const TIME_FIELDS = [
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

export const DURATION_FIELDS = [
    ['activation_time', 'Activation Time'],
    ['actual_activation_time', 'Actual Activation'],
    ['response_time', 'Response Time (Input)'],
];

// Every placeholder the template actually prints, so we can tell the user which
// ones will come out blank instead of letting them find out in the deck.
export const REPORT_FIELDS = [
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

export const FIELD_LABELS = Object.fromEntries(REPORT_FIELDS);

// The subset of REPORT_FIELDS each report type actually prints. A late activation
// report is slide 2 on its own, so it prints four fields. Everything else stays in
// state — switching mode must not throw away what has already been typed — but is
// not shown, not validated and not warned about.
const LATE_ACTIVATION_FIELDS = ['incident_number', 'appliance_data', 'activation_time', 'actual_activation_time'];

// null means "all of them", which is what the late response deck prints.
export const MODE_FIELDS = {
    late_response: null,
    late_activation: LATE_ACTIVATION_FIELDS,
};

export const modePrintsField = (mode, key) => {
    const fields = MODE_FIELDS[mode];
    return fields === null || fields.includes(key);
};

// ---------------------------------------------------------------------------
// Extraction contract
// ---------------------------------------------------------------------------

// Values the application computes. A model that supplies one of these is
// answering a question it was not asked: the arithmetic on this document is
// deterministic, and a plausible-looking Time Exceeded that was not derived
// from the Response Time above it is the single worst thing this feature could
// produce. Denied in the request schema and again after the response.
export const DERIVED_FIELDS = [
    'incident_no',
    'rresponse_time',
    'real_response_time',
    'actual_response_time',
    'time_exceeded',
    'SFTL1_duration',
    'SFTL2_duration',
    'SFTL3_duration',
];

// Judgement calls the operator keeps. y_n is a Y/N assertion whose source
// semantics are still unsettled (see .planning/codebase/CONCERNS.md on the
// late-activation rule), so nothing infers it from an activation duration.
export const MANUAL_FIELDS = ['y_n'];

// How each extractable field's raw text is normalized. Anything not listed
// here is not extractable.
export const FIELD_TYPE = {
    date: 'date',

    time: 'clock',
    arrival_time: 'clock',
    move_off: 'clock',
    SFTL1_redTime: 'clock',
    SFTL1_greenTime: 'clock',
    SFTL2_redTime: 'clock',
    SFTL2_greenTime: 'clock',
    SFTL3_redTime: 'clock',
    SFTL3_greenTime: 'clock',

    activation_time: 'duration',
    actual_activation_time: 'duration',
    response_time: 'duration',

    number_of_sftl: 'count',

    incident_number: 'text',
    incident_type: 'text',
    location: 'text',
    appliance_data: 'text',
    response_zone: 'text',
    sc: 'text',
    po: 'text',
    sftl1: 'text',
    sftl2: 'text',
    sftl3: 'text',
};

// The fields a model may propose for a given report type: what the mode prints,
// minus everything the application derives, minus the manual judgements, and
// only where we know how to normalize the answer. Derived from REPORT_FIELDS
// rather than written out again, so a template change cannot quietly widen it.
export const extractableFieldsFor = (mode) =>
    REPORT_FIELDS
        .map(([key]) => key)
        .filter((key) =>
            modePrintsField(mode, key) &&
            !DERIVED_FIELDS.includes(key) &&
            !MANUAL_FIELDS.includes(key) &&
            Object.prototype.hasOwnProperty.call(FIELD_TYPE, key)
        );
