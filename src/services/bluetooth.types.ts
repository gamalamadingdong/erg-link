/**
 * Bluetooth Service Interface
 * 
 * Abstracts Bluetooth connectivity for PM5 monitors.
 * Implementation varies based on platform:
 * - Web: navigator.bluetooth (Chrome, Bluefy)
 * - Native: @capacitor-community/bluetooth-le (iOS, Android)
 */

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

    // Commands
    programWorkout(workout: {
        type: 'fixed_distance' | 'fixed_time' | 'interval_distance' | 'interval_time' | 'variable_interval',
        value?: number,
        split?: number,
        rest?: number,
        repeats?: number,
        intervals?: Array<{
            type: 'distance' | 'time' | 'rest';
            value: number;
            rest?: number;
        }>
    }): Promise<void>;
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
