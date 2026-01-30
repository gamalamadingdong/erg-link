# UX Journey Maps: Athlete Onboarding & Workflow

This document walks through the **end-to-end user experience** for each rowing scenario. We cover three user states:
- 🆕 **First Time** (no app, no account)
- 🔄 **Returning** (has app, has profile)
- ➕ **New Athlete** (team member needs onboarding mid-session)

---

## Scenario 1: The 2K Test

**Context**: High school team's monthly 2K test. 20 athletes. Coach wants live splits on the big screen and auto-logged results.

### 🆕 First Time (Start of Season)

| Step | Athlete Action | Time |
| :--- | :--- | :--- |
| 1 | Coach: "Download 'Erg Bridge' from the App Store" | +0:00 |
| 2 | Athlete searches, downloads, installs | +1:30 |
| 3 | Opens app → "Join Team" → Scans team QR code | +2:00 |
| 4 | Enters name (or picks from roster) | +2:15 |
| 5 | App shows "Tap to Connect" → Bluetooth dialog → Selects PM5 | +2:45 |
| 6 | Connected! Dashboard shows erg is linked | +3:00 |
| 7 | Athlete rows. Data streams to coach screen. | +3:00+ |
| **Total first-time setup** | | **~3 min** |

### 🔄 Returning (Has App)

| Step | Athlete Action | Time |
| :--- | :--- | :--- |
| 1 | Opens app (already installed) | +0:00 |
| 2 | App auto-reconnects to last PM5 OR athlete taps "Connect" | +0:15 |
| 3 | Connected! | +0:30 |
| **Total returning setup** | | **~30 sec** |

### ➕ New Athlete (Late Joiner)

| Step | Action | Time |
| :--- | :--- | :--- |
| 1 | Coach hands athlete a phone with QR code displayed | +0:00 |
| 2 | New athlete scans with their phone camera → App Store link | +0:10 |
| 3 | Downloads app | +1:30 |
| 4 | Scans team QR again (inside app) | +1:45 |
| 5 | Picks name from roster / enters new name | +2:00 |
| 6 | Connects to PM5 | +2:30 |
| **Total new athlete setup** | | **~2.5 min** |

---

## Scenario 2: Fight Night Racing (500m Sprint)

**Context**: Friday evening "Fight Night" event. 10 athletes race head-to-head. Some are club members, some are guests.

### 🆕 First Time Guest

| Step | Guest Action | Time |
| :--- | :--- | :--- |
| 1 | Poster at entrance: "Scan to Race" QR code | +0:00 |
| 2 | Opens App Store, downloads "Erg Bridge" | +1:30 |
| 3 | Opens app → "Join Race" → Scans event QR | +2:00 |
| 4 | Enters nickname: "SpeedDemon" (no account required) | +2:10 |
| 5 | Assigned to Lane 3 → "Connect Your Erg" | +2:20 |
| 6 | Taps button → Bluetooth dialog → Selects PM5 | +2:45 |
| 7 | Sits on erg, waits for race start | +3:00 |
| **Total guest setup** | | **~3 min** |

### 🔄 Returning Member

| Step | Member Action | Time |
| :--- | :--- | :--- |
| 1 | Opens app → "Join Race" → Scans event QR | +0:00 |
| 2 | App shows their name, assigned lane | +0:10 |
| 3 | Taps "Connect" → Auto-connects to nearest PM5 | +0:30 |
| **Total returning setup** | | **~30 sec** |

### Race Flow (All Athletes)

| Phase | What Happens |
| :--- | :--- |
| **Staging** | Big screen shows "Lane 1: Sam, Lane 2: Alex..." |
| **Countdown** | "3... 2... 1... ROW!" (synced audio) |
| **Racing** | Live boat positions update on big screen |
| **Finish** | Results auto-posted; guests can screenshot their time |

---

## Scenario 3: Group Steady State (60 min UT2)

**Context**: Morning practice. 20 athletes do a 60-minute low-intensity piece. Coach monitors pace on a dashboard.

### 🆕 First Time

Same as 2K Test (~3 min onboarding).

### 🔄 Returning (Daily Use Pattern)

| Step | Athlete Action | Time |
| :--- | :--- | :--- |
| 1 | Walks in, sits on their assigned erg | +0:00 |
| 2 | Opens app (already installed) | +0:05 |
| 3 | App auto-connects (remembers last PM5) | +0:15 |
| 4 | **Phone goes in pocket** (Background Mode) | +0:20 |
| 5 | Rows for 60 min. Data streams continuously. | +0:20 → +60:00 |
| 6 | Finishes. Workout auto-saved. | +60:00 |
| **Total daily setup** | | **~20 sec** |

> ⚠️ **Key Feature**: Background Bluetooth. Phone screen can be off during the entire piece.

---

## Scenario 4: Daily Team Logging (Post-Workout)

**Context**: After practice, coach wants everyone's workout summary logged to the team database.

### Option A: During-Workout Capture (Preferred)

If athletes connected during the workout (Scenario 3), data is already captured. No extra step.

### Option B: Post-Workout Manual Capture

| Step | Action | Time |
| :--- | :--- | :--- |
| 1 | Workout ends. Athlete opens app. | +0:00 |
| 2 | Taps "Log Workout" → Connects to PM5 | +0:15 |
| 3 | App reads PM5 memory (last workout summary) | +0:20 |
| 4 | Athlete confirms/tags workout ("UT2", "60 min SS") | +0:30 |
| 5 | Uploads to team database | +0:35 |
| **Total logging time** | | **~35 sec** |

---

## Scenario 5: Team Tryouts / Open House

**Context**: 30 prospective athletes show up to try rowing. None have the app. You need them rowing in 10 minutes.

### Mass Onboarding Strategy

| Step | Coach Action |
| :--- | :--- |
| 1 | Projects giant QR code on wall: "Scan to Join" |
| 2 | Announces: "Download the app, then scan again inside the app" |
| 3 | Hands out lane assignments on paper slips |
| 4 | Athletes self-serve: Download → Scan → Enter Name → Connect |
| **Expected time** | ~5 min for 80% of group to be connected |

### Fallback for Stragglers
- Keep 3-4 "Club Tablets" (loaner devices) for guests without smartphones or with dead batteries.
- Tablets pre-loaded with app, ready to connect.

---

## Key UX Principles Identified

1. **"Scan to X"**: Every action starts with a QR code. Universal, fast.
2. **Auto-Reconnect**: Returning users should never manually pair again.
3. **Guest Mode**: No account required for one-off events.
4. **Background Mode**: Essential for long pieces (phone can be pocketed).
5. **Post-Workout Capture**: Fallback for athletes who forget to connect beforehand.

---

## Open Design Questions

1. **Erg Assignment**: How does athlete know which PM5 is theirs?
   - Option A: Physical lane labels (PM5 #1, #2, etc.)
   - Option B: Proximity (connect to nearest)
   - Option C: Coach assigns in app ("Sam → Lane 3")

2. **Team Roster Integration**: Pre-populate athlete names from a roster, or let them type?

3. **PM5 Memory Read**: Can we pull historical workout data, or only live stream?
