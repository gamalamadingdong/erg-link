export type { PM5Driver as BluetoothService } from '@readyall/erglink/pm5';
export type {
    PM5CaptureEvidence,
    PM5ConnectionState as ConnectionState,
    PM5Data,
    PM5Device,
    PM5Diagnostic,
    PM5GATTProperties,
} from '@readyall/erglink/pm5';

export const RaceOperationType = {
    Disable: 0,
    WaitToStart: 8,
    Start: 9,
    FalseStart: 10,
    Terminate: 11,
} as const;

export type RaceOperationType = typeof RaceOperationType[keyof typeof RaceOperationType];
