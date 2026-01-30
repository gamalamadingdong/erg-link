import { useState } from 'react';
import './App.css';
import { useAppStore } from './store/appStore';
import { webBluetoothService } from './services/bluetooth.web';

function App() {
  const {
    connectionState,
    connectedDevice,
    currentData,
    setConnectionState,
    setConnectedDevice,
    updateCurrentData,
  } = useAppStore();

  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);

    try {
      // Check availability
      const available = await webBluetoothService.isAvailable();
      if (!available) {
        setError('Bluetooth is not available. Please use Chrome or a Bluetooth-enabled browser.');
        return;
      }

      // Set up data callback
      webBluetoothService.onData((data) => {
        updateCurrentData(data);
      });

      // Set up device callback
      webBluetoothService.onDeviceDiscovered((device) => {
        setConnectedDevice(device);
      });

      setConnectionState('scanning');

      // This will open the browser's device picker
      await webBluetoothService.startScan();

      // If we got a device, connect to it
      const device = webBluetoothService.getConnectedDevice();
      if (device) {
        await webBluetoothService.connect(device.id);
        setConnectionState('connected');
      }
    } catch (err) {
      console.error('Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnectionState('disconnected');
    }
  };

  const handleDisconnect = async () => {
    await webBluetoothService.disconnect();
    setConnectionState('disconnected');
    setConnectedDevice(null);
  };

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

  return (
    <div className="min-h-screen bg-gray-900 text-white safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="bg-gray-800 p-4 text-center">
        <h1 className="text-2xl font-bold text-erg-400">Erg-Link</h1>
        <p className="text-gray-400 text-sm">PM5 Connectivity</p>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-md mx-auto">
        {/* Connection Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400">Status</span>
            <span className={`font-semibold ${connectionState === 'connected' ? 'text-green-400' :
                connectionState === 'scanning' || connectionState === 'connecting' ? 'text-yellow-400' :
                  'text-gray-400'
              }`}>
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

          {/* Connect/Disconnect Button */}
          {connectionState === 'connected' ? (
            <button
              onClick={handleDisconnect}
              className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connectionState === 'scanning' || connectionState === 'connecting'}
              className="w-full py-4 px-6 bg-erg-500 hover:bg-erg-600 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
            >
              {connectionState === 'scanning' || connectionState === 'connecting'
                ? 'Connecting...'
                : 'Connect to PM5'}
            </button>
          )}

          {error && (
            <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
          )}
        </div>

        {/* Live Data Display */}
        {connectionState === 'connected' && currentData && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-center">Live Data</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Distance */}
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-erg-400">
                  {currentData.distance.toFixed(0)}
                </div>
                <div className="text-gray-400 text-sm">meters</div>
              </div>

              {/* Pace */}
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-erg-400">
                  {formatPace(currentData.pace)}
                </div>
                <div className="text-gray-400 text-sm">/500m</div>
              </div>

              {/* Stroke Rate */}
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-erg-400">
                  {currentData.strokeRate}
                </div>
                <div className="text-gray-400 text-sm">s/m</div>
              </div>

              {/* Watts */}
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-erg-400">
                  {currentData.watts}
                </div>
                <div className="text-gray-400 text-sm">watts</div>
              </div>

              {/* Time */}
              <div className="bg-gray-700 rounded-lg p-4 text-center col-span-2">
                <div className="text-4xl font-bold text-white">
                  {formatTime(currentData.elapsedTime)}
                </div>
                <div className="text-gray-400 text-sm">elapsed time</div>
              </div>
            </div>
          </div>
        )}

        {/* Not Connected Placeholder */}
        {connectionState === 'disconnected' && (
          <div className="text-center text-gray-500 py-12">
            <div className="text-6xl mb-4">🚣</div>
            <p>Connect to a PM5 to see live data</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 p-3 text-center text-gray-500 text-xs safe-area-bottom">
        Erg-Link • LogbookCompanion
      </footer>
    </div>
  );
}

export default App;
