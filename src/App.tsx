import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { useAppStore } from './store/appStore';
import { bluetoothService } from './services/bluetooth';
import { activeWorkoutSpecToWorkoutConfig } from './lib/pm5-protocol/commands';
import { toActiveWorkoutSpec } from './types/ergSession.types';
import { strokeBuffer } from './services/strokeBuffer';
import { PM5ProgrammingService } from './services/pm5ProgrammingService';

import { ErrorBoundary } from './components/ErrorBoundary';
import { IOSDownloadPrompt } from './components/IOSDownloadPrompt';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { shouldShowAppDownloadPrompt } from './utils/platformDetection';

function SessionSubscriber() {
  const sessionId = useAppStore(s => s.sessionId);
  const setActiveWorkout = useAppStore(s => s.setActiveWorkout);
  const setRaceState = useAppStore(s => s.setRaceState);
  const participantId = useAppStore(s => s.participantId);
  const programmingServiceRef = useRef<PM5ProgrammingService | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let unsubscribe: (() => void) | undefined;

    import('./services/sessionService').then(({ sessionService }) => {
      programmingServiceRef.current = participantId ? new PM5ProgrammingService({
        program: (workout) => bluetoothService.programWorkout(workout),
        writeReceipt: (receipt) => sessionService.updateProgrammingReceipt(participantId, receipt),
      }) : null;

      const deliver = (workout: ReturnType<typeof toActiveWorkoutSpec>, force = false) => {
        if (!workout) return;
        if (programmingServiceRef.current && workout.programming_request_id) {
          void programmingServiceRef.current.deliver(workout, { force }).catch(console.error);
          return;
        }
        void bluetoothService.programWorkout(activeWorkoutSpecToWorkoutConfig(workout)).catch(console.error);
      };

      sessionService.getCurrentSession(sessionId).then(session => {
        const currentWorkout = toActiveWorkoutSpec(session?.active_workout ?? null);
        if (currentWorkout) {
          setActiveWorkout(currentWorkout);
          deliver(currentWorkout);
        }
      }).catch(err => console.error('[SessionSubscriber] Failed to get session:', err));

      const sub = sessionService.subscribeToSession(sessionId, (session) => {
        const newWorkout = toActiveWorkoutSpec(session.active_workout);
        if (newWorkout) {
          const current = useAppStore.getState().activeWorkout;
          if (JSON.stringify(newWorkout) !== JSON.stringify(current)) {
            setActiveWorkout(newWorkout);
            deliver(newWorkout);
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
  }, [sessionId, participantId, setActiveWorkout, setRaceState]);

  // Retry programming when PM5 connects
  const connectionState = useAppStore(s => s.connectionState);
  const activeWorkout = useAppStore(s => s.activeWorkout);

  useEffect(() => {
    if (connectionState === 'connected' && activeWorkout) {
      if (programmingServiceRef.current && activeWorkout.programming_request_id) {
        void programmingServiceRef.current.deliver(activeWorkout, { force: true }).catch(console.error);
      } else {
        void bluetoothService.programWorkout(activeWorkoutSpecToWorkoutConfig(activeWorkout)).catch(console.error);
      }
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
