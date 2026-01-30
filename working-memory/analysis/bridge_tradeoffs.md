# Bridge Strategy: Scenario-Driven Analysis

**Goal**: Decide between **Browser-Based** vs. **Native Mobile App** by mapping real rowing scenarios to technical constraints.

---

## The Core Fork: Connectivity Architecture

There are actually **three** distinct approaches, not two:

| Approach | Description |
| :--- | :--- |
| **A: BYOD (Browser)** | Each athlete opens a URL on *their* phone |
| **B: BYOD (Native App)** | Each athlete downloads an app on *their* phone |
| **C: Club-Owned Tablets** | Each erg has a *dedicated tablet* attached (like MoveLab/RP3) |

### Comparison Matrix

| Criterion | BYOD Browser | BYOD App | Club Tablets |
| :--- | :--- | :--- | :--- |
| **Install** | None | App download | Pre-installed |
| **iOS Support** | ❌ | ✅ | ✅ (if Android tablets) |
| **Background Mode** | ❌ | ✅ | N/A (always visible) |
| **Setup Time** | ~1 min/athlete | ~2 min/athlete (first time) | ~0 (always ready) |
| **Hardware Cost** | $0 (athletes' phones) | $0 (athletes' phones) | ~$100-150/erg |
| **Athlete Friction** | Low (Android) / High (iOS) | Medium (download) | **Zero** |
| **Maintenance** | None | App updates | Tablets need charging/updates |
| **Scalability** | ∞ (every athlete has phone) | ∞ | Limited by # of tablets |

---

## Rowing Scenarios

### Scenario 1: The 2K Test (High-Stakes, Individual)

**Context**: Athlete does a max effort 2K. Coach wants live splits on the big screen. Athlete wants to record the result immediately.

| Need | Browser | App |
| :--- | :--- | :--- |
| **Live Data to Coach Screen** | ✅ (if on Android) | ✅ |
| **Phone as "Relay"** | 🟡 Phone screen must stay on for 7 minutes | ✅ Phone can be pocketed |
| **Auto-Save to Profile** | ✅ (if logged in) | ✅ |

**Verdict**: **Native App wins** (reliability during max effort; phone can be ignored).

---

### Scenario 2: The Group Steady State (60-90 min)

**Context**: 20 athletes on ergs doing UT2. Coach wants to monitor everyone's pace.

| Need | Browser | App |
| :--- | :--- | :--- |
| **60+ min Bluetooth** | ❌ Web Bluetooth dies when screen sleeps | ✅ Background Bluetooth |
| **Low Power** | 🟡 Screen on = battery drain | ✅ Background = efficient |
| **Fleet View** | ✅ Dashboard works | ✅ Dashboard works |

**Verdict**: **Native App wins** (long duration + background mode is essential).

---

### Scenario 3: Fight Night Racing (Short, Intense, Fun)

**Context**: 10 athletes race head-to-head in a 500m sprint. Spectators watch the big screen.

| Need | Browser | App |
| :--- | :--- | :--- |
| **Race Duration** | ~2 minutes | ~2 minutes |
| **Screen Lock Issue** | 🟡 Unlikely in 2 min | ✅ |
| **Guest Friction** | 🔴 iOS users need Bluefy | 🟡 App download takes 30s |

**Verdict**: **Toss-up**. Browser works *if* you accept iOS guests are blocked. App works *if* you accept install friction.

---

### Scenario 4: Daily Team Logging (Post-Workout)

**Context**: Coach wants all 40 athletes' workout summaries (distance, average watts, cal) logged to a central database immediately after practice.

| Need | Browser | App |
| :--- | :--- | :--- |
| **Bulk Capture** | 🟡 Each athlete opens URL, connects | 🟡 Each athlete opens App, connects |
| **Offline Queue** | ❌ No offline write (requires PWA hacks) | ✅ SQLite queue, sync later |
| **Assignment** | ? Coach assigns "Lane 1 = Sam" | ? Same |

**Verdict**: **Native App wins** (offline logging, battery, reliability).

---

### Scenario 5: The "Walk-On" Guest

**Context**: A visitor comes to a club's open night. They want to participate in a 500m race.

| Need | Browser | App |
| :--- | :--- | :--- |
| **Time to Join** | 🟢 Android: Scan QR, go. iOS: ❌ blocked | 🟡 Download App (1-2 min) |
| **No Account** | ✅ Anonymous row | ✅ Guest mode |
| **Repeat Visit** | 🟡 Re-scan URL | ✅ App is installed |

**Verdict**: **Browser wins for Android guests**. **App wins for iOS guests** (only option that works).

---

## Summary Matrix

| Scenario | Duration | BYOD Browser | BYOD App | Club Tablets |
| :--- | :--- | :--- | :--- | :--- |
| **2K Test** | ~7 min | 🟡 Android / ❌ iOS | ✅ | ✅✅ (always ready) |
| **Group SS** | 60+ min | ❌ | ✅ | ✅✅ |
| **Fight Night** | ~2 min | ✅ Android / ❌ iOS | 🟡 | ✅✅ |
| **Daily Logging** | Post-workout | 🟡 | ✅ | ✅✅ |
| **Walk-On Guest** | N/A | ✅ Android / ❌ iOS | 🟡 | ✅✅ (no friction) |

---

## Analysis: The MoveLab/RP3 Model

The forum post mentions that **MoveLab uses dedicated tablets per erg** for their racing system. This is worth exploring:

### Pros of Club-Owned Tablets
1.  **Zero Athlete Friction**: Athlete sits down, tablet is already connected.
2.  **No iOS Problem**: Club buys Android tablets (e.g., Amazon Fire HD 8 @ ~$100).
3.  **Always On**: Screen stays visible; no "screen lock" issue.
4.  **Consistent Experience**: Every erg has the same UI, same software version.
5.  **"Kiosk Mode"**: Tablets can be locked to the app (no distractions).

### Cons of Club-Owned Tablets
1.  **Upfront Cost**: 24 ergs × $100 = $2,400 for a full fleet.
2.  **Maintenance**: Tablets need charging, software updates, occasional replacement.
3.  **Theft/Damage**: Tablets could be stolen or broken.
    > ⚠️ **High School Reality Check**: Teenagers + unattended tablets = broken tablets. This is a dealbreaker for most school programs.
4.  **Mounting**: Need a physical mount or holder for each erg.

### Hybrid Possibility
*   **Core Use Case (Club/Team)**: Club Tablets for the erg room.
*   **Overflow / Travel**: BYOD App for travel ergs, regattas, home use.

---

## Revised Questions

1.  **Would you invest $2,400 to outfit 24 ergs with dedicated tablets?**
    *   If YES → Club Tablets are the "gold standard" UX.
    *   If NO → BYOD (App) is the path.

2.  **What is the primary scenario?**
    *   *Daily Training / Logging* → Long sessions, Background Mode matters → **BYOD App** or **Club Tablets**.
    *   *Racing Events / Fight Night* → Short bursts, Guest participation matters → **Club Tablets** eliminate all friction.

3.  **Do you want to sell software or hardware?**
    *   *Software only* → BYOD (Browser or App). Lower barrier.
    *   *Turnkey Solution* → Sell "Erg Racer Kit" (tablets + mounts + software). Higher margin.

---

## Recommendation

> **The software decision is clear: Build a Native App (Capacitor/React).**

The "Phone vs. Tablet" question is a deployment/cost decision, not an architecture decision. The same app runs on both. This means:

| Decision | Choice | Rationale |
| :--- | :--- | :--- |
| **Architecture** | Native App (Capacitor) | iOS support, Background Mode, Offline |
| **Default Deployment** | BYOD (user phones) | $0 cost, scales infinitely |
| **"Pro" Option** | Club Tablets | For clubs that want zero friction (private gyms, events) |

### Next Step
Build the **Universal Bridge App** using React + Vite + Capacitor (matching `scheduleboardv2` stack). It works on phones and tablets identically.



