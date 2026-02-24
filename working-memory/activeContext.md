# Active Context

**Last Updated**: June 2025
**Status**: Phase 1 Complete — Integration Contract Written — Ready for Phase 2

---

## Current Focus
Phase 1 (Stabilize Foundation) is **complete**. Integration contract with LogbookCompanion defined (ADR-007). Ready to begin Phase 2 (Code Quality) and then Phase 3 integration wiring.

## Integration Contract (ADR-007)
Defined shared TypeScript types in `src/types/ergSession.types.ts` (mirror of LC canonical) covering:
- **`ActiveWorkoutSpec`** — typed shape for `erg_sessions.active_workout` JSONB. Replaces `as any` casts. Includes PM5 programming fields + metadata passthrough (`canonical_name`, `template_id`, `group_assignment_id`).
- **`ErgLinkUploadMeta`** — typed shape for `workout_logs.raw_data` when `source = 'erg_link_live'`. Echoes metadata from active workout spec + full stroke buffer.
- **`SOURCE_PRIORITY`** — codifies reconciliation priority (manual=1, erg_link_live=2, concept2=3).
- **`ReconciliationMatch`** — dedup tolerances (±5min, ±10m, ±2s).

### Integration Wiring TODO (Phase 3)
1. [ ] Update `appStore.ts` `activeWorkout` type to `ActiveWorkoutSpec | null`
2. [ ] Update `App.tsx` to remove `as any` cast on `session.active_workout`
3. [ ] Write `ActiveWorkoutSpec` → `WorkoutConfig` converter function (in `commands.ts`)
4. [ ] Update `sessionService.ts` `uploadWorkoutLog()` to read metadata from active workout spec and populate `canonical_name`, `template_id`, `group_assignment_id` on upload
5. [ ] Construct `ErgLinkUploadMeta` in `raw_data` on upload

## Recent Progress (Phase 1 — Stabilize Foundation)
- [x] **Shared CSAFE Frame Builders**: Extracted ~200 lines of inline frame construction from `bluetooth.web.ts` into shared `lib/pm5-protocol/commands.ts` — `buildProprietaryFrame()`, `buildWorkoutFrames()`, `buildRaceStateFrame()`
- [x] **Native BT Parity**: Ported `programWorkout()` and `setRaceState()` in `bluetooth.native.ts` — were console.log stubs, now fully implemented using shared frame builders + `BleClient.write()`
- [x] **Supabase Types Fixed**: Rewrote `types/supabase.ts` to match actual DB schema — added `race_state` to sessions, `group_name` to participants, full `workout_logs` table
- [x] **Session Service Cleanup**: Removed all 8+ `as any` casts from `sessionService.ts`, rewrote `uploadWorkoutLog()` with proper typed inserts (auth user → `workout_logs`, anon → participant record)
- [x] **Dead Code Removed**: Removed unused UUID constants from `bluetooth.types.ts`, removed dead `CSAFE_COMMANDS`/`CSAFE_FRAME` from `pm5-protocol/types.ts`, consolidated duplicate `constants/csafe` imports
- [x] **Implementation Log Replaced**: Removed stale ScheduleBoard v2 history, wrote ErgLink-specific development history
- [x] **Build Verified**: `tsc --noEmit` and `vite build` pass with zero errors

## Next Steps (Phase 2 — Code Quality)
1. **Decompose App.tsx**: Break 450+ line monolith into route-based screens (Connect, Session, Race)
2. **Add React Router**: Proper navigation instead of conditional rendering
3. **Unit Tests**: PM5 parser functions are pure — easy wins for test coverage
4. **Error Boundaries**: Add React error boundaries for BT failures

## Future Phases
- **Phase 3 — Feature Completion**: Offline retry queue, auto-reconnect, session end flow, participant list
- **Phase 4 — Ship Native**: iOS/Android App Store submission, CI/CD pipeline

---

## Technical Decisions
- **Hybrid Data Flow**: Realtime messages for ephemeral race/coach view (throttled). Full log uploaded from local buffer for historical record.
- **Supabase**: Using `erg_sessions` for state and `erg_session_participants` for live data. `workout_logs` for final storage.
- **CSAFE Frame Construction**: Centralized in `lib/pm5-protocol/commands.ts`. Both web and native BT use same builders — only transport layer differs.
