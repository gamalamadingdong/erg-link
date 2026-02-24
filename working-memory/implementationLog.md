# Implementation Log: ErgLink Development History

**Purpose**: Track what's been built, what worked, what failed, and why certain approaches were abandoned.

---

## Phase 1: Architecture & Bluetooth Foundation

**Timeline**: Late 2025 → January 2026
**Status**: ✅ Complete

### What Was Built
1. **Capacitor + React + Vite Stack**
   - Single codebase for web (Chrome) and native (iOS/Android)
   - Platform-detected Bluetooth implementation via factory pattern
   - Zustand for state management

2. **PM5 Bluetooth Connectivity**
   - Web Bluetooth API implementation (Chrome/Bluefy)
   - Capacitor BLE plugin implementation (iOS/Android)
   - Abstracted `BluetoothService` interface with swappable backends
   - PM5 scanning, connection, disconnection

3. **PM5 Data Parsing (CSAFE v0.27)**
   - 3 rowing characteristics parsed: General Status (0x31), Additional Status 1 (0x32), Additional Status 2 (0x33)
   - `PM5DataAggregator` combines multi-characteristic updates into unified data
   - Unit conversions: centiseconds→seconds, 0.1m→meters, C2 watts formula

4. **Live Data Dashboard**
   - Real-time display: distance, pace, stroke rate, watts, elapsed time
   - Connection status indicators
   - iOS Safari detection with app download prompt

### What Worked
- ✅ Factory pattern for BT abstraction is clean and easily testable
- ✅ PM5DataAggregator handles multi-characteristic timing well
- ✅ Web Bluetooth works reliably in Chrome
- ✅ Dark-themed mobile-first UI looks professional

### Lessons Learned
- 📝 iOS Safari has no Web Bluetooth — native app is mandatory for iOS
- 📝 PM5 name prefix filter (`PM5`) is sufficient for device discovery
- 📝 Need `optionalServices` in Web BT or can't discover PM_CONTROL service later

---

## Phase 2: Session & Racing Infrastructure

**Timeline**: January → February 2026
**Status**: ✅ Core Complete, 🚧 Polish Remaining

### What Was Built
1. **Supabase Realtime Sessions**
   - `erg_sessions` table: join code, active workout, race state
   - `erg_session_participants` table: display name, live data, heartbeat
   - Realtime subscription + 2s polling fallback for race state

2. **Session Join Flow**
   - Name entry + join code form (guest mode, no account required)
   - Join → subscribe → receive workout programming + race state updates

3. **CSAFE Workout Programming**
   - Fixed distance/time workouts
   - Fixed interval workouts (distance or time)
   - Variable interval workouts (chunked multi-frame sends)
   - Screen state management (navigate PM5 to "Prepare to Row")

4. **Race State Control**
   - Race operation types: Disable, WaitToStart (SET), Start (GO), FalseStart, Terminate
   - Visual overlays for race states (SET/GO/FALSE START)
   - Auto-upload of stroke buffer on race TERMINATE

5. **Stroke Buffer (IndexedDB)**
   - Local IndexedDB buffer for every stroke via `idb` library
   - Session-keyed storage with auto-increment
   - Export to JSON blob for upload

6. **Bot Simulator** (`scripts/simulate_bots.ts`)
   - Simulates 1-N rowers joining sessions with fake physics data
   - Useful for testing coach dashboard in LogbookCompanion without hardware

### What Worked
- ✅ QR/code-based session join is fast and frictionless
- ✅ Hybrid data strategy (local buffer + throttled realtime) is sound
- ✅ Supabase Realtime subscription + polling fallback is robust
- ✅ CSAFE frame construction produces valid PM5 commands

### What Failed / Lessons Learned
- ⚠️ `uploadWorkoutLog()` was initially broken — referenced non-existent columns, had dead code paths
- ⚠️ Native BT `programWorkout()` and `setRaceState()` were stubs until Phase 1 stabilization (Feb 2026)
- 📝 Supabase types were manually maintained and drifted from actual schema — now fixed
- 📝 `as any` casts on Supabase client calls masked real type errors

---

## Phase 3: Phase 1 Stabilization (Current)

**Timeline**: February 2026
**Status**: ✅ Complete

### What Was Fixed
1. **Native BT Parity**
   - Ported `programWorkout()` and `setRaceState()` to native implementation
   - Extracted shared CSAFE frame builders into `lib/pm5-protocol/commands.ts`
   - Both Web and Native now use identical frame construction logic

2. **Supabase Types**
   - Added `race_state` column to `erg_sessions` type (was in schema but not typed)
   - Added `group_name` column to `erg_session_participants` type
   - Added `workout_logs` table type (full schema match)
   - Removed all `as any` casts from `sessionService.ts`

3. **Session Service Cleanup**
   - `uploadWorkoutLog()` rewritten with proper typed inserts matching actual `workout_logs` schema
   - Uses `source: 'erg_link_live'` and `raw_data` JSONB for stroke data
   - Proper fallback for anonymous users → participant record

4. **Code Quality**
   - Removed ~200 lines of duplicated inline CSAFE frame construction from `bluetooth.web.ts`
   - Shared `buildWorkoutFrames()`, `buildRaceStateFrame()`, `buildProprietaryFrame()` in commands.ts
   - Removed dead/commented-out code from session service

---

## Not Yet Built

| Feature | Priority | Notes |
|---|---|---|
| Hardware verification (real PM5) | P0 | Blocked on physical device access |
| Auto-reconnect on BT disconnect | P1 | Critical for 60+ min sessions |
| Offline upload retry queue | P1 | Queue failed uploads, retry on reconnect |
| React Router + screen decomposition | P1 | App.tsx is 450+ lines monolith |
| Session end / leave UI | P2 | Only auto-end on TERMINATE currently |
| Participant list / leaderboard | P2 | Athletes can't see other racers |
| Unit tests (PM5 parsers) | P2 | Pure functions, easy to test |
| CI/CD pipeline | P2 | No automated builds or checks |
| iOS App Store submission | P3 | Scaffolded but not published |
| Additional characteristics (0x34-0x3F) | P3 | Force curve, stroke data, etc. |
   - Make terminology configurable
   - Add feature toggle support

3. **Document Extraction**
   - Map source → template for each component
   - Document generalization decisions
   - Provide usage examples

### Dependencies
- Need Working Memory and instruction architecture complete first
- ScheduleBoard v2 production release should be stable

---

## Phase 7: Example Applications (Not Started)

**Timeline**: TBD  
**Status**: ❌ Not Started

### Planned Work
1. **HVAC Business Example**
   - Full implementation using template
   - Job tracking, technician scheduling
   - Equipment tracking

2. **Cleaning Business Example**
   - Recurring appointments
   - Team management
   - Route optimization

3. **Personal Care Example**
   - Appointment booking
   - Stylist schedules
   - Package/membership management

---

## Abandoned Approaches

### Generator CLI (Abandoned December 2025)
**Why Built**: Thought code generation would be faster  
**Why Abandoned**: Too complex to maintain, instruction-driven is better  
**What We Learned**: Copilot + instructions > custom CLI  
**Code Location**: `generator/` (kept as reference)

---

## Key Metrics & Learnings

### Development Velocity
- **Auth System**: ~3 days including edge functions
- **Notification System**: ~2 days with orchestrator pattern
- **Subscription System**: ~4 days including Stripe integration
- **Working Memory Setup**: ~1 day to establish pattern

### What Accelerates Development
1. ✅ Clear database schema defined upfront (data-first design)
2. ✅ Edge Functions for business logic (keeps frontend simple)
3. ✅ TypeScript strict mode (catches bugs early)
4. ✅ Supabase RLS (security built-in)
5. ✅ Working Memory (persistent context across sessions)

### What Slows Development
1. ⚠️ Over-engineering abstractions before needed (YAGNI violation)
2. ⚠️ Mobile testing on actual devices (necessary but time-consuming)
3. ⚠️ Webhook testing (need to use Stripe CLI or ngrok)
4. ⚠️ Cold start times on Edge Functions (2-3s on first request)

---

## Template for Future Entries

```markdown
## Phase X: [Feature Name] ([Status])

**Timeline**: [Start] → [End]  
**Status**: [Not Started | In Progress | Complete | Abandoned]

### What Was Built
1. **[Component/Feature 1]**
   - [Detail]
   - [Detail]

### What Worked
- ✅ [Success]
- ✅ [Success]

### What Failed / Lessons Learned
- ❌ [Failure]
- 📝 Lesson: [Learning]

### Metrics
- **Time Spent**: [X days/hours]
- **Lines of Code**: [Estimate]
- **Files Changed**: [Count]
```
