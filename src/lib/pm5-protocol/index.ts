/**
 * PM5 Protocol Library
 * 
 * Provides types, constants, and parsers for communicating with
 * Concept2 PM5 performance monitors via Bluetooth.
 */

// Export all types and constants
export {
    PM5_SERVICES,
    PM5_CHARACTERISTICS,
    PM5_DEVICE_INFO_CHARACTERISTICS,
    OperationalState,
    WorkoutType,
    IntervalType,
    WorkoutState,
    RowingState,
    StrokeState,
    ErgMachineType,
    getUint16LE,
    getUint24LE,
    getUint32LE,
    type OperationalStateType,
    type WorkoutTypeType,
    type IntervalTypeType,
    type WorkoutStateType,
    type RowingStateType,
    type StrokeStateType,
    type ErgMachineTypeType,
    type GeneralStatusData,
    type AdditionalStatus1Data,
    type AdditionalStatus2Data,
    type StrokeData,
    type SplitIntervalData,
    type EndWorkoutSummaryData,
    type AdditionalEndWorkoutSummaryData,
    type PM5AggregatedData,
} from './types';

// Export parsers
export {
    parseRowingGeneralStatus,
    parseRowingAdditionalStatus1,
    parseRowingAdditionalStatus2,
    parseRowingStrokeData,
    parseRowingSplitIntervalData,
    parseRowingEndWorkoutSummary,
    parseRowingAdditionalEndWorkoutSummary,
    PM5DataAggregator,
} from './parser';

export { buildCSAFEFrame, buildProprietaryFrame, buildWorkoutFrames, buildRaceStateFrame } from './commands';
export type { WorkoutConfig } from './commands';

export {
    buildExtendedCSAFEFrame,
    buildStandardCSAFEFrame,
    parseCSAFEFrame,
    stuffCSAFEBytes,
    unstuffCSAFEBytes,
} from './frame';
export type { ParsedCSAFEFrame } from './frame';

export { parseCSAFEResponse } from './response';
export type {
    CSAFECommandResponse,
    CSAFEResponse,
    CSAFEResponseStatus,
    PreviousFrameStatus,
    StateMachineState,
} from './response';

export { decodePM5String, decodePM5Uint16LE } from './diagnostic';
export {
    assertPM5AcceptedResponse,
    assertPM5ControlFrameLength,
    parsePM5StatusProbe,
    PM5_BLE_CONTROL_VALUE_LIMIT,
    selectPM5ResponseMode,
    selectPM5WriteMode,
} from './transport';
export type { PM5ResponseMode, PM5StatusProbe, PM5WriteMode } from './transport';

export { PM5CaptureAccumulator } from './capture';
export type {
    CaptureNotificationEvidence,
    CaptureStatus,
    CompletedCaptureSummary,
    NormalizedSplit,
    NormalizedStroke,
    PM5CompletedCaptureV1,
    RawCaptureNotification,
} from './capture';
