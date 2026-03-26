import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { bluetoothService } from '../services/bluetooth';
import { strokeBuffer } from '../services/strokeBuffer';

import { RaceOverlay } from '../components/RaceOverlay';
import { LiveDataGrid } from '../components/LiveDataGrid';

export function DashboardScreen() {
  const {
    connectionState,
    connectedDevice,
    currentData,
    participantName,
    activeWorkout,
    raceState,
    setConnectionState,
    setConnectedDevice,
    updateCurrentData,
    setParticipantName,
  } = useAppStore();

  const [error, setError] = useState<string | null>(null);

  const formatPace = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConnect = async () => {
    setError(null);
    try {
      await bluetoothService.initialize();
      const available = await bluetoothService.isAvailable();
      if (!available) {
        setError('Bluetooth is not available. Please enable Bluetooth and try again.');
        return;
      }

      let lastUpdate = 0;
      const THROTTLE_MS = 1000;

      bluetoothService.onData((data) => {
        updateCurrentData(data);
        const currentSessionId = useAppStore.getState().sessionId;
        strokeBuffer.append(data, currentSessionId || undefined).catch(e => console.error('Buffer failed', e));

        const state = useAppStore.getState();
        if (state.participantId && state.connectionState === 'connected') {
          const now = Date.now();
          if (now - lastUpdate > THROTTLE_MS) {
            lastUpdate = now;
            import('../services/sessionService').then(({ sessionService }) => {
              sessionService.updateParticipantData(state.participantId!, data)
                .catch(err => console.error('Sync failed', err));
            });
          }
        }
      });

      let pickedDeviceId: string | null = null;
      let pickedDeviceName: string = 'PM5';

      bluetoothService.onDeviceDiscovered((device) => {
        pickedDeviceId = device.id;
        pickedDeviceName = device.name;
      });

      setConnectionState('scanning');
      await bluetoothService.startScan();

      if (pickedDeviceId !== null) {
        setConnectionState('connecting');
        await bluetoothService.connect(pickedDeviceId);
        setConnectedDevice({ id: pickedDeviceId, name: pickedDeviceName });
        setConnectionState('connected');
      } else {
        setConnectionState('disconnected');
      }
    } catch (err) {
      console.error('Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnectionState('disconnected');
    }
  };

  const handleDisconnect = async () => {
    await bluetoothService.disconnect();
    setConnectionState('disconnected');
    setConnectedDevice(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="bg-gray-800 p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold text-erg-400">Erg-Link</h1>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-300">{participantName}</span>
          <button
            onClick={() => setParticipantName(null)}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            (Change)
          </button>
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto relative">
        {/* Race State Overlays */}
        <RaceOverlay raceState={raceState} />

        {/* Active Workout Banner */}
        {activeWorkout && (
          <div className="bg-emerald-900/50 border border-emerald-500/50 rounded-lg p-4 mb-6 text-center animate-fade-in">
            <div className="text-emerald-400 font-bold mb-1 uppercase tracking-wide text-xs">
              Auto-Programmed
            </div>
            <div className="text-white text-lg font-semibold">
              {activeWorkout.type === 'fixed_distance'
                ? `Distance: ${activeWorkout.value ?? 0}m`
                : activeWorkout.type === 'fixed_time'
                  ? `Time: ${(activeWorkout.value ?? 0) / 60}:00`
                  : 'Custom Workout'}
            </div>
            <div className="text-emerald-400/60 text-xs mt-1">Ready to Row</div>
          </div>
        )}

        {/* Connection Panel */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400">Status</span>
            <span
              className={`font-semibold ${
                connectionState === 'connected'
                  ? 'text-green-400'
                  : connectionState === 'scanning' || connectionState === 'connecting'
                    ? 'text-yellow-400'
                    : 'text-gray-400'
              }`}
            >
              {connectionState === 'disconnected' && 'Not Connected'}
              {connectionState === 'scanning' && 'Scanning...'}
              {connectionState === 'connecting' && 'Connecting...'}
              {connectionState === 'connected' && 'Connected'}
              {connectionState === 'error' && 'Error'}
            </span>
          </div>

          {connectedDevice && (
            <div className="text-sm text-gray-400 mb-4">
              Connected to: <span className="text-white">{connectedDevice.name}</span>
            </div>
          )}

          {connectionState === 'connected' ? (
            <button
              onClick={handleDisconnect}
              className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors shadow-md"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connectionState === 'scanning' || connectionState === 'connecting'}
              className="w-full py-4 px-6 bg-erg-500 hover:bg-erg-600 disabled:bg-gray-600 rounded-lg font-semibold transition-colors shadow-md shadow-erg-500/10"
            >
              {connectionState === 'scanning' || connectionState === 'connecting'
                ? 'Connecting...'
                : 'Connect to PM5'}
            </button>
          )}

          {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
        </div>

        {/* Live Data */}
        {connectionState === 'connected' && currentData && (
          <LiveDataGrid
            data={currentData}
            formatPace={formatPace}
            formatTime={formatTime}
          />
        )}

        {/* Empty State */}
        {connectionState === 'disconnected' && (
          <div className="text-center text-gray-500 py-12">
            <div className="text-6xl mb-4 opacity-50">🚣</div>
            <p>Connect to a PM5 to see live data</p>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 p-3 text-center text-gray-600 text-xs safe-area-bottom border-t border-gray-700">
        <div>© 2026 Sam Gammon</div>
      </footer>
    </div>
  );
}
