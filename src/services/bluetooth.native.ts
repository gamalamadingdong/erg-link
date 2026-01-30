/**
 * Native Bluetooth Implementation (Capacitor)
 * 
 * Uses @capacitor-community/bluetooth-le for iOS and Android.
 * This is the production implementation for the mobile app.
 */

import { BleClient, type BleDevice, type ScanResult } from '@capacitor-community/bluetooth-le';
import type { BluetoothService, PM5Device, PM5Data, ConnectionState } from './bluetooth.types';
import { PM5_SERVICE_UUID, PM5_ROWING_STATUS_UUID } from './bluetooth.types';

export class NativeBluetoothService implements BluetoothService {
    private connectedDevice: BleDevice | null = null;
    private deviceCallback: ((device: PM5Device) => void) | null = null;
    private dataCallback: ((data: PM5Data) => void) | null = null;
    private connectionState: ConnectionState = 'disconnected';
    private isScanning = false;

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
                    services: [PM5_SERVICE_UUID],
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

            // Connect to the device
            await BleClient.connect(deviceId, (disconnectedDeviceId) => {
                console.log('[NativeBluetooth] Device disconnected:', disconnectedDeviceId);
                this.connectionState = 'disconnected';
                this.connectedDevice = null;
            });

            // Store connected device
            this.connectedDevice = { deviceId };

            // Subscribe to rowing status notifications
            await BleClient.startNotifications(
                deviceId,
                PM5_SERVICE_UUID,
                PM5_ROWING_STATUS_UUID,
                (value) => {
                    this.handleData(value);
                }
            );

            this.connectionState = 'connected';
            console.log('[NativeBluetooth] Connected and subscribed to notifications');
        } catch (error) {
            console.error('[NativeBluetooth] Connection failed:', error);
            this.connectionState = 'error';
            this.connectedDevice = null;
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (!this.connectedDevice) {
            console.warn('[NativeBluetooth] No device connected');
            return;
        }

        try {
            // Stop notifications first
            await BleClient.stopNotifications(
                this.connectedDevice.deviceId,
                PM5_SERVICE_UUID,
                PM5_ROWING_STATUS_UUID
            );
        } catch (error) {
            // Ignore errors during cleanup
            console.warn('[NativeBluetooth] Error stopping notifications:', error);
        }

        try {
            await BleClient.disconnect(this.connectedDevice.deviceId);
            console.log('[NativeBluetooth] Disconnected');
        } catch (error) {
            console.error('[NativeBluetooth] Disconnect failed:', error);
        }

        this.connectedDevice = null;
        this.connectionState = 'disconnected';
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
            name: 'PM5', // BleDevice doesn't store name after connection
        };
    }

    private handleData(value: DataView): void {
        if (!this.dataCallback) return;

        try {
            const data = this.parsePM5Data(value);
            this.dataCallback(data);
        } catch (error) {
            console.error('[NativeBluetooth] Failed to parse data:', error);
        }
    }

    private parsePM5Data(value: DataView): PM5Data {
        // PM5 rowing status characteristic format
        // This is a simplified parser - full implementation would handle
        // various message types based on the first byte
        // Reference: ErgometerJS for complete protocol

        const elapsedTime = value.getUint16(0, true) / 100; // centiseconds to seconds
        const distance = value.getUint16(2, true) / 10;     // decimeters to meters
        const pace = value.getUint16(4, true) / 100;        // centiseconds per 500m
        const strokeRate = value.getUint8(6);
        const watts = value.getUint16(7, true);

        return {
            timestamp: Date.now(),
            elapsedTime,
            distance,
            pace,
            strokeRate,
            watts,
        };
    }
}

// Singleton instance
export const nativeBluetoothService = new NativeBluetoothService();
