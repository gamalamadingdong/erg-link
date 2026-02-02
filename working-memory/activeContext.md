# Active Context

**Last Updated**: 2026-02-01
**Status**: Execution & Verification

---

## Current Focus
Implementing and verifying **Live Racing** and **Interval Workout** support.

## Recent Progress
- [x] **Interval Support**: Implemented CSAFE commands (`CSAFE_PM_SET_WORKOUTTYPE`, `CSAFE_PM_CONFIGURE_WORKOUT`) to program intervals (Distance/Time) via Bluetooth.
- [x] **Local Data Buffering (Hybrid Strategy)**:
    - Created `StrokeBuffer` service (IndexedDB) to save every stroke locally.
    - Implementing auto-upload logic on session termination to `workout_logs`.
    - Calculated Supabase Realtime costs (Negligible for target team size).
- [x] **Testing**: Created `simulate_bots.ts` to simulate multiple rowers joining a session and responding to race states.

## Next Steps
1. **Hardware Verification**: Test functionality with physical PM5 and mobile device.
2. **Offline Resilience**: Enhance the upload queue to handle cases where network is lost at race finish.
3. **UI Polish**: Refine the "Live Session" participant view for rowers.

---

## Technical Decisions
- **Hybrid Data Flow**: Realtime messages for ephemeral race/coach view (throttled). Full log uploaded from local buffer for historical record.
- **Supabase**: Using `erg_sessions` for state and `erg_session_participants` for live data. `workout_logs` for final storage.
