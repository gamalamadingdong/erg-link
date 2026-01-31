/**
 * Native Bluetooth Implementation (Capacitor)
 * 
 * Uses @capacitor-community/bluetooth-le for iOS and Android.
 * This is the production implementation for the mobile app.
 */

import { BleClient, type BleDevice, type ScanResult } from '@capacitor-community/bluetooth-le';
import type { BluetoothService, PM5Device, PM5Data, ConnectionState } from './bluetooth.types';
import {
    PM5_SERVICES,
    PM5_CHARACTERISTICS,
    PM5DataAggregator,
} from '../lib/pm5-protocol';

export class NativeBluetoothService implements BluetoothService {
    private connectedDevice: BleDevice | null = null;
    private connectedDeviceName: string = 'PM5';
    private deviceCallback: ((device: PM5Device) => void) | null = null;
    private dataCallback: ((data: PM5Data) => void) | null = null;
    private connectionState: ConnectionState = 'disconnected';
    private isScanning = false;

    /** PM5 data aggregator - combines data from multiple characteristics */
    private dataAggregator = new PM5DataAggregator();

    /** Characteristics we're subscribed to */
    private subscribedCharacteristics: string[] = [];

    async initialize(): Promise<void> {
        try {
            await BleClient.initialize({ androidNeverForLocation: true });
            console.log('[NativeBluetooth] Initialized');
        } catch (error) {
            console.error('[NativeBluetooth] Initialization failed:', error);
            throw error;
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const enabled = await BleClient.isEnabled();
            if (!enabled) {
                // Try to enable Bluetooth (will prompt user on Android)
                await BleClient.requestEnable();
                return await BleClient.isEnabled();
            }
            return true;
        } catch (error) {
            console.error('[NativeBluetooth] Availability check failed:', error);
            return false;
        }
    }

    async startScan(): Promise<void> {
        if (this.isScanning) {
            console.warn('[NativeBluetooth] Already scanning');
            return;
        }

        this.connectionState = 'scanning';
        this.isScanning = true;
        console.log('[NativeBluetooth] Starting scan...');

        try {
            await BleClient.requestLEScan(
                {
                    services: [PM5_SERVICES.PM5],
                    namePrefix: 'PM5',
                },
                (result: ScanResult) => {
                    console.log('[NativeBluetooth] Found device:', result.device.name);

                    if (this.deviceCallback) {
                        this.deviceCallback({
                            id: result.device.deviceId,
                            name: result.device.name || 'PM5',
                            rssi: result.rssi,
                        });
                    }
                }
            );
        } catch (error) {
            console.error('[NativeBluetooth] Scan failed:', error);
            this.isScanning = false;
            this.connectionState = 'error';
            throw error;
        }
    }

    async stopScan(): Promise<void> {
        if (!this.isScanning) return;

        try {
            await BleClient.stopLEScan();
            this.isScanning = false;
            this.connectionState = 'disconnected';
            console.log('[NativeBluetooth] Scan stopped');
        } catch (error) {
            console.error('[NativeBluetooth] Stop scan failed:', error);
        }
    }

    onDeviceDiscovered(callback: (device: PM5Device) => void): void {
        this.deviceCallback = callback;
    }

    async connect(deviceId: string): Promise<void> {
        this.connectionState = 'connecting';
        console.log('[NativeBluetooth] Connecting to:', deviceId);

        try {
            // Stop scanning before connecting
            await this.stopScan();

            // Reset data aggregator for new session
            this.dataAggregator.reset();

            // Connect to the device
            await BleClient.connect(deviceId, (disconnectedDeviceId) => {
                console.log('[NativeBluetooth] Device disconnected:', disconnectedDeviceId);
                this.connectionState = 'disconnected';
                this.connectedDevice = null;
                this.subscribedCharacteristics = [];
            });

            // Store connected device
            this.connectedDevice = { deviceId };

            // Subscribe to multiple PM5 characteristics for comprehensive data
            await this.subscribeToCharacteristics(deviceId);

            this.connectionState = 'connected';
            console.log('[NativeBluetooth] Connected and subscribed to notifications');
        } catch (error) {
            console.error('[NativeBluetooth] Connection failed:', error);
            this.connectionState = 'error';
            this.connectedDevice = null;
            throw error;
        }
    }

    /**
     * Subscribe to all relevant PM5 characteristics
     */
    private async subscribeToCharacteristics(deviceId: string): Promise<void> {
        const characteristicsToSubscribe = [
            PM5_CHARACTERISTICS.ROWING_GENERAL_STATUS,      // 0x31 - time, distance, state
            PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS1,  // 0x32 - pace, watts, stroke rate
            PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS2,  // 0x33 - calories, strokes, HR
        ];

        for (const charUUID of characteristicsToSubscribe) {
            try {
                await BleClient.startNotifications(
                    deviceId,
                    PM5_SERVICES.PM5,
                    charUUID,
                    (value) => this.handleCharacteristicData(charUUID, value)
                );
                this.subscribedCharacteristics.push(charUUID);
                console.log('[NativeBluetooth] Subscribed to:', charUUID);
            } catch (error) {
                console.warn('[NativeBluetooth] Failed to subscribe to', charUUID, error);
                // Continue with other characteristics even if one fails
            }
        }
    }

    /**
     * Handle incoming data from any PM5 characteristic
     */
    private handleCharacteristicData(charUUID: string, value: DataView): void {
        try {
            // Feed data to the aggregator
            this.dataAggregator.update(charUUID, value);

            // Get combined data and notify callback
            if (this.dataCallback) {
                const pm5Data = this.dataAggregator.getData();

                // Convert to the simpler PM5Data interface for the UI
                this.dataCallback({
                    timestamp: pm5Data.timestamp,
                    elapsedTime: pm5Data.elapsedTime,
                    distance: pm5Data.distance,
                    pace: pm5Data.pace,
                    strokeRate: pm5Data.strokeRate,
                    watts: pm5Data.watts,
                    heartRate: pm5Data.heartRate,
                    calories: pm5Data.calories,
                });
            }
        } catch (error) {
            console.error('[NativeBluetooth] Failed to parse data:', error);
        }
    }

    async disconnect(): Promise<void> {
        if (!this.connectedDevice) {
            console.warn('[NativeBluetooth] No device connected');
            return;
        }

        const deviceId = this.connectedDevice.deviceId;

        // Stop all notifications
        for (const charUUID of this.subscribedCharacteristics) {
            try {
                await BleClient.stopNotifications(deviceId, PM5_SERVICES.PM5, charUUID);
            } catch (error) {
                console.warn('[NativeBluetooth] Error stopping notifications for', charUUID);
            }
        }
        this.subscribedCharacteristics = [];

        try {
            await BleClient.disconnect(deviceId);
            console.log('[NativeBluetooth] Disconnected');
        } catch (error) {
            console.error('[NativeBluetooth] Disconnect failed:', error);
        }

        this.connectedDevice = null;
        this.connectionState = 'disconnected';
        this.dataAggregator.reset();
    }

    isConnected(): boolean {
        return this.connectionState === 'connected' && !!this.connectedDevice;
    }

    onData(callback: (data: PM5Data) => void): void {
        this.dataCallback = callback;
    }

    getConnectedDevice(): PM5Device | null {
        if (!this.connectedDevice) return null;
        return {
            id: this.connectedDevice.deviceId,
            name: this.connectedDeviceName,
        };
    }

    async programWorkout(workout: { type: 'fixed_distance' | 'fixed_time', value: number, split?: number }): Promise<void> {
        console.log('[NativeBluetooth] Program workout not implemented yet:', workout);
    }

    async setRaceState(state: number): Promise<void> {
        console.log('[NativeBluetooth] Set race state not implemented yet:', state);
    }
}

// Singleton instance
export const nativeBluetoothService = new NativeBluetoothService();
