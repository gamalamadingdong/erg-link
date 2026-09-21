import type { ErgMonitorDevice, ErgMonitorDriver } from '../contracts.js';
import type {
    AdditionalEndWorkoutSummaryData,
    EndWorkoutSummaryData,
    PM5CompletedCapture,
    PM5StatusProbe,
    SplitIntervalData,
    StrokeData,
    WorkoutConfig,
} from './protocol/index.js';

export type PM5Device = ErgMonitorDevice;

export type PM5ConnectionState =
    | 'disconnected'
    | 'scanning'
    | 'connecting'
    | 'connected'
    | 'error';

export interface PM5Data {
    timestamp: number;
    distance: number;
    pace: number;
    strokeRate: number;
    watts: number;
    heartRate?: number;
    calories?: number;
    elapsedTime: number;
}

export interface PM5GATTProperties {
    read: boolean;
    write: boolean;
    writeWithoutResponse: boolean;
    notify: boolean;
    indicate: boolean;
}

export interface PM5Diagnostic {
    device: PM5Device;
    model?: string;
    serialNumber?: string;
    hardwareRevision?: string;
    firmwareRevision?: string;
    manufacturerName?: string;
    ergMachineType?: number;
    attMtu?: number;
    linkLayerMaxBytes?: number;
    negotiatedMtu?: number;
    controlValueLimit: number;
    controlCapabilities?: {
        rx: PM5GATTProperties;
        tx: PM5GATTProperties;
    };
    readErrors: string[];
}

export interface PM5CaptureEvidence {
    strokeNotifications: number;
    splitNotifications: number;
    summaryNotifications: number;
    latestStroke?: StrokeData;
    latestSplit?: SplitIntervalData;
    latestSummary?: EndWorkoutSummaryData;
    latestAdditionalSummary?: AdditionalEndWorkoutSummaryData;
    capture?: PM5CompletedCapture;
}

export interface PM5Driver extends ErgMonitorDriver<
    WorkoutConfig,
    PM5Data,
    PM5CaptureEvidence,
    PM5Diagnostic,
    PM5StatusProbe
> {
    setRaceState(state: number): Promise<void>;
}
