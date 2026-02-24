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
    buildWorkoutFrames,
    buildRaceStateFrame,
    type PM5AggregatedData,
    type WorkoutConfig,
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

    async programWorkout(workout: WorkoutConfig): Promise<void> {
        if (!this.server || !this.connected) {
            console.warn('[WebBT] Cannot program workout: Not connected');
            return;
        }

        console.log('[WebBT] Programming workout:', workout);

        try {
            const controlService = await this.server.getPrimaryService(PM5_SERVICES.PM_CONTROL);
            const rxChar = await controlService.getCharacteristic(PM5_CHARACTERISTICS.CSAFE_RX);

            const frames = buildWorkoutFrames(workout);

            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                console.log(`[WebBT] Sending frame ${i + 1}/${frames.length}:`, frame);
                await rxChar.writeValue(frame);

                // Short delay between chunked frames to allow PM5 processing
                if (frames.length > 1 && i < frames.length - 1) {
                    await new Promise(r => setTimeout(r, 50));
                }
            }

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

        try {
            const controlService = await this.server.getPrimaryService(PM5_SERVICES.PM_CONTROL);
            const rxChar = await controlService.getCharacteristic(PM5_CHARACTERISTICS.CSAFE_RX);

            const frame = buildRaceStateFrame(state);
            console.log('[WebBT] Sending Race Control Frame:', frame);
            await rxChar.writeValue(frame);

            console.log('[WebBT] Race State Set Successfully');
        } catch (e) {
            console.error('[WebBT] Failed to set race state:', e);
            throw e;
        }
    }
}

// Export singleton instance
export const webBluetoothService = new WebBluetoothService();
