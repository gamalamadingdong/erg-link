/**
 * Web Bluetooth Implementation
 * 
 * Uses the Web Bluetooth API for Chrome and Bluefy browsers.
 * Note: Does NOT work on iOS Safari (requires native app).
 */

import type { BluetoothService, PM5Device, PM5Data, ConnectionState } from './bluetooth.types';
import { PM5_SERVICE_UUID, PM5_ROWING_STATUS_UUID } from './bluetooth.types';

export class WebBluetoothService implements BluetoothService {
    private device: BluetoothDevice | null = null;
    private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    private deviceCallback: ((device: PM5Device) => void) | null = null;
    private dataCallback: ((data: PM5Data) => void) | null = null;
    private connectionState: ConnectionState = 'disconnected';

    async initialize(): Promise<void> {
        // Web Bluetooth doesn't require initialization
        console.log('[WebBluetooth] Initialized');
    }

    async isAvailable(): Promise<boolean> {
        if (!navigator.bluetooth) {
            console.warn('[WebBluetooth] Not available in this browser');
            return false;
        }
        return navigator.bluetooth.getAvailability();
    }

    async startScan(): Promise<void> {
        this.connectionState = 'scanning';

        try {
            // Web Bluetooth uses a picker dialog instead of continuous scanning
            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [PM5_SERVICE_UUID] },
                    { namePrefix: 'PM5' },
                ],
                optionalServices: [PM5_SERVICE_UUID],
            });

            if (device && this.deviceCallback) {
                this.deviceCallback({
                    id: device.id,
                    name: device.name || 'PM5',
                });
            }

            this.device = device;
        } catch (error) {
            console.error('[WebBluetooth] Scan failed:', error);
            this.connectionState = 'disconnected';
            throw error;
        }
    }

    async stopScan(): Promise<void> {
        // Web Bluetooth picker auto-closes, nothing to do
        this.connectionState = 'disconnected';
    }

    onDeviceDiscovered(callback: (device: PM5Device) => void): void {
        this.deviceCallback = callback;
    }

    async connect(deviceId: string): Promise<void> {
        if (!this.device || this.device.id !== deviceId) {
            throw new Error('Device not found. Please scan first.');
        }

        this.connectionState = 'connecting';
        console.log('[WebBluetooth] Connecting to', this.device.name);

        try {
            const server = await this.device.gatt?.connect();
            if (!server) throw new Error('Failed to connect to GATT server');

            const service = await server.getPrimaryService(PM5_SERVICE_UUID);
            this.characteristic = await service.getCharacteristic(PM5_ROWING_STATUS_UUID);

            // Subscribe to notifications
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));

            this.connectionState = 'connected';
            console.log('[WebBluetooth] Connected to', this.device.name);
        } catch (error) {
            console.error('[WebBluetooth] Connection failed:', error);
            this.connectionState = 'error';
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.characteristic) {
            try {
                await this.characteristic.stopNotifications();
            } catch (e) {
                // Ignore errors during cleanup
            }
        }

        if (this.device?.gatt?.connected) {
            this.device.gatt.disconnect();
        }

        this.device = null;
        this.characteristic = null;
        this.connectionState = 'disconnected';
        console.log('[WebBluetooth] Disconnected');
    }

    isConnected(): boolean {
        return this.connectionState === 'connected' && !!this.device?.gatt?.connected;
    }

    onData(callback: (data: PM5Data) => void): void {
        this.dataCallback = callback;
    }

    getConnectedDevice(): PM5Device | null {
        if (!this.device || !this.isConnected()) return null;
        return {
            id: this.device.id,
            name: this.device.name || 'PM5',
        };
    }

    private handleData(event: Event): void {
        const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
        const value = characteristic.value;

        if (!value || !this.dataCallback) return;

        // Parse PM5 data packet
        // Format varies by characteristic, this is a simplified example
        try {
            const data = this.parsePM5Data(value);
            this.dataCallback(data);
        } catch (error) {
            console.error('[WebBluetooth] Failed to parse data:', error);
        }
    }

    private parsePM5Data(value: DataView): PM5Data {
        // PM5 rowing status characteristic format (simplified)
        // Real implementation would need to handle various message types
        // Reference: ErgometerJS for full protocol

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
export const webBluetoothService = new WebBluetoothService();
