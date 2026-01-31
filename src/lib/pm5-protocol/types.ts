/**
 * PM5 Protocol Types and Constants
 * 
 * Based on Concept2 PM CSAFE Communication Definition V0.27
 * See: docs/concept2-pm5-reference/PM5_CSAFE_SPEC.md
 */

// ============================================================================
// BLUETOOTH SERVICE & CHARACTERISTIC UUIDs
// ============================================================================

/**
 * C2 PM Base UUID Pattern: CE06XXXX-43E5-11E4-916C-0800200C9A66
 * where XXXX is the specific service/characteristic identifier
 */

/** PM5 Bluetooth Service UUIDs */
export const PM5_SERVICES = {
    /** Standard BLE Device Information Service */
    DEVICE_INFO: '0000180a-0000-1000-8000-00805f9b34fb',
    /** Concept2-specific device info (firmware, serial, etc.) */
    C2_DEVICE_INFO: 'ce060010-43e5-11e4-916c-0800200c9a66',
    /** PM Control Service - for sending commands */
    PM_CONTROL: 'ce060020-43e5-11e4-916c-0800200c9a66',
    /** Rowing Service - primary data service (CE060030) */
    ROWING: 'ce060030-43e5-11e4-916c-0800200c9a66',
    /** Heart Rate Service */
    HEART_RATE: 'ce060040-43e5-11e4-916c-0800200c9a66',
    /** Alias for ROWING - backward compatibility */
    PM5: 'ce060030-43e5-11e4-916c-0800200c9a66',
    /** Device Information alias */
    DEVICE_INFORMATION: '0000180a-0000-1000-8000-00805f9b34fb',
    /** Control alias */
    CONTROL: 'ce060020-43e5-11e4-916c-0800200c9a66',
} as const;

/** PM5 Bluetooth Characteristic UUIDs - within the Rowing Service (0x0030) */
export const PM5_CHARACTERISTICS = {
    // ========== Rowing Service Characteristics (CE060030) ==========

    /** General Status (19 bytes) - elapsed time, distance, workout/rowing state */
    ROWING_GENERAL_STATUS: 'ce060031-43e5-11e4-916c-0800200c9a66',

    /** Additional Status 1 (17 bytes) - speed, stroke rate, pace, heart rate */
    ROWING_ADDITIONAL_STATUS1: 'ce060032-43e5-11e4-916c-0800200c9a66',

    /** Additional Status 2 (20 bytes) - interval count, power, calories, split data */
    ROWING_ADDITIONAL_STATUS2: 'ce060033-43e5-11e4-916c-0800200c9a66',

    /** Sample Rate (1 byte) - controls notification rate (0=1s, 1=500ms, 2=250ms, 3=100ms) */
    SAMPLE_RATE: 'ce060034-43e5-11e4-916c-0800200c9a66',

    /** Stroke Data (20 bytes) - per-stroke metrics */
    STROKE_DATA: 'ce060035-43e5-11e4-916c-0800200c9a66',

    /** Additional Stroke Data (15 bytes) - projected time/distance */
    ADDITIONAL_STROKE_DATA: 'ce060036-43e5-11e4-916c-0800200c9a66',

    /** Split/Interval Data (18 bytes) */
    SPLIT_INTERVAL_DATA: 'ce060037-43e5-11e4-916c-0800200c9a66',

    /** Additional Split/Interval Data (19 bytes) */
    ADDITIONAL_SPLIT_INTERVAL_DATA: 'ce060038-43e5-11e4-916c-0800200c9a66',

    /** End of Workout Summary (20 bytes) */
    END_OF_WORKOUT_SUMMARY: 'ce060039-43e5-11e4-916c-0800200c9a66',

    /** End of Workout Additional Summary (19 bytes) */
    END_OF_WORKOUT_ADDITIONAL_SUMMARY: 'ce06003a-43e5-11e4-916c-0800200c9a66',

    /** Heart Rate Belt Info (6 bytes) */
    HEART_RATE_BELT_INFO: 'ce06003b-43e5-11e4-916c-0800200c9a66',

    /** Force Curve Data (variable, multiple notifications) */
    FORCE_CURVE_DATA: 'ce06003d-43e5-11e4-916c-0800200c9a66',

    /** Additional Status 3 (12 bytes) - operational state, screen info, game score */
    ROWING_ADDITIONAL_STATUS3: 'ce06003e-43e5-11e4-916c-0800200c9a66',

    /** Logged Workout Info (15 bytes) */
    LOGGED_WORKOUT_INFO: 'ce06003f-43e5-11e4-916c-0800200c9a66',

    /** Multiplexed Information (up to 20 bytes) - aggregated data stream */
    MULTIPLEXED_INFO: 'ce060080-43e5-11e4-916c-0800200c9a66',

    // ========== PM Control Service Characteristics (CE060020) ==========

    /** CSAFE Receive - write CSAFE commands to PM */
    CSAFE_RX: 'ce060021-43e5-11e4-916c-0800200c9a66',

    /** CSAFE Transmit - read CSAFE responses from PM */
    CSAFE_TX: 'ce060022-43e5-11e4-916c-0800200c9a66',
} as const;

// ============================================================================
// ROWING STATE ENUMERATIONS
// ============================================================================

/** Operational State - overall PM state */
export const OperationalState = {
    ERROR: 0,
    READY: 1,
    IDLE: 2,
    HAVE_ID: 3,
    IN_USE: 5,
    PAUSE: 6,
    FINISH: 7,
    MANUAL: 8,
    OFFLINE: 9,
} as const;
export type OperationalStateType = typeof OperationalState[keyof typeof OperationalState];

/** Workout Type - current workout configuration */
export const WorkoutType = {
    JUST_ROW_NO_SPLITS: 0,
    JUST_ROW_SPLITS: 1,
    FIXED_DISTANCE_NO_SPLITS: 2,
    FIXED_DISTANCE_SPLITS: 3,
    FIXED_TIME_NO_SPLITS: 4,
    FIXED_TIME_SPLITS: 5,
    FIXED_TIME_INTERVAL: 6,
    FIXED_DISTANCE_INTERVAL: 7,
    VARIABLE_INTERVAL: 8,
    VARIABLE_INTERVAL_UNDEFINED_REST: 9,
    FIXED_CALORIE_SPLITS: 10,
    FIXED_WATT_MINUTE_SPLITS: 11,
    FIXED_CALS_INTERVAL: 12,
    NUM: 13,
} as const;
export type WorkoutTypeType = typeof WorkoutType[keyof typeof WorkoutType];

/** Interval Type - current interval type during workout */
export const IntervalType = {
    TIME: 0,
    DISTANCE: 1,
    REST: 2,
    TIME_UNDEFINED_REST: 3,
    DISTANCE_UNDEFINED_REST: 4,
    UNDEFINED_REST: 5,
    CALORIE: 6,
    CALORIE_UNDEFINED_REST: 7,
    WATT_MINUTE: 8,
    WATT_MINUTE_UNDEFINED_REST: 9,
} as const;
export type IntervalTypeType = typeof IntervalType[keyof typeof IntervalType];

/** Workout State - current workout progress state */
export const WorkoutState = {
    WAITING: 0,
    WORKOUT_ROW: 1,
    COUNTDOWN_PAUSE: 2,
    INTERVAL_REST: 3,
    WORK_TIME_INTERVAL: 4,
    WORK_DISTANCE_INTERVAL: 5,
    REST_END_TIME: 6,
    REST_END_DISTANCE: 7,
    TIME_WORKOUT_END: 8,
    DISTANCE_WORKOUT_END: 9,
    WORKOUT_END: 10,
    TERMINATE_WORKOUT: 11,
    WORKOUT_LOGGED: 12,
    REARM: 13,
} as const;
export type WorkoutStateType = typeof WorkoutState[keyof typeof WorkoutState];

/** Rowing State - current rowing activity state */
export const RowingState = {
    INACTIVE: 0,
    ACTIVE: 1,
} as const;
export type RowingStateType = typeof RowingState[keyof typeof RowingState];

/** Stroke State - current stroke phase */
export const StrokeState = {
    WAITING: 0,
    DRIVE: 1,
    DWELL: 2,
    RECOVERY: 3,
} as const;
export type StrokeStateType = typeof StrokeState[keyof typeof StrokeState];

/** Erg Machine Type */
export const ErgMachineType = {
    STATIC_D: 0,    // Static Model D
    STATIC_C: 1,    // Static Model C
    STATIC_A: 2,    // Static Model A
    STATIC_B: 3,    // Static Model B
    STATIC_E: 5,    // Static Model E
    DYNAMIC: 16,    // Dynamic
    SLIDES: 32,     // Slides
    SKI_ERG: 64,    // SkiErg
    BIKE_ERG: 128,  // BikeErg
    MULTI_ERG: 192, // MultiErg (Row + Ski/Bike)
} as const;
export type ErgMachineTypeType = typeof ErgMachineType[keyof typeof ErgMachineType];

// ============================================================================
// DATA INTERFACES
// ============================================================================

/** Raw data from General Status characteristic (0x0031) */
export interface GeneralStatusData {
    elapsedTime: number;      // 0.01 sec resolution
    distance: number;         // 0.1 m resolution
    workoutType: number;
    intervalType: number;
    workoutState: number;
    rowingState: number;
    strokeState: number;
    totalWorkDistance: number; // meters
}

/** Raw data from Additional Status 1 characteristic (0x0032) */
export interface AdditionalStatus1Data {
    elapsedTime: number;      // 0.01 sec resolution
    speed: number;            // 0.001 m/s resolution
    strokeRate: number;       // strokes/min
    heartRate: number;        // bpm (255 = invalid)
    currentPace: number;      // 0.01 sec resolution (per 500m)
    averagePace: number;      // 0.01 sec resolution (per 500m)
    restDistance: number;     // meters
    restTime: number;         // 0.01 sec resolution
    ergMachineType: number;
}

/** Raw data from Additional Status 2 characteristic (0x0033) */
export interface AdditionalStatus2Data {
    elapsedTime: number;        // 0.01 sec resolution
    intervalCount: number;
    averagePower: number;       // watts
    totalCalories: number;      // calories
    splitAvgPace: number;       // 0.01 sec resolution (per 500m)
    splitAvgPower: number;      // watts
    splitAvgCalories: number;   // cals/hr
    lastSplitTime: number;      // 0.1 sec resolution
    lastSplitDistance: number;  // meters
}

/** Aggregated PM5 data for application use */
export interface PM5AggregatedData {
    // Timestamp when data was last updated
    timestamp: number;

    // General status
    elapsedTime: number;          // seconds
    distance: number;             // meters
    workoutType: number;
    intervalType: number;
    workoutState: number;
    rowingState: number;
    strokeState: number;

    // Performance metrics
    pace: number;                 // seconds per 500m
    averagePace: number;          // seconds per 500m
    strokeRate: number;           // strokes per minute
    watts: number;                // instantaneous power
    averageWatts: number;         // average power for workout
    heartRate: number;            // bpm (0 if no HR belt)
    calories: number;             // total calories

    // Split/interval data
    intervalCount: number;
    splitAvgPace: number;         // seconds per 500m
    splitAvgPower: number;        // watts

    // Machine type
    ergMachineType: number;
}

// ============================================================================
// DATA PARSING UTILITIES
// ============================================================================

/** Helper to get little-endian uint16 from DataView */
export function getUint16LE(view: DataView, offset: number): number {
    return view.getUint8(offset) | (view.getUint8(offset + 1) << 8);
}

/** Helper to get little-endian uint24 from DataView */
export function getUint24LE(view: DataView, offset: number): number {
    return view.getUint8(offset) |
        (view.getUint8(offset + 1) << 8) |
        (view.getUint8(offset + 2) << 16);
}

/** Helper to get little-endian uint32 from DataView */
export function getUint32LE(view: DataView, offset: number): number {
    return view.getUint8(offset) |
        (view.getUint8(offset + 1) << 8) |
        (view.getUint8(offset + 2) << 16) |
        (view.getUint8(offset + 3) << 24);
}

// ============================================================================
// CSAFE COMMANDS
// ============================================================================

export const CSAFE_COMMANDS = {
    SET_HORIZONTAL_DISTANCE: 0x21,
    SET_TWORK_TIME: 0x20, // Set time duration
    SET_USER_CFG1: 0x1A, // Wrapper
    SET_PROGRAM: 0x24,
    GO_IN_USE: 0x85, // Short command
    RESET: 0x82,     // Short command
} as const;

export const CSAFE_FRAME = {
    START_FLAG: 0xF1,
    STOP_FLAG: 0xF2,
    STUFFING_FLAG: 0xF3,
} as const;
