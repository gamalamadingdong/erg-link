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
    type AdditionalStrokeData,
    type SplitIntervalData,
    type AdditionalSplitIntervalData,
    type EndWorkoutSummaryData,
    type AdditionalEndWorkoutSummaryData,
    type EndWorkoutAdditionalSummary2Data,
    type AdditionalStatus3Data,
    type PM5AggregatedData,
} from './types.js';

// Export parsers
export {
    parseRowingGeneralStatus,
    parseRowingAdditionalStatus1,
    parseRowingAdditionalStatus2,
    parseRowingStrokeData,
    parseRowingAdditionalStrokeData,
    parseRowingSplitIntervalData,
    parseRowingAdditionalSplitIntervalData,
    parseRowingEndWorkoutSummary,
    parseRowingAdditionalEndWorkoutSummary,
    parseRowingEndWorkoutAdditionalSummary2,
    parseRowingAdditionalStatus3,
    PM5DataAggregator,
} from './parser.js';

export { buildCSAFEFrame, buildProprietaryFrame, buildWorkoutFrames, buildRaceStateFrame } from './commands.js';
export type { WorkoutConfig } from './commands.js';

export {
    buildExtendedCSAFEFrame,
    buildStandardCSAFEFrame,
    parseCSAFEFrame,
    stuffCSAFEBytes,
    unstuffCSAFEBytes,
} from './frame.js';
export type { ParsedCSAFEFrame } from './frame.js';

export { parseCSAFEResponse } from './response.js';
export type {
    CSAFECommandResponse,
    CSAFEResponse,
    CSAFEResponseStatus,
    PreviousFrameStatus,
    StateMachineState,
} from './response.js';

export { decodePM5String, decodePM5Uint16LE } from './diagnostic.js';
export {
    assertPM5AcceptedResponse,
    assertPM5ControlFrameLength,
    parsePM5StatusProbe,
    PM5_BLE_CONTROL_VALUE_LIMIT,
    selectPM5ResponseMode,
    selectPM5WriteMode,
} from './transport.js';
export type { PM5ResponseMode, PM5StatusProbe, PM5WriteMode } from './transport.js';

export { PM5CaptureAccumulator } from './capture.js';
export type {
    CaptureNotificationEvidence,
    CaptureStatus,
    CompletedCaptureSummary,
    NormalizedSplit,
    NormalizedSplitV2,
    NormalizedStroke,
    NormalizedStrokeV2,
    PM5CompletedCapture,
    PM5CompletedCaptureV1,
    PM5CompletedCaptureV2,
    RawCaptureNotification,
} from './capture.js';

export * from './csafe.js';
