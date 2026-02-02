/**
 * Web Bluetooth Service for PM5 Connection
 * 
 * Implements the BluetoothService interface using the Web Bluetooth API.
 * Uses correct PM5 UUIDs from CSAFE specification.
 */

import {
    PM5_SERVICES,
    PM5_CHARACTERISTICS,
    PM5DataAggregator,
    type PM5AggregatedData,
} from '../lib/pm5-protocol';
import type { BluetoothService, PM5Data, PM5Device } from './bluetooth.types';

/**
 * All PM5-related service UUIDs for optionalServices
 * Web Bluetooth requires these to be listed before connection
 */
const ALL_PM5_SERVICES = [
    PM5_SERVICES.DEVICE_INFO,
    PM5_SERVICES.PM_CONTROL,
    PM5_SERVICES.ROWING,
    PM5_SERVICES.HEART_RATE,
];

class WebBluetoothService implements BluetoothService {
    private device: BluetoothDevice | null = null;
    private server: BluetoothRemoteGATTServer | null = null;
    private dataCallback: ((data: PM5Data) => void) | null = null;
    private deviceCallback: ((device: PM5Device) => void) | null = null;
    private connectionStateCallback: ((connected: boolean) => void) | null = null;
    private dataAggregator: PM5DataAggregator = new PM5DataAggregator();
    private characteristics: BluetoothRemoteGATTCharacteristic[] = [];
    private connected = false;

    async initialize(): Promise<void> {
        // Web Bluetooth doesn't require initialization
        console.log('[WebBT] Initialized');
    }

    async isAvailable(): Promise<boolean> {
        return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    }

    async startScan(): Promise<void> {
        try {
            // Request a PM5 device from the user
            // Use namePrefix filter with optionalServices to allow service discovery
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'PM5' }],
                optionalServices: ALL_PM5_SERVICES,
            });

            this.device = device;

            // Notify the callback that a device was discovered/selected
            if (this.deviceCallback) {
                this.deviceCallback({
                    id: device.id,
                    name: device.name ?? 'PM5',
                });
            }
        } catch (error) {
            if ((error as Error).name === 'NotFoundError') {
                console.log('[WebBT] User cancelled device selection');
                return;
            }
            throw error;
        }
    }

    async stopScan(): Promise<void> {
        // Web Bluetooth doesn't have a continuous scan to stop
    }

    async connect(deviceId: string): Promise<void> {
        if (!this.device || this.device.id !== deviceId) {
            throw new Error('Device not found or ID mismatch');
        }

        try {
            console.log('[WebBT] Connecting to GATT server...');
            this.server = await this.device.gatt?.connect() ?? null;

            if (!this.server) {
                throw new Error('Failed to connect to GATT server');
            }

            console.log('[WebBT] Connected! Discovering services...');

            // Get the Rowing Service (CE060030)
            const rowingService = await this.server.getPrimaryService(PM5_SERVICES.ROWING);
            console.log('[WebBT] Found Rowing Service');

            // Get and subscribe to rowing characteristics
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.ROWING_GENERAL_STATUS);
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS1);
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS2);

            // Set up disconnection handler
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('[WebBT] Device disconnected');
                this.handleDisconnect();
            });

            // Mark as connected
            this.connected = true;

            // Notify connection state
            if (this.connectionStateCallback) {
                this.connectionStateCallback(true);
            }

            console.log('[WebBT] Successfully subscribed to all characteristics');

        } catch (error) {
            console.error('[WebBT] Connection error:', error);
            this.handleDisconnect();
            throw error;
        }
    }

    private async subscribeToCharacteristic(
        service: BluetoothRemoteGATTService,
        uuid: string
    ): Promise<void> {
        try {
            const characteristic = await service.getCharacteristic(uuid);
            console.log(`[WebBT] Found characteristic: ${uuid}`);

            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                const target = event.target as BluetoothRemoteGATTCharacteristic;
                if (target.value) {
                    this.handleCharacteristicData(uuid, target.value);
                }
            });

            await characteristic.startNotifications();
            this.characteristics.push(characteristic);
            console.log(`[WebBT] Subscribed to: ${uuid}`);
        } catch (error) {
            console.warn(`[WebBT] Failed to subscribe to ${uuid}:`, error);
        }
    }

    private handleCharacteristicData(uuid: string, value: DataView): void {
        // Update the aggregator with new data
        this.dataAggregator.update(uuid, value);

        // Get aggregated data and convert to PM5Data format
        const pm5Data = this.dataAggregator.getData();

        if (this.dataCallback) {
            this.dataCallback(this.convertToPM5Data(pm5Data));
        }
    }

    private convertToPM5Data(aggData: PM5AggregatedData): PM5Data {
        return {
            timestamp: aggData.timestamp,
            elapsedTime: aggData.elapsedTime,
            distance: aggData.distance,
            pace: aggData.pace,
            strokeRate: aggData.strokeRate,
            watts: aggData.watts,
            heartRate: aggData.heartRate > 0 ? aggData.heartRate : undefined,
            calories: aggData.calories,
        };
    }

    private handleDisconnect(): void {
        this.characteristics = [];
        this.server = null;
        this.connected = false;
        this.dataAggregator.reset();

        if (this.connectionStateCallback) {
            this.connectionStateCallback(false);
        }
    }

    async disconnect(): Promise<void> {
        // Stop all notifications
        for (const char of this.characteristics) {
            try {
                await char.stopNotifications();
            } catch (e) {
                // Ignore errors during cleanup
            }
        }

        if (this.server?.connected) {
            this.server.disconnect();
        }

        this.handleDisconnect();
        this.device = null;
    }

    onDeviceDiscovered(callback: (device: PM5Device) => void): void {
        this.deviceCallback = callback;
    }

    onData(callback: (data: PM5Data) => void): void {
        this.dataCallback = callback;
    }

    onConnectionStateChange(callback: (connected: boolean) => void): void {
        this.connectionStateCallback = callback;
    }

    getConnectedDevice(): PM5Device | null {
        if (this.device && this.connected) {
            return {
                id: this.device.id,
                name: this.device.name ?? 'PM5',
            };
        }
        return null;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async programWorkout(workout: {
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
    }): Promise<void> {
        if (!this.server || !this.connected) {
            console.warn('[WebBT] Cannot program workout: Not connected');
            return;
        }

        console.log('[WebBT] Programming workout (Proprietary C2):', workout);

        // Import constants locally to avoid top-level dependency issues
        const C = await import('../constants/csafe');

        // Helper to send a frame
        const sendFrame = async (commandBytes: number[]) => {
            console.log('[WebBT] Sending Proprietary C2 Frame:', new Uint8Array(commandBytes));
            const controlService = await this.server!.getPrimaryService(PM5_SERVICES.PM_CONTROL);
            const rxChar = await controlService.getCharacteristic(PM5_CHARACTERISTICS.CSAFE_RX);
            await rxChar.writeValue(new Uint8Array(commandBytes));
        };

        // Helper to wrap payload in 0x76 frame
        const wrapAndSend = async (payload: number[]) => {
            const commandBytes: number[] = [];
            commandBytes.push(C.CSAFE_FRAME_START);
            commandBytes.push(C.CSAFE_SETPMCFG_CMD);
            commandBytes.push(payload.length);
            payload.forEach(b => commandBytes.push(b));
            let checksum = 0;
            for (let i = 1; i < commandBytes.length; i++) {
                checksum = checksum ^ commandBytes[i];
            }
            commandBytes.push(checksum);
            commandBytes.push(C.CSAFE_FRAME_STOP);
            await sendFrame(commandBytes);
        };

        const pushPayload8 = (arr: number[], val: number) => arr.push(val & 0xFF);
        const pushPayload32 = (arr: number[], val: number) => {
            arr.push((val >> 24) & 0xFF);
            arr.push((val >> 16) & 0xFF);
            arr.push((val >> 8) & 0xFF);
            arr.push(val & 0xFF);
        };

        try {
            // --- VARIABLE INTERVAL LOGIC (CHUNKING) ---
            if (workout.type === 'variable_interval' && workout.intervals) {
                console.log('[WebBT] Programming Variable Interval Workout (Chunked)...');

                for (let i = 0; i < workout.intervals.length; i++) {
                    const interval = workout.intervals[i];
                    const isLast = i === workout.intervals.length - 1;
                    const payload: number[] = [];

                    // 1. Set Workout Type (Variable Interval = 8)
                    pushPayload8(payload, C.CSAFE_PM_SET_WORKOUTTYPE);
                    pushPayload8(payload, 0x01);
                    pushPayload8(payload, C.WorkoutType.VariableInterval);

                    // 2. Set Interval Type (0=Time, 1=Dist)
                    // Note: C2 spec implies this is how we distinguish types per interval in variable mode
                    // Although standard commands use SET_WORKOUTDURATION with specific units.
                    // For Variable Intervals, we essentially act like we are programming a *single* interval
                    // of that type, then the NEXT frame programs the NEXT one.

                    // Actually, per standard CSAFE for variable intervals, we just use Standard SetDuration.

                    // Command: CSAFE_PM_SET_WORKOUTDURATION (0x03)
                    pushPayload8(payload, C.CSAFE_PM_SET_WORKOUTDURATION);
                    pushPayload8(payload, 0x05); // 1 type + 4 val

                    if (interval.type === 'time') {
                        pushPayload8(payload, C.WorkoutDurationType.Time);
                        const val = Math.round(interval.value * 100); // centiseconds
                        pushPayload32(payload, val);
                    } else {
                        pushPayload8(payload, C.WorkoutDurationType.Distance);
                        const val = Math.round(interval.value); // meters
                        pushPayload32(payload, val);
                    }

                    // Command: CSAFE_PM_SET_SPLITDURATION (0x05) - Optional?
                    // Let's copy the duration as the split for now to be safe, or default 500m/5min
                    // Actually, for variable intervals, splits might be weird. Let's skip explicitly setting splits per interval
                    // unless we want sub-splits. For simplicity, let's assume no sub-splits for now.

                    // Command: CSAFE_PM_SET_RESTDURATION (0x04)
                    if (interval.rest !== undefined) {
                        pushPayload8(payload, C.CSAFE_PM_SET_RESTDURATION);
                        pushPayload8(payload, 0x02); // 2 bytes for time in seconds? Or Standard CSAFE is usually different.
                        // Wait, spec says SetRestDuration (0x04) takes 2 bytes (word) in Seconds? 
                        // Checked C2 Spec: 0x04 + 0x02 + [Word]. Value is in seconds.
                        const restSec = Math.round(interval.rest);
                        pushPayload8(payload, (restSec >> 8) & 0xFF);
                        pushPayload8(payload, restSec & 0xFF);
                    }

                    // FINAL CHUNK ONLY: Configure & Screen State
                    if (isLast) {
                        // CSAFE_PM_CONFIGURE_WORKOUT (0x14)
                        pushPayload8(payload, C.CSAFE_PM_CONFIGURE_WORKOUT);
                        pushPayload8(payload, 0x01);
                        pushPayload8(payload, 0x01);

                        // CSAFE_PM_SET_SCREENSTATE (0x13)
                        pushPayload8(payload, C.CSAFE_PM_SET_SCREENSTATE);
                        pushPayload8(payload, 0x02);
                        pushPayload8(payload, C.ScreenType.Workout);
                        pushPayload8(payload, C.ScreenValue.PrepareToRow);
                    }

                    // Send the Chunk
                    console.log(`[WebBT] Sending Interval Chunk ${i + 1}/${workout.intervals.length}`);
                    await wrapAndSend(payload);

                    // Short delay to ensure processing?
                    await new Promise(r => setTimeout(r, 50));
                }

                console.log('[WebBT] Variable Interval Workout Programmed Successfully');
                return;
            }

            // --- STANDARD/LEGACY LOGIC (Fixed Types) ---
            const payload: number[] = [];

            // --- Command 1: CSAFE_PM_SET_WORKOUTTYPE (0x01) ---
            pushPayload8(payload, C.CSAFE_PM_SET_WORKOUTTYPE);
            pushPayload8(payload, 0x01); // Byte count

            let workoutType = 0;
            if (workout.type === 'fixed_time') workoutType = C.WorkoutType.FixedTimeSplits; // 5
            else if (workout.type === 'fixed_distance') workoutType = C.WorkoutType.FixedDistSplits; // 3
            else if (workout.type === 'interval_distance') workoutType = C.WorkoutType.FixedDistInterval; // 7
            else if (workout.type === 'interval_time') workoutType = C.WorkoutType.FixedTimeInterval; // 6
            else workoutType = 1; // JustRowSplits

            pushPayload8(payload, workoutType);

            // --- Command 2: CSAFE_PM_SET_WORKOUTDURATION (0x03) ---
            pushPayload8(payload, C.CSAFE_PM_SET_WORKOUTDURATION);
            pushPayload8(payload, 0x05); // Byte count: 1 (type) + 4 (value)

            if (workout.type === 'fixed_time') {
                pushPayload8(payload, C.WorkoutDurationType.Time); // 0x00
                // Value is in 0.01 seconds for Time
                const timeCentiseconds = Math.round((workout.value || 0) * 100);
                pushPayload32(payload, timeCentiseconds);

            } else if (workout.type === 'fixed_distance' || workout.type === 'interval_distance') {
                pushPayload8(payload, C.WorkoutDurationType.Distance); // 0x80
                // Value is in meters
                pushPayload32(payload, Math.round(workout.value || 0));
            } else if (workout.type === 'interval_time') {
                pushPayload8(payload, C.WorkoutDurationType.Time); // 0x00
                const timeCentiseconds = Math.round((workout.value || 0) * 100);
                pushPayload32(payload, timeCentiseconds);
            }

            // --- Command 3: CSAFE_PM_SET_SPLITDURATION (0x05) --- 
            if (workout.type === 'fixed_time') {
                pushPayload8(payload, C.CSAFE_PM_SET_SPLITDURATION);
                pushPayload8(payload, 0x05); // Count
                pushPayload8(payload, C.WorkoutDurationType.Time);
                // Default 5 mins (300s) = 30000 cs if not provided
                const split = (workout.split || 300) * 100;
                pushPayload32(payload, split);
            } else if (workout.type === 'fixed_distance') {
                pushPayload8(payload, C.CSAFE_PM_SET_SPLITDURATION);
                pushPayload8(payload, 0x05); // Count
                pushPayload8(payload, C.WorkoutDurationType.Distance);
                // Default 500m
                const split = workout.split || 500;
                pushPayload32(payload, split);
            }

            // --- Command 4: CSAFE_PM_CONFIGURE_WORKOUT (0x14) ---
            pushPayload8(payload, C.CSAFE_PM_CONFIGURE_WORKOUT);
            pushPayload8(payload, 0x01);
            pushPayload8(payload, 0x01); // Enable Program Mode

            // --- Command 5: CSAFE_PM_SET_SCREENSTATE (0x13) ---
            pushPayload8(payload, C.CSAFE_PM_SET_SCREENSTATE);
            pushPayload8(payload, 0x02); // Byte count
            pushPayload8(payload, C.ScreenType.Workout); // 1
            pushPayload8(payload, C.ScreenValue.PrepareToRow); // 1

            await wrapAndSend(payload);
            console.log('[WebBT] PM5 Programmed Successfully');

        } catch (e) {
            console.error('[WebBT] Failed to program workout:', e);
            throw e;
        }
    }

    async setRaceState(state: number): Promise<void> {
        if (!this.server || !this.connected) {
            console.warn('[WebBT] Cannot set race state: Not connected');
            return;
        }

        console.log('[WebBT] Setting Race State:', state);
        const C = await import('../constants/csafe');

        let commandBytes: number[] = [];

        // ---------------------------------------------------------
        // Construct C2 Proprietary Command Frame (Standard Frame)
        // ---------------------------------------------------------

        const payload: number[] = [];

        // Command: CSAFE_PM_SET_RACEOPERATIONTYPE (0x3E)
        payload.push(C.CSAFE_PM_SET_RACEOPERATIONTYPE);
        payload.push(0x01); // Byte count
        payload.push(state);

        // Frame: [F1, 76, Count, ...payload..., Checksum, F2]
        commandBytes.push(C.CSAFE_FRAME_START);
        commandBytes.push(C.CSAFE_SETPMCFG_CMD);
        commandBytes.push(payload.length); // Count of the payload bytes

        // Add payload
        payload.forEach(b => commandBytes.push(b));

        // Calculate Checksum (XOR of everything between Start and Checksum)
        let checksum = 0;
        // Iterate from Index 1 (Command) to the last payload byte
        for (let i = 1; i < commandBytes.length; i++) {
            checksum = checksum ^ commandBytes[i];
        }
        commandBytes.push(checksum);
        commandBytes.push(C.CSAFE_FRAME_STOP);

        console.log('[WebBT] Sending Standard Frame (Race Control):', new Uint8Array(commandBytes));

        try {
            const controlService = await this.server.getPrimaryService(PM5_SERVICES.PM_CONTROL);
            const rxChar = await controlService.getCharacteristic(PM5_CHARACTERISTICS.CSAFE_RX);
            await rxChar.writeValue(new Uint8Array(commandBytes));
            console.log('[WebBT] Race State Set Successfully');
        } catch (e) {
            console.error('[WebBT] Failed to set race state:', e);
            throw e;
        }
    }
}

// Export singleton instance
export const webBluetoothService = new WebBluetoothService();
