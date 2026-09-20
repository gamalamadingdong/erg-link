/**
 * Native Bluetooth Implementation (Capacitor)
 * 
 * Uses @capacitor-community/bluetooth-le for iOS and Android.
 * This is the production implementation for the mobile app.
 */

import { BleClient, type BleDevice, type ScanResult } from '@capacitor-community/bluetooth-le';
import type { BluetoothService, PM5CaptureEvidence, PM5Device, PM5Data, PM5Diagnostic, PM5GATTProperties, ConnectionState } from './bluetooth.types';
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
    type CaptureNotificationEvidence,
    type PM5StatusProbe,
    type WorkoutConfig,
} from '../lib/pm5-protocol';
import { CSAFE_GETSTATUS_CMD } from '../constants/csafe';
import { mobileSQLiteCaptureStore } from './mobileSQLiteCaptureStore';

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
    private captureEvidence: PM5CaptureEvidence = {
        strokeNotifications: 0,
        splitNotifications: 0,
        summaryNotifications: 0,
    };
    private currentCapture: PM5CaptureAccumulator | null = null;
    private lastCSAFEFrameToggle: boolean | undefined;
    private csafeQueue: Promise<void> = Promise.resolve();

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
            this.captureEvidence = { strokeNotifications: 0, splitNotifications: 0, summaryNotifications: 0 };
            this.currentCapture = null;
            this.lastCSAFEFrameToggle = undefined;

            // Connect to the device
            await BleClient.connect(deviceId, (disconnectedDeviceId) => {
                console.log('[NativeBluetooth] Device disconnected:', disconnectedDeviceId);
                void this.finalizeDisconnectedCapture();
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
            PM5_CHARACTERISTICS.STROKE_DATA,
            PM5_CHARACTERISTICS.SPLIT_INTERVAL_DATA,
            PM5_CHARACTERISTICS.END_OF_WORKOUT_SUMMARY,
            PM5_CHARACTERISTICS.END_OF_WORKOUT_ADDITIONAL_SUMMARY,
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
            const notification: CaptureNotificationEvidence = {
                characteristic: charUUID,
                receivedAt: new Date().toISOString(),
                bytes: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)),
            };
            if (charUUID === PM5_CHARACTERISTICS.STROKE_DATA) {
                this.captureEvidence.strokeNotifications += 1;
                const stroke = parseRowingStrokeData(value);
                this.captureEvidence.latestStroke = stroke;
                const current = this.currentCapture?.snapshot();
                if (!this.currentCapture || current?.status !== 'recording') this.currentCapture = this.newCapture(stroke.elapsedTime);
                this.currentCapture.ingestStroke(stroke, notification);
            } else if (charUUID === PM5_CHARACTERISTICS.SPLIT_INTERVAL_DATA) {
                this.captureEvidence.splitNotifications += 1;
                const split = parseRowingSplitIntervalData(value);
                this.captureEvidence.latestSplit = split;
                if (!this.currentCapture) this.currentCapture = this.newCapture(split.elapsedTime);
                this.currentCapture.ingestSplit(split, notification);
            } else if (charUUID === PM5_CHARACTERISTICS.END_OF_WORKOUT_SUMMARY) {
                this.captureEvidence.summaryNotifications += 1;
                const summary = parseRowingEndWorkoutSummary(value);
                this.captureEvidence.latestSummary = summary;
                if (!this.currentCapture) this.currentCapture = this.newCapture(summary.elapsedTime);
                this.currentCapture.ingestEndSummary(summary, notification);
                void this.persistTerminalCapture();
            } else if (charUUID === PM5_CHARACTERISTICS.END_OF_WORKOUT_ADDITIONAL_SUMMARY) {
                this.captureEvidence.summaryNotifications += 1;
                const summary = parseRowingAdditionalEndWorkoutSummary(value);
                this.captureEvidence.latestAdditionalSummary = summary;
                if (!this.currentCapture) this.currentCapture = this.newCapture(0);
                this.currentCapture.ingestAdditionalEndSummary(summary, notification);
                void this.persistTerminalCapture();
            }

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

    private newCapture(elapsedCentiseconds: number): PM5CaptureAccumulator {
        const startedAt = new Date(Date.now() - elapsedCentiseconds * 10).toISOString();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        return new PM5CaptureAccumulator({ captureId: crypto.randomUUID(), startedAt, timezone });
    }

    private async persistTerminalCapture(): Promise<void> {
        const capture = this.currentCapture?.snapshot();
        if (!capture || capture.status === 'recording') return;
        try {
            await mobileSQLiteCaptureStore.save(capture, new Date().toISOString());
        } catch (error) {
            console.error('[NativeBluetooth] Failed to persist PM5 capture:', error);
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
            } catch {
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

        await this.finalizeDisconnectedCapture();
    }

    private async finalizeDisconnectedCapture(): Promise<void> {
        this.connectedDevice = null;
        this.connectionState = 'disconnected';
        this.subscribedCharacteristics = [];
        this.lastCSAFEFrameToggle = undefined;
        this.dataAggregator.reset();
        if (this.currentCapture?.snapshot().status === 'recording') {
            this.currentCapture.finish('incomplete_capture', new Date().toISOString());
            await this.persistTerminalCapture();
        }
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

    getCaptureEvidence(): PM5CaptureEvidence {
        return structuredClone({
            ...this.captureEvidence,
            capture: this.currentCapture?.snapshot(),
        });
    }

    async getDiagnostics(): Promise<PM5Diagnostic> {
        const device = this.getConnectedDevice();
        if (!device || !this.connectedDevice) throw new Error('PM5 is not connected');

        const deviceId = this.connectedDevice.deviceId;
        const readErrors: string[] = [];
        const read = async (label: string, characteristic: string): Promise<DataView | undefined> => {
            try {
                return await BleClient.read(deviceId, PM5_SERVICES.C2_DEVICE_INFO, characteristic);
            } catch {
                readErrors.push(label);
                return undefined;
            }
        };

        // GATT operations are sequential on many mobile BLE stacks.
        const model = await read('model', PM5_DEVICE_INFO_CHARACTERISTICS.MODEL_NUMBER);
        const serial = await read('serialNumber', PM5_DEVICE_INFO_CHARACTERISTICS.SERIAL_NUMBER);
        const hardware = await read('hardwareRevision', PM5_DEVICE_INFO_CHARACTERISTICS.HARDWARE_REVISION);
        const firmware = await read('firmwareRevision', PM5_DEVICE_INFO_CHARACTERISTICS.FIRMWARE_REVISION);
        const manufacturer = await read('manufacturerName', PM5_DEVICE_INFO_CHARACTERISTICS.MANUFACTURER_NAME);
        const ergType = await read('ergMachineType', PM5_DEVICE_INFO_CHARACTERISTICS.ERG_MACHINE_TYPE);
        const attMtu = await read('attMtu', PM5_DEVICE_INFO_CHARACTERISTICS.ATT_MTU);
        const linkBytes = await read('linkLayerMaxBytes', PM5_DEVICE_INFO_CHARACTERISTICS.LL_MAX_BYTES);



        let negotiatedMtu: number | undefined;
        try {
            negotiatedMtu = await BleClient.getMtu(deviceId);
        } catch {
            readErrors.push('negotiatedMtu');
        }

        let controlCapabilities: PM5Diagnostic['controlCapabilities'];
        try {
            const services = await BleClient.getServices(deviceId);
            const control = services.find((service) => service.uuid.toLowerCase() === PM5_SERVICES.PM_CONTROL);
            const properties = (characteristic: string): PM5GATTProperties => {
                const found = control?.characteristics.find((candidate) => candidate.uuid.toLowerCase() === characteristic);
                if (!found) throw new Error(`Missing characteristic ${characteristic}`);
                return {
                    read: found.properties.read,
                    write: found.properties.write,
                    writeWithoutResponse: found.properties.writeWithoutResponse,
                    notify: found.properties.notify,
                    indicate: found.properties.indicate,
                };
            };
            controlCapabilities = {
                rx: properties(PM5_CHARACTERISTICS.CSAFE_RX),
                tx: properties(PM5_CHARACTERISTICS.CSAFE_TX),
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
            negotiatedMtu,
            controlValueLimit: 20,
            controlCapabilities,
            readErrors,
        };
    }

    async probeStatus(): Promise<PM5StatusProbe> {
        return this.enqueueCSAFE(async () => {
            const frame = buildCSAFEFrame(CSAFE_GETSTATUS_CMD, []);
            return parsePM5StatusProbe(await this.exchangeCSAFEFrame(frame));
        });
    }

    private enqueueCSAFE<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.csafeQueue.then(operation, operation);
        this.csafeQueue = result.then(() => undefined, () => undefined);
        return result;
    }

    private async exchangeCSAFEFrame(frame: Uint8Array): Promise<number[]> {
        if (!this.connectedDevice) throw new Error('PM5 is not connected');
        const deviceId = this.connectedDevice.deviceId;
        assertPM5ControlFrameLength(frame);

        const services = await BleClient.getServices(deviceId);
        const control = services.find((service) => service.uuid.toLowerCase() === PM5_SERVICES.PM_CONTROL);
        const characteristic = (uuid: string) => {
            const found = control?.characteristics.find((candidate) => candidate.uuid.toLowerCase() === uuid);
            if (!found) throw new Error(`Missing PM5 control characteristic ${uuid}`);
            return found;
        };
        const rx = characteristic(PM5_CHARACTERISTICS.CSAFE_RX);
        const tx = characteristic(PM5_CHARACTERISTICS.CSAFE_TX);
        const writeMode = selectPM5WriteMode(rx.properties);
        const responseMode = selectPM5ResponseMode(tx.properties);
        const dataView = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
        const write = () => writeMode === 'with_response'
            ? BleClient.write(deviceId, PM5_SERVICES.PM_CONTROL, PM5_CHARACTERISTICS.CSAFE_RX, dataView)
            : BleClient.writeWithoutResponse(deviceId, PM5_SERVICES.PM_CONTROL, PM5_CHARACTERISTICS.CSAFE_RX, dataView);
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
            const response = freshBytes(await BleClient.read(
                deviceId,
                PM5_SERVICES.PM_CONTROL,
                PM5_CHARACTERISTICS.CSAFE_TX,
            ));
            if (!response) throw new Error('PM5 returned a stale or malformed CSAFE response');
            return response;
        }

        let timeout: ReturnType<typeof setTimeout> | undefined;
        let resolveNotification: ((value: DataView) => void) | undefined;
        const notification = new Promise<DataView>((resolve, reject) => {
            resolveNotification = resolve;
            timeout = setTimeout(() => reject(new Error('Timed out waiting for PM5 CSAFE response notification')), 2000);
        });
        try {
            await BleClient.startNotifications(
                deviceId,
                PM5_SERVICES.PM_CONTROL,
                PM5_CHARACTERISTICS.CSAFE_TX,
                (value) => {
                    if (freshBytes(value)) resolveNotification?.(value);
                },
            );
        } catch (error) {
            if (timeout !== undefined) clearTimeout(timeout);
            throw error;
        }

        try {
            await write();
            return bytes(await notification);
        } finally {
            if (timeout !== undefined) clearTimeout(timeout);
            try {
                await BleClient.stopNotifications(
                    deviceId,
                    PM5_SERVICES.PM_CONTROL,
                    PM5_CHARACTERISTICS.CSAFE_TX,
                );
            } catch {
                // Response already captured; cleanup failure is non-fatal.
            }
        }
    }


    async programWorkout(workout: WorkoutConfig): Promise<void> {
        if (!this.connectedDevice) {
            throw new Error('PM5 is not connected');
        }

        return this.enqueueCSAFE(async () => {
          console.log('[NativeBluetooth] Programming workout:', workout);

          try {
            const frames = buildWorkoutFrames(workout);

            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                console.log(`[NativeBluetooth] Sending frame ${i + 1}/${frames.length}:`, frame);
                assertPM5AcceptedResponse(await this.exchangeCSAFEFrame(frame));

                // Short delay between chunked frames to allow PM5 processing
                if (frames.length > 1 && i < frames.length - 1) {
                    await new Promise(r => setTimeout(r, 50));
                }
            }

            console.log('[NativeBluetooth] Workout programmed successfully');
          } catch (e) {
              console.error('[NativeBluetooth] Failed to program workout:', e);
              throw e;
          }
        });
    }

    async setRaceState(state: number): Promise<void> {
        if (!this.connectedDevice) {
            throw new Error('PM5 is not connected');
        }

        return this.enqueueCSAFE(async () => {
          console.log('[NativeBluetooth] Setting race state:', state);

          try {
            const frame = buildRaceStateFrame(state);
            assertPM5AcceptedResponse(await this.exchangeCSAFEFrame(frame));

            console.log('[NativeBluetooth] Race state set successfully');
          } catch (e) {
              console.error('[NativeBluetooth] Failed to set race state:', e);
              throw e;
          }
        });
    }
}

// Singleton instance
export const nativeBluetoothService = new NativeBluetoothService();
