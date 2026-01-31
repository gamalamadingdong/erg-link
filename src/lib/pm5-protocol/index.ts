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
    type PM5AggregatedData,
    CSAFE_COMMANDS,
} from './types';

// Export parsers
export {
    parseRowingGeneralStatus,
    parseRowingAdditionalStatus1,
    parseRowingAdditionalStatus2,
    PM5DataAggregator,
} from './parser';

export { buildCSAFEFrame } from './commands';
