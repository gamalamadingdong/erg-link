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

    // Remote Session (Supabase)
    joinCode: string | null;
    sessionId: string | null;
    participantId: string | null;
    isJoining: boolean;
    activeWorkout: { type: 'fixed_distance' | 'fixed_time'; value: number; split?: number } | null;
    raceState: number | null;

    // Participant
    participantName: string | null;

    // Actions
    setConnectionState: (state: ConnectionState) => void;
    setConnectedDevice: (device: PM5Device | null) => void;
    addDiscoveredDevice: (device: PM5Device) => void;
    clearDiscoveredDevices: () => void;
    updateCurrentData: (data: PM5Data) => void;
    startSession: () => void;
    endSession: () => PM5Data[];
    setParticipantName: (name: string | null) => void;
    setSessionInfo: (info: { sessionId: string; participantId: string; joinCode: string } | null) => void;
    setActiveWorkout: (workout: { type: 'fixed_distance' | 'fixed_time'; value: number; split?: number } | null) => void;
    setRaceState: (state: number | null) => void;
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

    // Remote Session
    joinCode: null,
    sessionId: null,
    participantId: null,
    isJoining: false,
    activeWorkout: null,
    raceState: null,

    participantName: null,

    // Actions
    setParticipantName: (name) => set({ participantName: name }),
    setActiveWorkout: (workout) => set({ activeWorkout: workout }),
    setRaceState: (state) => set({ raceState: state }),
    setSessionInfo: (info) => set(info ? { ...info } : { sessionId: null, participantId: null, joinCode: null, activeWorkout: null }),
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
