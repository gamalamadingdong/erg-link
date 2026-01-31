// CSAFE Command Constants and Types extracted from PM5_CSAFE_SPEC.md

// Frame Flags
export const CSAFE_FRAME_START = 0xF1;
export const CSAFE_FRAME_STOP = 0xF2;
export const CSAFE_FRAME_STUFF = 0xF3;

// Public CSAFE Commands (Examples from spec)
export const CSAFE_SETTWORK_CMD = 0x20;
export const CSAFE_SETHORIZONTAL_CMD = 0x21;
export const CSAFE_SETPROGRAM_CMD = 0x24; // Used to launch a pre-configured or fully set up workout

// C2 Proprietary Specfic Constants
export const CSAFE_PM_SHORT_GETCFG_CMD = 0x80; // Base for short get cfg
export const CSAFE_PM_LONG_GETCFG_CMD = 0x50;  // Base for long get cfg
export const CSAFE_PM_SHORT_SETCFG_CMD = 0xE0; // Base for short set cfg
export const CSAFE_PM_LONG_SETCFG_CMD = 0x00;  // Base for long set cfg

// C2 Proprietary Wrappers
export const CSAFE_SETUSERCFG1_CMD = 0x1A; // Wrapper for 0x00-0x3F commands? No, see spec.
// Actually spec says 0x76 is "C2 proprietary wrapper"
export const CSAFE_SETPMCFG_CMD = 0x76; // C2 Proprietary Wrapper (Command 0x76)
export const CSAFE_SETPMDATA_CMD = 0x77; // C2 Proprietary Wrapper (Command 0x77)

// C2 Proprietary Commands (Must be wrapped in 0x76 or similar)
export const CSAFE_PM_SET_WORKOUTTYPE = 0x01;
export const CSAFE_PM_SET_WORKOUTDURATION = 0x03;
export const CSAFE_PM_SET_RESTDURATION = 0x04;
export const CSAFE_PM_SET_SPLITDURATION = 0x05;
export const CSAFE_PM_CONFIGURE_WORKOUT = 0x14;
export const CSAFE_PM_SET_SCREENSTATE = 0x13;
export const CSAFE_PM_SET_RACEOPERATIONTYPE = 0x3E;

// Extended Frame
export const CSAFE_EXTENDED_FRAME_START = 0xF0;
export const CSAFE_DEST_ADDR = 0xFD; // Default secondary address
export const CSAFE_SRC_ADDR = 0x00; // Host (PC/App)

// Enumerations
// Enumerations
export const WorkoutType = {
    JustRowNoSplits: 0,
    JustRowSplits: 1,
    FixedDistNoSplits: 2,
    FixedDistSplits: 3,
    FixedTimeNoSplits: 4,
    FixedTimeSplits: 5,
    FixedTimeInterval: 6,
    FixedDistInterval: 7,
    VariableInterval: 8,
    VariableUndefinedRestInterval: 9,
    FixedCalorieSplits: 10,
    FixedWattMinuteSplits: 11,
    FixedCalorieInterval: 12
} as const;
export type WorkoutType = typeof WorkoutType[keyof typeof WorkoutType];

export const IntervalType = {
    Time: 0,
    Distance: 1,
    Rest: 2
} as const;
export type IntervalType = typeof IntervalType[keyof typeof IntervalType];

export const ScreenType = {
    Workout: 1
} as const;
export type ScreenType = typeof ScreenType[keyof typeof ScreenType];

export const ScreenValue = {
    PrepareToRow: 1,
    WorkoutResults: 2
} as const;
export type ScreenValue = typeof ScreenValue[keyof typeof ScreenValue];

export const WorkoutDurationType = {
    Time: 0x00,
    Calories: 0x40,
    Distance: 0x80,
    WattMin: 0xC0
} as const;
export type WorkoutDurationType = typeof WorkoutDurationType[keyof typeof WorkoutDurationType];

// Unit Specifiers
export const CSAFE_UNITS_METER = 0x24;
export const CSAFE_UNITS_SECOND = 0x36;

// Helper to calculate checksum
export const calculateCSAFEChecksum = (bytes: number[]): number => {
    let checksum = 0;
    for (const byte of bytes) {
        checksum = checksum ^ byte;
    }
    return checksum;
};
