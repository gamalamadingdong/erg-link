import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { useAppStore } from './store/appStore';
import { bluetoothService } from './services/bluetooth';
import { activeWorkoutSpecToWorkoutConfig } from './lib/pm5-protocol/commands';
import { toActiveWorkoutSpec } from './types/ergSession.types';
import { strokeBuffer } from './services/strokeBuffer';

import { ErrorBoundary } from './components/ErrorBoundary';
import { IOSDownloadPrompt } from './components/IOSDownloadPrompt';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { shouldShowAppDownloadPrompt } from './utils/platformDetection';

function SessionSubscriber() {
  const sessionId = useAppStore(s => s.sessionId);
  const setActiveWorkout = useAppStore(s => s.setActiveWorkout);
  const setRaceState = useAppStore(s => s.setRaceState);

  useEffect(() => {
    if (!sessionId) return;

    let unsubscribe: (() => void) | undefined;

    import('./services/sessionService').then(({ sessionService }) => {
      sessionService.getCurrentSession(sessionId).then(session => {
        const currentWorkout = toActiveWorkoutSpec(session?.active_workout ?? null);
        if (currentWorkout) {
          setActiveWorkout(currentWorkout);
          bluetoothService.programWorkout(activeWorkoutSpecToWorkoutConfig(currentWorkout)).catch(err => {
            console.error('[SessionSubscriber] Failed to program initial workout:', err);
          });
        }
      }).catch(err => console.error('[SessionSubscriber] Failed to get session:', err));

      const sub = sessionService.subscribeToSession(sessionId, (session) => {
        const newWorkout = toActiveWorkoutSpec(session.active_workout);
        if (newWorkout) {
          const current = useAppStore.getState().activeWorkout;
          if (JSON.stringify(newWorkout) !== JSON.stringify(current)) {
            setActiveWorkout(newWorkout);
            bluetoothService.programWorkout(activeWorkoutSpecToWorkoutConfig(newWorkout)).catch(console.error);
          }

          if (newWorkout.start_type === 'synchronized') {
            const nextRaceState = session.race_state;
            if (nextRaceState !== undefined && nextRaceState !== null) {
              setRaceState(nextRaceState);
              bluetoothService.setRaceState(nextRaceState).catch(console.error);

              if (nextRaceState === 11) {
                const state = useAppStore.getState();
                if (state.sessionId && state.participantId) {
                  strokeBuffer.export(state.sessionId).then(async (blob) => {
                    const strokes = JSON.parse(await blob.text());
                    if (strokes.length === 0) return;
                    import('./services/sessionService').then(({ sessionService: ss }) => {
                      ss.uploadWorkoutLog(state.sessionId!, state.participantId!, strokes)
                        .then(() => strokeBuffer.clearSession(state.sessionId!))
                        .catch(err => console.error('[SessionSubscriber] Upload failed:', err));
                    });
                  });
                }
              }
            }
          }
        }
      });
      unsubscribe = sub.unsubscribe;
    }).catch(err => console.error('[SessionSubscriber] Failed to load service:', err));

    return () => { if (unsubscribe) unsubscribe(); };
  }, [sessionId, setActiveWorkout, setRaceState]);

  // Retry programming when PM5 connects
  const connectionState = useAppStore(s => s.connectionState);
  const activeWorkout = useAppStore(s => s.activeWorkout);

  useEffect(() => {
    if (connectionState === 'connected' && activeWorkout) {
      bluetoothService.programWorkout(activeWorkoutSpecToWorkoutConfig(activeWorkout)).catch(console.error);
    }
  }, [connectionState, activeWorkout]);

  return null;
}

function AppRoutes() {
  const participantName = useAppStore(s => s.participantName);

  if (shouldShowAppDownloadPrompt()) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <IOSDownloadPrompt />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={participantName ? <DashboardScreen /> : <Navigate to="/onboarding" replace />}
      />
      <Route
        path="/onboarding"
        element={participantName ? <Navigate to="/" replace /> : <OnboardingScreen />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SessionSubscriber />
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
