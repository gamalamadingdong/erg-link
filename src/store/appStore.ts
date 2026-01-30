import { create } from 'zustand';
import type { PM5Device, PM5Data, ConnectionState } from '../services/bluetooth.types';

interface AppState {
    // Connection
    connectionState: ConnectionState;
    connectedDevice: PM5Device | null;
    discoveredDevices: PM5Device[];

    // Live data
    currentData: PM5Data | null;

    // Session
    sessionActive: boolean;
    sessionStartTime: number | null;
    sessionData: PM5Data[];

    // Actions
    setConnectionState: (state: ConnectionState) => void;
    setConnectedDevice: (device: PM5Device | null) => void;
    addDiscoveredDevice: (device: PM5Device) => void;
    clearDiscoveredDevices: () => void;
    updateCurrentData: (data: PM5Data) => void;
    startSession: () => void;
    endSession: () => PM5Data[];
}

export const useAppStore = create<AppState>((set, get) => ({
    // Initial state
    connectionState: 'disconnected',
    connectedDevice: null,
    discoveredDevices: [],
    currentData: null,
    sessionActive: false,
    sessionStartTime: null,
    sessionData: [],

    // Actions
    setConnectionState: (connectionState) => set({ connectionState }),

    setConnectedDevice: (connectedDevice) => set({ connectedDevice }),

    addDiscoveredDevice: (device) => set((state) => {
        // Avoid duplicates
        if (state.discoveredDevices.some(d => d.id === device.id)) {
            return state;
        }
        return { discoveredDevices: [...state.discoveredDevices, device] };
    }),

    clearDiscoveredDevices: () => set({ discoveredDevices: [] }),

    updateCurrentData: (data) => set((state) => {
        if (state.sessionActive) {
            return {
                currentData: data,
                sessionData: [...state.sessionData, data],
            };
        }
        return { currentData: data };
    }),

    startSession: () => set({
        sessionActive: true,
        sessionStartTime: Date.now(),
        sessionData: [],
    }),

    endSession: () => {
        const data = get().sessionData;
        set({
            sessionActive: false,
            sessionStartTime: null,
            sessionData: [],
        });
        return data;
    },
}));
