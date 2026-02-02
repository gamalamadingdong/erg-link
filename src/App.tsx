import { useState, useEffect } from 'react';
import './App.css';
import { useAppStore } from './store/appStore';
import { bluetoothService } from './services/bluetooth';
import { strokeBuffer } from './services/strokeBuffer';
import { NameEntryForm } from './components/NameEntryForm';
import { IOSDownloadPrompt } from './components/IOSDownloadPrompt';
import { shouldShowAppDownloadPrompt } from './utils/platformDetection';

function App() {
  const {
    connectionState,
    connectedDevice,
    currentData,
    participantName,
    sessionId,
    activeWorkout, // Added from store
    raceState,
    setConnectionState,
    setConnectedDevice,
    updateCurrentData,
    setParticipantName,
    setActiveWorkout, // Action to update store
    setRaceState,
  } = useAppStore();

  const [error, setError] = useState<string | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check platform on mount
    if (shouldShowAppDownloadPrompt()) {
      setShowIOSPrompt(true);
    }
  }, []);

  // Subscribe to session updates (Remote Workout Programming)
  useEffect(() => {
    // Only subscribe if we are in a session
    // We use getState() here to avoid dependency cycles, but sessionId is in deps array so it's fine.
    console.log('[App] Checking session subscription. ID:', sessionId);

    if (sessionId) {
      let unsubscribe: (() => void) | undefined;

      import('./services/sessionService').then(({ sessionService }) => {
        console.log('[App] Session Service imported. Fetching initial state...');

        // 1. Fetch initial state (in case we joined late or reloaded)
        sessionService.getCurrentSession(sessionId).then(session => {
          if (session?.active_workout) {
            console.log('[App] Found existing active workout:', session.active_workout);
            // Update UI
            setActiveWorkout(session.active_workout as any);
            // Program PM5
            bluetoothService.programWorkout(session.active_workout as any).catch(err => {
              console.error('[App] Failed to program initial workout:', err);
            });
          } else {
            console.log('[App] No active workout found initially.');
          }
        }).catch(err => console.error('[App] Failed to get current session:', err));

        // 2. Subscribe to real-time updates
        const sub = sessionService.subscribeToSession(sessionId, (session) => {
          console.log('[App] Received session update:', session);

          // Handle Active Workout Changes
          const newWorkout = session.active_workout;
          // We need to compare with current state to avoid loops, but we can't access state easily in closure without ref.
          // However, setActiveWorkout and programWorkout are safe to call repeatedly if data is same (programWorkout might be heavy though).
          // Ideally store should handle dedup. 
          // For now, let's just check if it exists.

          if (newWorkout) {
            // Access current state via useAppStore.getState()
            const currentWorkout = useAppStore.getState().activeWorkout;
            if (JSON.stringify(newWorkout) !== JSON.stringify(currentWorkout)) {
              console.log('[App] New workout detected:', newWorkout);
              setActiveWorkout(newWorkout as any);
              bluetoothService.programWorkout(newWorkout as any).catch(err => console.error(err));
            }

            // Check Race State logic
            // Only if start_type is 'synchronized'
            const workoutConfig = newWorkout as any;
            if (workoutConfig.start_type === 'synchronized') {
              // Check race_state from session
              const raceState = (session as any).race_state;
              if (raceState !== undefined) {
                console.log('[App] Syncing race state:', raceState);

                // Update Store
                setRaceState(raceState);

                // trigger PM5 command
                bluetoothService.setRaceState(raceState).catch(e => console.error('[App] Failed to set race state', e));

                // TERMINATE / FINISH (11) -> Upload Data
                if (raceState === 11) {
                  console.log('[App] Race Terminated. Uploading local buffer...');
                  const state = useAppStore.getState();
                  if (state.sessionId && state.participantId) {
                    strokeBuffer.export(state.sessionId).then(async (blob) => {
                      const strokes = JSON.parse(await blob.text());
                      if (strokes.length === 0) {
                        console.warn('[App] No strokes to upload.');
                        return;
                      }
                      import('./services/sessionService').then(({ sessionService }) => {
                        sessionService.uploadWorkoutLog(state.sessionId!, state.participantId!, strokes)
                          .then(() => {
                            console.log('[App] Upload successful!');
                            strokeBuffer.clearSession(state.sessionId!);
                            // Maybe show success toast?
                          })
                          .catch(err => console.error('[App] Upload failed:', err));
                      });
                    });
                  }
                }
              }
            }
          }
        });
        unsubscribe = sub.unsubscribe;

        // Detect session end to trigger upload? 
        // Or do we wait for explicit "Finish" signal?
        // Currently we don't have an explicit "Finish" race state handled here other than Terminate(11).

      }).catch(err => console.error('[App] Failed to load sessionService:', err));

      return () => {
        if (unsubscribe) unsubscribe();
        // On unmount (leaving session), try to upload buffered data logic would go here
        // But unmount might be refresh, so be careful.
        // Better handled by explicit "End Session" action or automatic race state "Terminate"
      };
    }
  }, [sessionId]); // Re-run if session ID changes

  // Retry programming when PM5 connects
  useEffect(() => {
    if (connectionState === 'connected' && activeWorkout) {
      console.log('[App] PM5 Connected. Retrying programming of active workout:', activeWorkout);
      bluetoothService.programWorkout(activeWorkout as any).catch(err => {
        console.error('[App] Retry programming failed:', err);
      });
    }
  }, [connectionState, activeWorkout]);


  const handleConnect = async () => {
    setError(null);

    try {
      // Initialize and check availability
      await bluetoothService.initialize();
      const available = await bluetoothService.isAvailable();
      if (!available) {
        setError('Bluetooth is not available. Please enable Bluetooth and try again.');
        return;
      }

      // Set up data callback
      let lastUpdate = 0;
      const THROTTLE_MS = 1000;

      bluetoothService.onData((data) => {
        updateCurrentData(data);

        // Buffer stroke locally (Hybrid Strategy)
        // We use the current sessionId if available, otherwise 'pending'
        const currentSessionId = useAppStore.getState().sessionId;
        strokeBuffer.append(data, currentSessionId || undefined).catch(e => console.error('Buffer failed', e));

        // Sync to Supabase if in session (throttled)
        const state = useAppStore.getState();
        if (state.participantId && state.connectionState === 'connected') {
          const now = Date.now();
          if (now - lastUpdate > THROTTLE_MS) {
            lastUpdate = now;
            import('./services/sessionService').then(({ sessionService }) => {
              sessionService.updateParticipantData(state.participantId!, data)
                .catch(err => console.error('Sync failed', err));
            });
          }
        }
      });

      // Track which device was selected via closure
      let pickedDeviceId: string | null = null;
      let pickedDeviceName: string = 'PM5';

      // Set up device callback - this fires when user picks from the browser dialog
      bluetoothService.onDeviceDiscovered((device) => {
        pickedDeviceId = device.id;
        pickedDeviceName = device.name;
      });

      setConnectionState('scanning');

      // Start scanning/device picker - this waits for user selection
      await bluetoothService.startScan();

      // After scan completes, we should have a picked device
      if (pickedDeviceId !== null) {
        setConnectionState('connecting');
        await bluetoothService.connect(pickedDeviceId);
        setConnectedDevice({ id: pickedDeviceId, name: pickedDeviceName });
        setConnectionState('connected');
      } else {
        // User cancelled the picker
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

  // Render Logic:
  // 1. iOS/Safari Restriction
  if (showIOSPrompt) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <IOSDownloadPrompt />
      </div>
    );
  }

  // 2. Name Entry (Onboarding)
  if (!participantName) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <NameEntryForm />
      </div>
    );
  }

  // 3. Main Dashboard (Connect + Data)
  return (
    <div className="min-h-screen bg-gray-900 text-white safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="bg-gray-800 p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-xl font-bold text-erg-400">Erg-Link</h1>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-300">
            {participantName}
          </span>
          <button
            onClick={() => setParticipantName(null)}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            (Change)
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-md mx-auto relative">

        {/* RACE STATE OVERLAY */}
        {raceState === 8 && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-purple-900/90 backdrop-blur-md rounded-lg p-8 animate-pulse">
            <div className="text-xl font-bold text-purple-200 mb-2 tracking-widest uppercase">Race Control</div>
            <div className="text-6xl font-black text-white mb-4">SET</div>
            <div className="text-lg text-purple-300">Sit Ready...</div>
          </div>
        )}

        {raceState === 9 && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-emerald-600/90 backdrop-blur-md rounded-lg p-8 animate-ping-once pointer-events-none" style={{ animationDuration: '2s', animationFillMode: 'forwards', opacity: 0 }}>
            {/* Uses CSS hack or just relies on momentary overlay. Better to have it fade out. */}
            {/* Let's just show it prominently for a second if we can, or usually '9' stays active during the race? 
                 Actually race_state 9 likely persists. We shouldn't block the view during the race.
                 We should show a banner.
             */}
          </div>
        )}

        {(raceState === 9) && (
          <div className="bg-emerald-600 rounded-lg p-4 mb-6 text-center shadow-lg border-2 border-emerald-400 animate-bounce-once">
            <div className="text-4xl font-black text-white">GO!</div>
          </div>
        )}

        {raceState === 10 && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/95 backdrop-blur-md rounded-lg p-8">
            <div className="text-6xl font-black text-red-100 mb-4">FALSE START</div>
            <div className="text-xl text-red-200">Stop Rowing!</div>
          </div>
        )}

        {/* Active Workout Banner */}
        {activeWorkout && (
          <div className="bg-emerald-900/50 border border-emerald-500/50 rounded-lg p-4 mb-6 text-center animate-fade-in">
            <div className="text-emerald-400 font-bold mb-1 uppercase tracking-wide text-xs">
              Auto-Programmed
            </div>
            <div className="text-white text-lg font-semibold">
              {activeWorkout.type === 'fixed_distance' ?
                `Distance: ${activeWorkout.value}m` :
                activeWorkout.type === 'fixed_time' ?
                  `Time: ${activeWorkout.value / 60}:00` :
                  'Custom Workout'}
            </div>
            <div className="text-emerald-400/60 text-xs mt-1">
              Ready to Row
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 shadow-lg">
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

          {error && (
            <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
          )}
        </div>

        {/* Live Data Display */}
        {connectionState === 'connected' && currentData && (
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
            <h2 className="text-lg font-semibold mb-4 text-center text-gray-300">Live Data</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Distance */}
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-erg-400">
                  {currentData.distance.toFixed(0)}
                </div>
                <div className="text-gray-400 text-sm">meters</div>
              </div>

              {/* Pace */}
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-erg-400">
                  {formatPace(currentData.pace)}
                </div>
                <div className="text-gray-400 text-sm">/500m</div>
              </div>

              {/* Stroke Rate */}
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-erg-400">
                  {currentData.strokeRate}
                </div>
                <div className="text-gray-400 text-sm">s/m</div>
              </div>

              {/* Watts */}
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-erg-400">
                  {currentData.watts}
                </div>
                <div className="text-gray-400 text-sm">watts</div>
              </div>

              {/* Time */}
              <div className="bg-gray-700/50 rounded-lg p-4 text-center col-span-2">
                <div className="text-4xl font-bold text-white font-mono">
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
            <div className="text-6xl mb-4 opacity-50">🚣</div>
            <p>Connect to a PM5 to see live data</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 p-3 text-center text-gray-600 text-xs safe-area-bottom border-t border-gray-700">
        <div>© 2024 Sam Gammon</div>
        <a href="/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 transition-colors">
          MIT Licensed
        </a>
      </footer>
    </div>
  );
}

export default App;
