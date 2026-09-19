import {
    CSAFE_DEST_ADDR,
    CSAFE_SETPMCFG_CMD,
    CSAFE_PM_SET_WORKOUTTYPE,
    CSAFE_PM_SET_WORKOUTDURATION,
    CSAFE_PM_SET_RESTDURATION,
    CSAFE_PM_SET_SPLITDURATION,
    CSAFE_PM_CONFIGURE_WORKOUT,
    CSAFE_PM_SET_SCREENSTATE,
    CSAFE_PM_SET_INTERVALTYPE,
    CSAFE_PM_WORKOUTINTERVALCOUNT,
    CSAFE_PM_SET_RACEOPERATIONTYPE,
    WorkoutType as CSAFEWorkoutType,
    WorkoutDurationType,
    ScreenType,
    ScreenValue,
    CSAFE_SRC_ADDR,
} from '../../constants/csafe';
import type { ActiveWorkoutSpec } from '../../types/ergSession.types';
import { buildExtendedCSAFEFrame, buildStandardCSAFEFrame } from './frame';

// ============================================================================
// LOW-LEVEL FRAME CONSTRUCTION
// ============================================================================

/**
 * Constructs a standard CSAFE frame with command, data, checksum, and byte-stuffing.
 */
export function buildCSAFEFrame(command: number, data: number[]): Uint8Array {
    const content = [command];

    // Length byte: Required for "Long Commands" (cmd < 0x80)
    if (command < 0x80) {
        content.push(data.length);
    }

    content.push(...data);

    return new Uint8Array(buildStandardCSAFEFrame(content));
}

/**
 * Wraps a C2 proprietary payload in a CSAFE frame.
 * Frame format: [F1, 76, len, ...payload, checksum, F2]
 */
export function buildProprietaryFrame(payload: number[]): Uint8Array {
    return new Uint8Array(buildStandardCSAFEFrame([
        CSAFE_SETPMCFG_CMD,
        payload.length,
        ...payload,
    ]));
}

// ============================================================================
// PAYLOAD HELPERS
// ============================================================================

/** Push a single byte (uint8) to a payload array */
function pushPayload8(arr: number[], val: number): void {
    arr.push(val & 0xFF);
}

/** Push a 32-bit value (big-endian) to a payload array */
function pushPayload32(arr: number[], val: number): void {
    arr.push((val >> 24) & 0xFF);
    arr.push((val >> 16) & 0xFF);
    arr.push((val >> 8) & 0xFF);
    arr.push(val & 0xFF);
}

// ============================================================================
// WORKOUT PROGRAMMING
// ============================================================================

/** Workout configuration for PM5 programming */
export interface WorkoutConfig {
    type: 'just_row' | 'fixed_distance' | 'fixed_time' | 'interval_distance' | 'interval_time' | 'variable_interval';
    value?: number;
    split?: number;
    rest?: number;
    repeats?: number;
    intervals?: Array<{
        type: 'distance' | 'time' | 'rest';
        value: number;
        rest?: number;
    }>;
}

export function activeWorkoutSpecToWorkoutConfig(workout: ActiveWorkoutSpec): WorkoutConfig {
    return {
        type: workout.type,
        value: workout.value,
        split: workout.split_value,
        rest: workout.rest,
        repeats: workout.repeats,
        intervals: workout.intervals?.map((interval) => ({
            type: interval.type,
            value: interval.value,
            rest: interval.rest,
        })),
    };
}

/**
 * Builds CSAFE frames to program a workout on the PM5.
 * Returns one or more frames (variable intervals require chunked sends).
 */
export function buildWorkoutFrames(workout: WorkoutConfig): Uint8Array[] {
    // --- VARIABLE INTERVAL: multiple chunked frames ---
    if (workout.type === 'variable_interval' && workout.intervals) {
        return buildVariableIntervalFrames(workout.intervals);
    }

    // --- STANDARD WORKOUT: single frame ---
    const payload: number[] = [];

    // Command 1: SET_WORKOUTTYPE
    pushPayload8(payload, CSAFE_PM_SET_WORKOUTTYPE);
    pushPayload8(payload, 0x01);

    let workoutType = 0;
    if (workout.type === 'fixed_time') workoutType = CSAFEWorkoutType.FixedTimeSplits;
    else if (workout.type === 'fixed_distance') workoutType = CSAFEWorkoutType.FixedDistSplits;
    else if (workout.type === 'interval_distance') workoutType = CSAFEWorkoutType.FixedDistInterval;
    else if (workout.type === 'interval_time') workoutType = CSAFEWorkoutType.FixedTimeInterval;
    else workoutType = CSAFEWorkoutType.JustRowSplits;

    pushPayload8(payload, workoutType);

    if (workout.type !== 'just_row') {
        // Command 2: SET_WORKOUTDURATION
        pushPayload8(payload, CSAFE_PM_SET_WORKOUTDURATION);
        pushPayload8(payload, 0x05); // 1 type + 4 value

        if (workout.type === 'fixed_time' || workout.type === 'interval_time') {
            pushPayload8(payload, WorkoutDurationType.Time);
            const timeCentiseconds = Math.round((workout.value || 0) * 100);
            pushPayload32(payload, timeCentiseconds);
        } else if (workout.type === 'fixed_distance' || workout.type === 'interval_distance') {
            pushPayload8(payload, WorkoutDurationType.Distance);
            pushPayload32(payload, Math.round(workout.value || 0));
        }
    }

    if ((workout.type === 'interval_time' || workout.type === 'interval_distance') &&
        workout.rest !== undefined) {
        pushPayload8(payload, CSAFE_PM_SET_RESTDURATION);
        pushPayload8(payload, 0x02);
        const restSeconds = Math.round(workout.rest);
        pushPayload8(payload, (restSeconds >> 8) & 0xFF);
        pushPayload8(payload, restSeconds & 0xFF);
    }

    // Command 3: SET_SPLITDURATION (for fixed workouts)
    if (workout.type === 'fixed_time') {
        pushPayload8(payload, CSAFE_PM_SET_SPLITDURATION);
        pushPayload8(payload, 0x05);
        pushPayload8(payload, WorkoutDurationType.Time);
        const split = (workout.split || 300) * 100; // default 5 min
        pushPayload32(payload, split);
    } else if (workout.type === 'fixed_distance') {
        pushPayload8(payload, CSAFE_PM_SET_SPLITDURATION);
        pushPayload8(payload, 0x05);
        pushPayload8(payload, WorkoutDurationType.Distance);
        const split = workout.split || 500; // default 500m
        pushPayload32(payload, split);
    }

    // Command 4: CONFIGURE_WORKOUT
    pushPayload8(payload, CSAFE_PM_CONFIGURE_WORKOUT);
    pushPayload8(payload, 0x01);
    pushPayload8(payload, 0x01); // Enable Program Mode

    // Command 5: SET_SCREENSTATE
    pushPayload8(payload, CSAFE_PM_SET_SCREENSTATE);
    pushPayload8(payload, 0x02);
    pushPayload8(payload, ScreenType.Workout);
    pushPayload8(payload, ScreenValue.PrepareToRow);

    return [buildProprietaryFrame(payload)];
}

/**
 * Builds chunked frames for variable interval workouts.
 * Each interval gets its own frame; the last one includes CONFIGURE + SCREEN commands.
 */
function buildVariableIntervalFrames(
    intervals: Array<{ type: 'distance' | 'time' | 'rest'; value: number; rest?: number }>
): Uint8Array[] {
    const frames: Uint8Array[] = [];

    for (let i = 0; i < intervals.length; i++) {
        const interval = intervals[i];
        const isLast = i === intervals.length - 1;
        const payload: number[] = [];

        if (i === 0) {
            pushPayload8(payload, CSAFE_PM_SET_WORKOUTTYPE);
            pushPayload8(payload, 0x01);
            pushPayload8(payload, CSAFEWorkoutType.VariableInterval);
        }

        pushPayload8(payload, CSAFE_PM_WORKOUTINTERVALCOUNT);
        pushPayload8(payload, 0x01);
        pushPayload8(payload, i);

        if (interval.type === 'rest') {
            throw new Error('Variable workout intervals must be work intervals with optional rest');
        }
        pushPayload8(payload, CSAFE_PM_SET_INTERVALTYPE);
        pushPayload8(payload, 0x01);
        pushPayload8(payload, interval.type === 'time' ? 0x00 : 0x01);

        // SET_WORKOUTDURATION
        pushPayload8(payload, CSAFE_PM_SET_WORKOUTDURATION);
        pushPayload8(payload, 0x05);

        if (interval.type === 'time') {
            pushPayload8(payload, WorkoutDurationType.Time);
            pushPayload32(payload, Math.round(interval.value * 100)); // centiseconds
        } else {
            pushPayload8(payload, WorkoutDurationType.Distance);
            pushPayload32(payload, Math.round(interval.value)); // meters
        }

        // SET_RESTDURATION (if provided)
        if (interval.rest !== undefined) {
            pushPayload8(payload, CSAFE_PM_SET_RESTDURATION);
            pushPayload8(payload, 0x02);
            const restSec = Math.round(interval.rest);
            pushPayload8(payload, (restSec >> 8) & 0xFF);
            pushPayload8(payload, restSec & 0xFF);
        }

        // Last chunk: finalize with CONFIGURE + SCREEN
        if (isLast) {
            pushPayload8(payload, CSAFE_PM_CONFIGURE_WORKOUT);
            pushPayload8(payload, 0x01);
            pushPayload8(payload, 0x01);

            pushPayload8(payload, CSAFE_PM_SET_SCREENSTATE);
            pushPayload8(payload, 0x02);
            pushPayload8(payload, ScreenType.Workout);
            pushPayload8(payload, ScreenValue.PrepareToRow);
        }

        frames.push(buildProprietaryFrame(payload));
    }

    return frames;
}

// ============================================================================
// RACE CONTROL
// ============================================================================

/**
 * Builds a CSAFE frame to set the race operation state on PM5.
 */
export function buildRaceStateFrame(state: number): Uint8Array {
    const payload: number[] = [];
    payload.push(CSAFE_PM_SET_RACEOPERATIONTYPE);
    payload.push(0x01); // byte count
    payload.push(state);

    const contents = [CSAFE_SETPMCFG_CMD, payload.length, ...payload];
    if (state === 0) return new Uint8Array(buildStandardCSAFEFrame(contents));
    return new Uint8Array(buildExtendedCSAFEFrame(contents, CSAFE_DEST_ADDR, CSAFE_SRC_ADDR));
}
