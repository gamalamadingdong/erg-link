import type { CaptureNotificationEvidence, PM5CompletedCapture, PM5CompletedCaptureV2 } from './capture.js';
import { ErgMachineType, IntervalType, WorkoutType } from './types.js';

export const PM5_CAPTURE_VIOLATION_CODES = {
    CAPTURE_VERSION_UNSUPPORTED: 'capture_version_unsupported',
    WORKOUT_TYPE_UNSUPPORTED: 'workout_type_unsupported',
    CAPTURE_NOT_COMPLETED: 'capture_not_completed',
    END_SUMMARIES_MISSING: 'end_summaries_missing',
    WORK_DISTANCE_MISMATCH: 'work_distance_mismatch',
    REST_PRESENT: 'rest_present',
    FINAL_SPLIT_MISMATCH: 'final_split_mismatch',
    FINAL_STROKE_MISMATCH: 'final_stroke_mismatch',
    STROKE_COUNT_SEQUENCE_INVALID: 'stroke_count_sequence_invalid',
    STROKE_COUNT_SUMMARY_MISMATCH: 'stroke_count_summary_mismatch',
    STROKE_RATE_MISMATCH: 'stroke_rate_mismatch',
    STROKE_TIME_NOT_MONOTONIC: 'stroke_time_not_monotonic',
    STROKE_DISTANCE_NOT_MONOTONIC: 'stroke_distance_not_monotonic',
    STROKE_OUTSIDE_COMPLETED_WINDOW: 'stroke_outside_completed_window',
    PACE_TIME_MISMATCH: 'pace_time_mismatch',
    WATTS_PACE_MISMATCH: 'watts_pace_mismatch',
    PM_LOG_TIMESTAMP_MISSING: 'pm_log_timestamp_missing',
    ERG_MACHINE_NOT_ROWERG: 'erg_machine_not_rowerg',
    VERIFICATION_EVIDENCE_MISSING: 'verification_evidence_missing',
    START_STATE_EVIDENCE_MISSING: 'start_state_evidence_missing',
    RAW_SUMMARY_MISMATCH: 'raw_summary_mismatch',
    INTERVAL_COUNT_MISMATCH: 'interval_count_mismatch',
    INTERVAL_SEQUENCE_INVALID: 'interval_sequence_invalid',
    INTERVAL_TYPE_MISMATCH: 'interval_type_mismatch',
    INTERVAL_TOTALS_MISMATCH: 'interval_totals_mismatch',
    STROKE_INTERVAL_INVALID: 'stroke_interval_invalid',
} as const;

export type PM5CaptureViolationCode = typeof PM5_CAPTURE_VIOLATION_CODES[keyof typeof PM5_CAPTURE_VIOLATION_CODES];

export interface PM5CaptureViolation {
    code: PM5CaptureViolationCode;
    message: string;
}

export interface PM5CaptureValidationResult {
    valid: boolean;
    violations: PM5CaptureViolation[];
}

const FIXED_DISTANCE_TYPES = new Set<number>([
    WorkoutType.FIXED_DISTANCE_NO_SPLITS,
    WorkoutType.FIXED_DISTANCE_SPLITS,
]);
const FIXED_TIME_TYPES = new Set<number>([
    WorkoutType.FIXED_TIME_NO_SPLITS,
    WorkoutType.FIXED_TIME_SPLITS,
]);
const INTERVAL_TYPES = new Set<number>([
    WorkoutType.FIXED_TIME_INTERVAL,
    WorkoutType.FIXED_DISTANCE_INTERVAL,
    WorkoutType.VARIABLE_INTERVAL,
    WorkoutType.VARIABLE_INTERVAL_UNDEFINED_REST,
]);
const ROWERG_TYPES = new Set<number>([
    ErgMachineType.STATIC_D,
    ErgMachineType.STATIC_C,
    ErgMachineType.STATIC_A,
    ErgMachineType.STATIC_B,
    ErgMachineType.STATIC_E,
    ErgMachineType.STATIC_SIMULATOR,
    ErgMachineType.STATIC_DYNAMIC,
    ErgMachineType.SLIDES_A,
    ErgMachineType.SLIDES_B,
    ErgMachineType.SLIDES_C,
    ErgMachineType.SLIDES_D,
    ErgMachineType.SLIDES_E,
    ErgMachineType.LINKED_DYNAMIC,
]);

const DISTANCE_TOLERANCE_METERS = 0.1;
const PACE_RESOLUTION_SECONDS = 0.1;
const ELAPSED_TOLERANCE_SECONDS = 0.01;
const FINAL_STROKE_TIME_TOLERANCE_SECONDS = 0.21;

function within(left: number, right: number, tolerance: number): boolean {
    return Math.abs(left - right) <= tolerance;
}

function expectedWatts(paceSecondsPer500m: number): number {
    return 2.8 / Math.pow(paceSecondsPer500m / 500, 3);
}

function paceTimeTolerance(distanceMeters: number): number {
    return PACE_RESOLUTION_SECONDS / 2 * distanceMeters / 500 + ELAPSED_TOLERANCE_SECONDS;
}

function evidenceRetained(capture: PM5CompletedCaptureV2, evidence: CaptureNotificationEvidence): boolean {
    return capture.rawNotifications.some((raw) => raw.characteristic.toLowerCase() === evidence.characteristic.toLowerCase()
        && raw.receivedAt === evidence.receivedAt
        && raw.bytes.length === evidence.bytes.length
        && raw.bytes.every((byte, index) => byte === evidence.bytes[index]));
}

export function validatePm5Capture(capture: PM5CompletedCapture): PM5CaptureValidationResult {
    const violations: PM5CaptureViolation[] = [];
    const seen = new Set<PM5CaptureViolationCode>();
    const add = (code: PM5CaptureViolationCode, message: string): void => {
        if (!seen.has(code)) {
            seen.add(code);
            violations.push({ code, message });
        }
    };

    if (capture._v !== 2) {
        add(PM5_CAPTURE_VIOLATION_CODES.CAPTURE_VERSION_UNSUPPORTED, 'PM5 evidence validation requires capture version 2');
        return { valid: false, violations };
    }

    const v2: PM5CompletedCaptureV2 = capture;
    const workoutType = v2.rawEndSummary?.workoutType;
    const fixedDistance = workoutType !== undefined && FIXED_DISTANCE_TYPES.has(workoutType);
    const fixedTime = workoutType !== undefined && FIXED_TIME_TYPES.has(workoutType);
    const intervalWorkout = workoutType !== undefined && INTERVAL_TYPES.has(workoutType);
    const fixedTimeShape = fixedTime || workoutType === WorkoutType.FIXED_TIME_INTERVAL;
    const fixedDistanceShape = fixedDistance || workoutType === WorkoutType.FIXED_DISTANCE_INTERVAL;

    if (!fixedDistance && !fixedTime && !intervalWorkout) {
        add(PM5_CAPTURE_VIOLATION_CODES.WORKOUT_TYPE_UNSUPPORTED, 'Workout type is not a supported fixed-distance, fixed-time, or interval workout');
    }
    if (v2.status !== 'completed') {
        add(PM5_CAPTURE_VIOLATION_CODES.CAPTURE_NOT_COMPLETED, 'Capture status is not completed');
    }
    if (!v2.rawEndSummary || !v2.rawAdditionalEndSummary || !v2.rawAdditionalEndSummary2 || !v2.summary) {
        add(PM5_CAPTURE_VIOLATION_CODES.END_SUMMARIES_MISSING, 'Required PM5 end summaries are missing');
    }

    const summary = v2.summary;
    if (summary) {
        if (!v2.rawEndSummary || !v2.rawAdditionalEndSummary
            || !within(summary.workDistanceMeters, v2.rawEndSummary.distance / 10, DISTANCE_TOLERANCE_METERS)
            || !within(summary.workTimeSeconds, v2.rawEndSummary.elapsedTime / 100, ELAPSED_TOLERANCE_SECONDS)
            || !within(summary.averagePaceSecondsPer500m, v2.rawEndSummary.averagePace / 10, PACE_RESOLUTION_SECONDS)
            || summary.averageStrokeRate !== v2.rawEndSummary.averageStrokeRate
            || summary.averageWatts !== v2.rawAdditionalEndSummary.watts
            || summary.totalCalories !== v2.rawAdditionalEndSummary.totalCalories
            || summary.restDistanceMeters !== v2.rawAdditionalEndSummary.totalRestDistance
            || summary.restTimeSeconds !== v2.rawAdditionalEndSummary.restTime) {
            add(PM5_CAPTURE_VIOLATION_CODES.RAW_SUMMARY_MISMATCH, 'Normalized totals do not match raw PM5 end summaries');
        }

        const prescribedDistance = v2.startState?.status.totalWorkDistance;
        if (fixedDistance && (!prescribedDistance || summary.workDistanceMeters !== prescribedDistance)) {
            add(PM5_CAPTURE_VIOLATION_CODES.WORK_DISTANCE_MISMATCH, 'Completed distance does not match the PM5 fixed-distance target');
        }
        if ((fixedDistance || fixedTime) && (summary.restTimeSeconds !== 0 || summary.restDistanceMeters !== 0)) {
            add(PM5_CAPTURE_VIOLATION_CODES.REST_PRESENT, 'Single-piece evidence contains rest time or distance');
        }

        const finalSplit = v2.splits.at(-1);
        if (!finalSplit
            || !within(finalSplit.cumulativeDistanceMeters, summary.workDistanceMeters, DISTANCE_TOLERANCE_METERS)
            || !within(finalSplit.elapsedSeconds, summary.workTimeSeconds, ELAPSED_TOLERANCE_SECONDS)) {
            add(PM5_CAPTURE_VIOLATION_CODES.FINAL_SPLIT_MISMATCH, 'Final split does not reconcile with completed totals');
        }

        const finalStroke = v2.strokes.at(-1);
        const distanceAllowance = (finalStroke?.strokeDistanceMeters ?? 0) + DISTANCE_TOLERANCE_METERS;
        const timeAllowance = (finalStroke?.driveTimeSeconds ?? 0)
            + (finalStroke?.recoveryTimeSeconds ?? 0)
            + FINAL_STROKE_TIME_TOLERANCE_SECONDS;
        if (!finalStroke
            || finalStroke.cumulativeDistanceMeters > summary.workDistanceMeters + DISTANCE_TOLERANCE_METERS
            || summary.workDistanceMeters - finalStroke.cumulativeDistanceMeters > distanceAllowance
            || finalStroke.elapsedSeconds > summary.workTimeSeconds + ELAPSED_TOLERANCE_SECONDS
            || summary.workTimeSeconds - finalStroke.elapsedSeconds > timeAllowance) {
            add(PM5_CAPTURE_VIOLATION_CODES.FINAL_STROKE_MISMATCH, 'Final stroke does not reconcile with completed totals');
        }

        const expectedTime = summary.averagePaceSecondsPer500m * summary.workDistanceMeters / 500;
        if (!within(expectedTime, summary.workTimeSeconds, paceTimeTolerance(summary.workDistanceMeters))) {
            add(PM5_CAPTURE_VIOLATION_CODES.PACE_TIME_MISMATCH, 'Average pace does not reconcile with work time');
        }
        if (Math.abs(Math.round(expectedWatts(summary.averagePaceSecondsPer500m)) - summary.averageWatts) > 1) {
            add(PM5_CAPTURE_VIOLATION_CODES.WATTS_PACE_MISMATCH, 'Average watts do not reconcile with the Concept2 pace relationship');
        }
        if (v2.strokes.length !== summary.strokeCount || v2.strokes.at(-1)?.strokeCount !== summary.strokeCount) {
            add(PM5_CAPTURE_VIOLATION_CODES.STROKE_COUNT_SUMMARY_MISMATCH, 'Normalized strokes do not match the completed stroke count');
        }
        if (summary.workTimeSeconds > 0) {
            const measuredRate = v2.strokes.length / summary.workTimeSeconds * 60;
            if (Math.abs(measuredRate - summary.averageStrokeRate) > 1) {
                add(PM5_CAPTURE_VIOLATION_CODES.STROKE_RATE_MISMATCH, 'Stroke count and work time do not reconcile with average stroke rate');
            }
        }
    }

    let previousCount = 0;
    let previousTime = -1;
    let previousDistance = -1;
    for (const stroke of v2.strokes) {
        if (stroke.strokeCount !== previousCount + 1) {
            add(PM5_CAPTURE_VIOLATION_CODES.STROKE_COUNT_SEQUENCE_INVALID, 'Stroke counts are not contiguous');
        }
        if (stroke.elapsedSeconds <= previousTime) {
            add(PM5_CAPTURE_VIOLATION_CODES.STROKE_TIME_NOT_MONOTONIC, 'Stroke time is not strictly increasing');
        }
        if (stroke.cumulativeDistanceMeters <= previousDistance) {
            add(PM5_CAPTURE_VIOLATION_CODES.STROKE_DISTANCE_NOT_MONOTONIC, 'Stroke distance is not strictly increasing');
        }
        if (summary && (stroke.elapsedSeconds < 0
            || stroke.elapsedSeconds > summary.workTimeSeconds + ELAPSED_TOLERANCE_SECONDS
            || stroke.cumulativeDistanceMeters < 0
            || stroke.cumulativeDistanceMeters > summary.workDistanceMeters + DISTANCE_TOLERANCE_METERS)) {
            add(PM5_CAPTURE_VIOLATION_CODES.STROKE_OUTSIDE_COMPLETED_WINDOW, 'A stroke falls outside the completed workout window');
        }
        previousCount = stroke.strokeCount;
        previousTime = stroke.elapsedSeconds;
        previousDistance = stroke.cumulativeDistanceMeters;
    }

    if (!v2.pmLogTimestamp
        || !v2.rawEndSummary
        || v2.pmLogTimestamp.dateValue !== v2.rawEndSummary.logDate
        || v2.pmLogTimestamp.timeValue !== v2.rawEndSummary.logTime) {
        add(PM5_CAPTURE_VIOLATION_CODES.PM_LOG_TIMESTAMP_MISSING, 'PM log date and time are missing or inconsistent');
    }
    if (v2.ergMachineType === undefined || !ROWERG_TYPES.has(v2.ergMachineType)) {
        add(PM5_CAPTURE_VIOLATION_CODES.ERG_MACHINE_NOT_ROWERG, 'Capture machine type is not a RowErg');
    }
    if (!v2.verification
        || !v2.rawAdditionalEndSummary2
        || !v2.verification.evidence.characteristic.toLowerCase().includes('003c')
        || !evidenceRetained(v2, v2.verification.evidence)) {
        add(PM5_CAPTURE_VIOLATION_CODES.VERIFICATION_EVIDENCE_MISSING, 'Retained PM5 0x003C verification evidence is missing');
    }
    const start = v2.startState?.status;
    if (!start
        || !v2.startState?.evidence.characteristic.toLowerCase().includes('0031')
        || !evidenceRetained(v2, v2.startState.evidence)
        || start.elapsedTime > 100
        || start.distance !== 0
        || start.rowingState !== 0
        || ![0, 1].includes(start.strokeState)) {
        add(PM5_CAPTURE_VIOLATION_CODES.START_STATE_EVIDENCE_MISSING, 'Retained start-state evidence does not support a stationary flywheel');
    }

    const expectedIntervals = v2.rawAdditionalEndSummary?.intervalCount;
    if (expectedIntervals !== undefined && expectedIntervals !== v2.splits.length) {
        add(PM5_CAPTURE_VIOLATION_CODES.INTERVAL_COUNT_MISMATCH, 'Split count does not match the PM5 end summary');
    }
    for (let index = 0; index < v2.splits.length; index += 1) {
        if (v2.splits[index].intervalNumber !== index + 1) {
            add(PM5_CAPTURE_VIOLATION_CODES.INTERVAL_SEQUENCE_INVALID, 'Interval numbers are not contiguous');
        }
    }

    const expectedIntervalType = fixedTimeShape ? IntervalType.TIME : fixedDistanceShape ? IntervalType.DISTANCE : undefined;
    const firstSplitType = v2.splits[0]?.intervalType;
    const lastSplitType = v2.splits.at(-1)?.intervalType;
    if ((expectedIntervalType !== undefined && (
        v2.startState?.status.intervalType !== expectedIntervalType
        || v2.rawAdditionalEndSummary?.intervalType !== expectedIntervalType
        || v2.splits.some((split) => split.intervalType !== expectedIntervalType)
    )) || ((workoutType === WorkoutType.VARIABLE_INTERVAL || workoutType === WorkoutType.VARIABLE_INTERVAL_UNDEFINED_REST) && (
        v2.startState?.status.intervalType !== firstSplitType
        || v2.rawAdditionalEndSummary?.intervalType !== lastSplitType
    ))) {
        add(PM5_CAPTURE_VIOLATION_CODES.INTERVAL_TYPE_MISMATCH, 'Workout and split interval types contradict each other');
    }

    if (intervalWorkout && summary) {
        const splitDistance = v2.splits.reduce((total, split) => total + split.workDistanceMeters, 0);
        const splitTime = v2.splits.reduce((total, split) => total + split.workTimeSeconds, 0);
        if (!within(splitDistance, summary.workDistanceMeters, Math.max(DISTANCE_TOLERANCE_METERS, v2.splits.length * 0.5))
            || !within(splitTime, summary.workTimeSeconds, Math.max(ELAPSED_TOLERANCE_SECONDS, v2.splits.length * 0.05 + ELAPSED_TOLERANCE_SECONDS))) {
            add(PM5_CAPTURE_VIOLATION_CODES.INTERVAL_TOTALS_MISMATCH, 'Interval work totals do not reconcile with completed totals');
        }
        const splitsByNumber = new Map(v2.splits.map((split) => [split.intervalNumber, split]));
        for (const [intervalNumber, split] of splitsByNumber) {
            const strokes = v2.strokes.filter((stroke) => stroke.intervalNumber === intervalNumber);
            let priorTime = -1;
            let priorDistance = -1;
            for (const stroke of strokes) {
                if (stroke.intervalElapsedSeconds <= priorTime || stroke.intervalDistanceMeters <= priorDistance) {
                    add(PM5_CAPTURE_VIOLATION_CODES.STROKE_INTERVAL_INVALID, 'Interval-local stroke evidence is not monotonic');
                }
                priorTime = stroke.intervalElapsedSeconds;
                priorDistance = stroke.intervalDistanceMeters;
            }
            const finalStroke = strokes.at(-1);
            if (!finalStroke
                || finalStroke.intervalElapsedSeconds > split.workTimeSeconds + ELAPSED_TOLERANCE_SECONDS
                || split.workTimeSeconds - finalStroke.intervalElapsedSeconds > finalStroke.driveTimeSeconds + finalStroke.recoveryTimeSeconds + FINAL_STROKE_TIME_TOLERANCE_SECONDS
                || finalStroke.intervalDistanceMeters > split.workDistanceMeters + DISTANCE_TOLERANCE_METERS
                || split.workDistanceMeters - finalStroke.intervalDistanceMeters > finalStroke.strokeDistanceMeters + DISTANCE_TOLERANCE_METERS) {
                add(PM5_CAPTURE_VIOLATION_CODES.STROKE_INTERVAL_INVALID, 'A stroke does not reconcile with its recorded interval');
            }
        }
        if (v2.strokes.some((stroke) => !splitsByNumber.has(stroke.intervalNumber))) {
            add(PM5_CAPTURE_VIOLATION_CODES.STROKE_INTERVAL_INVALID, 'A stroke references an unknown interval');
        }
    }

    return { valid: violations.length === 0, violations };
}
