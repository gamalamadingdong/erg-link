/**
 * Web Bluetooth Service for PM5 Connection
 * 
 * Implements the BluetoothService interface using the Web Bluetooth API.
 * Uses correct PM5 UUIDs from CSAFE specification.
 */

import {
    PM5_SERVICES,
    PM5_CHARACTERISTICS,
    PM5_DEVICE_INFO_CHARACTERISTICS,
    PM5DataAggregator,
    PM5CaptureAccumulator,
    assertPM5AcceptedResponse,
    assertPM5ControlFrameLength,
    buildCSAFEFrame,
    buildWorkoutFrames,
    buildRaceStateFrame,
    decodePM5String,
    decodePM5Uint16LE,
    parsePM5StatusProbe,
    parseCSAFEResponse,
    parseRowingAdditionalEndWorkoutSummary,
    parseRowingEndWorkoutSummary,
    parseRowingSplitIntervalData,
    parseRowingStrokeData,
    selectPM5ResponseMode,
    selectPM5WriteMode,
    type PM5AggregatedData,
    type CaptureNotificationEvidence,
    type PM5StatusProbe,
    type WorkoutConfig,
} from '../lib/pm5-protocol';
import { CSAFE_GETSTATUS_CMD } from '../constants/csafe';
import { indexedDBCaptureStore } from './indexedDbCaptureStore';
import type { BluetoothService, PM5CaptureEvidence, PM5Data, PM5Device, PM5Diagnostic, PM5GATTProperties } from './bluetooth.types';

/**
 * All PM5-related service UUIDs for optionalServices
 * Web Bluetooth requires these to be listed before connection
 */
const ALL_PM5_SERVICES = [
    PM5_SERVICES.DEVICE_INFO,
    PM5_SERVICES.C2_DEVICE_INFO,
    PM5_SERVICES.PM_CONTROL,
    PM5_SERVICES.ROWING,
    PM5_SERVICES.HEART_RATE,
];

const toWriteBuffer = (frame: Uint8Array): ArrayBuffer => {
    const cloned = new Uint8Array(frame.byteLength);
    cloned.set(frame);
    return cloned.buffer;
};

class WebBluetoothService implements BluetoothService {
    private device: BluetoothDevice | null = null;
    private server: BluetoothRemoteGATTServer | null = null;
    private dataCallback: ((data: PM5Data) => void) | null = null;
    private deviceCallback: ((device: PM5Device) => void) | null = null;
    private connectionStateCallback: ((connected: boolean) => void) | null = null;
    private dataAggregator: PM5DataAggregator = new PM5DataAggregator();
    private characteristics: BluetoothRemoteGATTCharacteristic[] = [];
    private connected = false;
    private captureEvidence: PM5CaptureEvidence = {
        strokeNotifications: 0,
        splitNotifications: 0,
        summaryNotifications: 0,
    };
    private currentCapture: PM5CaptureAccumulator | null = null;
    private lastCSAFEFrameToggle: boolean | undefined;

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
            this.captureEvidence = { strokeNotifications: 0, splitNotifications: 0, summaryNotifications: 0 };
            this.currentCapture = null;

            // Get the Rowing Service (CE060030)
            const rowingService = await this.server.getPrimaryService(PM5_SERVICES.ROWING);
            console.log('[WebBT] Found Rowing Service');

            // Get and subscribe to rowing characteristics
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.ROWING_GENERAL_STATUS);
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS1);
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS2);
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.STROKE_DATA);
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.SPLIT_INTERVAL_DATA);
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.END_OF_WORKOUT_SUMMARY);
            await this.subscribeToCharacteristic(rowingService, PM5_CHARACTERISTICS.END_OF_WORKOUT_ADDITIONAL_SUMMARY);

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
        const notification: CaptureNotificationEvidence = {
            characteristic: uuid,
            receivedAt: new Date().toISOString(),
            bytes: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)),
        };
        if (uuid === PM5_CHARACTERISTICS.STROKE_DATA) {
            this.captureEvidence.strokeNotifications += 1;
            const stroke = parseRowingStrokeData(value);
            this.captureEvidence.latestStroke = stroke;
            const current = this.currentCapture?.snapshot();
            if (!this.currentCapture || current?.status !== 'recording') this.currentCapture = this.newCapture(stroke.elapsedTime);
            this.currentCapture.ingestStroke(stroke, notification);
        } else if (uuid === PM5_CHARACTERISTICS.SPLIT_INTERVAL_DATA) {
            this.captureEvidence.splitNotifications += 1;
            const split = parseRowingSplitIntervalData(value);
            this.captureEvidence.latestSplit = split;
            if (!this.currentCapture) this.currentCapture = this.newCapture(split.elapsedTime);
            this.currentCapture.ingestSplit(split, notification);
        } else if (uuid === PM5_CHARACTERISTICS.END_OF_WORKOUT_SUMMARY) {
            this.captureEvidence.summaryNotifications += 1;
            const summary = parseRowingEndWorkoutSummary(value);
            this.captureEvidence.latestSummary = summary;
            if (!this.currentCapture) this.currentCapture = this.newCapture(summary.elapsedTime);
            this.currentCapture.ingestEndSummary(summary, notification);
            this.persistTerminalCapture();
        } else if (uuid === PM5_CHARACTERISTICS.END_OF_WORKOUT_ADDITIONAL_SUMMARY) {
            this.captureEvidence.summaryNotifications += 1;
            const summary = parseRowingAdditionalEndWorkoutSummary(value);
            this.captureEvidence.latestAdditionalSummary = summary;
            if (!this.currentCapture) this.currentCapture = this.newCapture(0);
            this.currentCapture.ingestAdditionalEndSummary(summary, notification);
            this.persistTerminalCapture();
        }

        // Update the aggregator with new data
        this.dataAggregator.update(uuid, value);

        // Get aggregated data and convert to PM5Data format
        const pm5Data = this.dataAggregator.getData();

        if (this.dataCallback) {
            this.dataCallback(this.convertToPM5Data(pm5Data));
        }
    }

    private newCapture(elapsedCentiseconds: number): PM5CaptureAccumulator {
        const startedAt = new Date(Date.now() - elapsedCentiseconds * 10).toISOString();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        return new PM5CaptureAccumulator({ captureId: crypto.randomUUID(), startedAt, timezone });
    }

    private persistTerminalCapture(): void {
        const capture = this.currentCapture?.snapshot();
        if (!capture || capture.status === 'recording') return;
        void indexedDBCaptureStore.save(capture, new Date().toISOString()).catch((error) => {
            console.error('[WebBT] Failed to persist completed PM5 capture:', error);
        });
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
        if (this.currentCapture?.snapshot().status === 'recording') {
            this.currentCapture.finish('incomplete_capture', new Date().toISOString());
            this.persistTerminalCapture();
        }

        if (this.connectionStateCallback) {
            this.connectionStateCallback(false);
        }
    }

    async disconnect(): Promise<void> {
        // Stop all notifications
        for (const char of this.characteristics) {
            try {
                await char.stopNotifications();
            } catch {
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

    getCaptureEvidence(): PM5CaptureEvidence {
        return structuredClone({
            ...this.captureEvidence,
            capture: this.currentCapture?.snapshot(),
        });
    }

    async getDiagnostics(): Promise<PM5Diagnostic> {
        const device = this.getConnectedDevice();
        if (!device || !this.server || !this.connected) throw new Error('PM5 is not connected');

        const service = await this.server.getPrimaryService(PM5_SERVICES.C2_DEVICE_INFO);
        const readErrors: string[] = [];
        const read = async (label: string, characteristic: string): Promise<DataView | undefined> => {
            try {
                return await (await service.getCharacteristic(characteristic)).readValue();
            } catch {
                readErrors.push(label);
                return undefined;
            }
        };

        // Keep GATT reads sequential for compatibility with mobile web BLE stacks.
        const model = await read('model', PM5_DEVICE_INFO_CHARACTERISTICS.MODEL_NUMBER);
        const serial = await read('serialNumber', PM5_DEVICE_INFO_CHARACTERISTICS.SERIAL_NUMBER);
        const hardware = await read('hardwareRevision', PM5_DEVICE_INFO_CHARACTERISTICS.HARDWARE_REVISION);
        const firmware = await read('firmwareRevision', PM5_DEVICE_INFO_CHARACTERISTICS.FIRMWARE_REVISION);
        const manufacturer = await read('manufacturerName', PM5_DEVICE_INFO_CHARACTERISTICS.MANUFACTURER_NAME);
        const ergType = await read('ergMachineType', PM5_DEVICE_INFO_CHARACTERISTICS.ERG_MACHINE_TYPE);
        const attMtu = await read('attMtu', PM5_DEVICE_INFO_CHARACTERISTICS.ATT_MTU);
        const linkBytes = await read('linkLayerMaxBytes', PM5_DEVICE_INFO_CHARACTERISTICS.LL_MAX_BYTES);

        let controlCapabilities: PM5Diagnostic['controlCapabilities'];
        try {
            const control = await this.server.getPrimaryService(PM5_SERVICES.PM_CONTROL);
            const properties = async (characteristic: string): Promise<PM5GATTProperties> => {
                const found = await control.getCharacteristic(characteristic);
                return {
                    read: found.properties.read,
                    write: found.properties.write,
                    writeWithoutResponse: found.properties.writeWithoutResponse,
                    notify: found.properties.notify,
                    indicate: found.properties.indicate,
                };
            };
            controlCapabilities = {
                rx: await properties(PM5_CHARACTERISTICS.CSAFE_RX),
                tx: await properties(PM5_CHARACTERISTICS.CSAFE_TX),
            };
        } catch {
            readErrors.push('controlCapabilities');
        }

        return {
            device,
            model: model ? decodePM5String(model) : undefined,
            serialNumber: serial ? decodePM5String(serial) : undefined,
            hardwareRevision: hardware ? decodePM5String(hardware) : undefined,
            firmwareRevision: firmware ? decodePM5String(firmware) : undefined,
            manufacturerName: manufacturer ? decodePM5String(manufacturer) : undefined,
            ergMachineType: ergType?.byteLength ? ergType.getUint8(0) : undefined,
            attMtu: attMtu ? decodePM5Uint16LE(attMtu) : undefined,
            linkLayerMaxBytes: linkBytes ? decodePM5Uint16LE(linkBytes) : undefined,
            controlCapabilities,
            readErrors,
        };
    }

    async probeStatus(): Promise<PM5StatusProbe> {
        const frame = buildCSAFEFrame(CSAFE_GETSTATUS_CMD, []);
        return parsePM5StatusProbe(await this.exchangeCSAFEFrame(frame));
    }

    private async exchangeCSAFEFrame(frame: Uint8Array): Promise<number[]> {
        if (!this.server || !this.connected) throw new Error('PM5 is not connected');
        assertPM5ControlFrameLength(frame);

        const service = await this.server.getPrimaryService(PM5_SERVICES.PM_CONTROL);
        const rxChar = await service.getCharacteristic(PM5_CHARACTERISTICS.CSAFE_RX);
        const txChar = await service.getCharacteristic(PM5_CHARACTERISTICS.CSAFE_TX);
        const writeMode = selectPM5WriteMode(rxChar.properties);
        const responseMode = selectPM5ResponseMode(txChar.properties);
        const write = async () => {
            if (writeMode === 'with_response') await rxChar.writeValueWithResponse(toWriteBuffer(frame));
            else await rxChar.writeValueWithoutResponse(toWriteBuffer(frame));
        };
        const bytes = (value: DataView) => Array.from(new Uint8Array(
            value.buffer,
            value.byteOffset,
            value.byteLength,
        ));
        const freshBytes = (value: DataView): number[] | undefined => {
            const candidate = bytes(value);
            try {
                const toggle = parseCSAFEResponse(candidate).status.frameToggle;
                if (this.lastCSAFEFrameToggle === toggle) return undefined;
                this.lastCSAFEFrameToggle = toggle;
                return candidate;
            } catch {
                return undefined;
            }
        };

        if (responseMode === 'read') {
            await write();
            const response = freshBytes(await txChar.readValue());
            if (!response) throw new Error('PM5 returned a stale or malformed CSAFE response');
            return response;
        }

        let timeout: ReturnType<typeof setTimeout> | undefined;
        let handler: ((event: Event) => void) | undefined;
        const notification = new Promise<DataView>((resolve, reject) => {
            handler = (event: Event) => {
                const value = (event.target as BluetoothRemoteGATTCharacteristic | null)?.value;
                if (value && freshBytes(value)) resolve(value);
            };
            txChar.addEventListener('characteristicvaluechanged', handler);
            timeout = setTimeout(() => reject(new Error('Timed out waiting for PM5 CSAFE response notification')), 2000);
        });

        let notificationsStarted = false;
        try {
            await txChar.startNotifications();
            notificationsStarted = true;
            await write();
            return bytes(await notification);
        } finally {
            if (timeout !== undefined) clearTimeout(timeout);
            if (handler) txChar.removeEventListener('characteristicvaluechanged', handler);
            if (notificationsStarted) {
                try {
                    await txChar.stopNotifications();
                } catch {
                    // The response has already been captured; cleanup failure is non-fatal.
                }
            }
        }
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
            const frames = buildWorkoutFrames(workout);

            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                console.log(`[WebBT] Sending frame ${i + 1}/${frames.length}:`, frame);
                assertPM5AcceptedResponse(await this.exchangeCSAFEFrame(frame));

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
            const frame = buildRaceStateFrame(state);
            console.log('[WebBT] Sending Race Control Frame:', frame);
            assertPM5AcceptedResponse(await this.exchangeCSAFEFrame(frame));

            console.log('[WebBT] Race State Set Successfully');
        } catch (e) {
            console.error('[WebBT] Failed to set race state:', e);
            throw e;
        }
    }
}

// Export singleton instance
export const webBluetoothService = new WebBluetoothService();
