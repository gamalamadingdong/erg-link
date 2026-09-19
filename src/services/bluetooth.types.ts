/**
 * Bluetooth Service Interface
 * 
 * Abstracts Bluetooth connectivity for PM5 monitors.
 * Implementation varies based on platform:
 * - Web: navigator.bluetooth (Chrome, Bluefy)
 * - Native: @capacitor-community/bluetooth-le (iOS, Android)
 */
import type { WorkoutConfig } from '../lib/pm5-protocol/commands';
import type { PM5StatusProbe } from '../lib/pm5-protocol/transport';
import type { PM5CompletedCaptureV1 } from '../lib/pm5-protocol/capture';
import type {
    StrokeData,
    SplitIntervalData,
    EndWorkoutSummaryData,
    AdditionalEndWorkoutSummaryData,
} from '../lib/pm5-protocol/types';

export interface PM5Device {
    id: string;
    name: string;
    rssi?: number;
}

export interface PM5Data {
    timestamp: number;
    distance: number;        // meters
    pace: number;            // seconds per 500m
    strokeRate: number;      // strokes per minute
    watts: number;
    heartRate?: number;
    calories?: number;
    elapsedTime: number;     // seconds
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
    controlCapabilities?: {
        rx: PM5GATTProperties;
        tx: PM5GATTProperties;
    };
    readErrors: string[];
}

export interface PM5GATTProperties {
    read: boolean;
    write: boolean;
    writeWithoutResponse: boolean;
    notify: boolean;
    indicate: boolean;
}

export interface PM5CaptureEvidence {
    strokeNotifications: number;
    splitNotifications: number;
    summaryNotifications: number;
    latestStroke?: StrokeData;
    latestSplit?: SplitIntervalData;
    latestSummary?: EndWorkoutSummaryData;
    latestAdditionalSummary?: AdditionalEndWorkoutSummaryData;
    capture?: PM5CompletedCaptureV1;
}

export interface BluetoothService {
    // Lifecycle
    initialize(): Promise<void>;
    isAvailable(): Promise<boolean>;

    // Scanning
    startScan(): Promise<void>;
    stopScan(): Promise<void>;
    onDeviceDiscovered(callback: (device: PM5Device) => void): void;

    // Connection
    connect(deviceId: string): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;

    // Data
    onData(callback: (data: PM5Data) => void): void;
    getConnectedDevice(): PM5Device | null;
    getDiagnostics(): Promise<PM5Diagnostic>;
    probeStatus(): Promise<PM5StatusProbe>;
    getCaptureEvidence(): PM5CaptureEvidence;

    // Commands
    programWorkout(workout: WorkoutConfig): Promise<void>;
    setRaceState(state: number): Promise<void>;
}

// Connection states
export type ConnectionState =
    | 'disconnected'
    | 'scanning'
    | 'connecting'
    | 'connected'
    | 'error';

export const RaceOperationType = {
    Disable: 0,
    WaitToStart: 8,
    Start: 9,
    FalseStart: 10,
    Terminate: 11,
} as const;

export type RaceOperationType = typeof RaceOperationType[keyof typeof RaceOperationType];
