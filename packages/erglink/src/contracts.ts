export interface ErgMonitorDevice {
    id: string;
    name: string;
    rssi?: number;
}

export interface ErgMonitorDriver<
    TWorkout,
    TLiveData,
    TCaptureEvidence,
    TDiagnostic,
    TStatusProbe,
> {
    initialize(): Promise<void>;
    isAvailable(): Promise<boolean>;
    startScan(): Promise<void>;
    stopScan(): Promise<void>;
    onDeviceDiscovered(callback: (device: ErgMonitorDevice) => void): void;
    connect(deviceId: string): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    onData(callback: (data: TLiveData) => void): void;
    getConnectedDevice(): ErgMonitorDevice | null;
    getDiagnostics(): Promise<TDiagnostic>;
    probeStatus(): Promise<TStatusProbe>;
    getCaptureEvidence(): TCaptureEvidence;
    programWorkout(workout: TWorkout): Promise<void>;
}
