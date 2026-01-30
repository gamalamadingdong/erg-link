# Active Context

**Last Updated**: 2026-01-29
**Status**: Decision Confirmed

---

## Confirmed Decision

**Build a Native App (Capacitor) for PM5 connectivity.**

### Core Principles
1. **Lightweight**: Download → Connect → Row. Done.
2. **No Accounts**: Guest mode by default. Zero signup friction.
3. **Data Capture First**: Log every row, racing or training.
4. **Racing as Feature**: Compelling use case, not the core.

### Technology Stack
- **Frontend**: React + Vite + TypeScript
- **Native Wrapper**: Capacitor (iOS + Android)
- **Bluetooth**: `@capacitor-community/bluetooth-le`
- **Backend**: Supabase (Realtime + PostgreSQL)
- **Pattern**: Matches `scheduleboardv2` architecture

---

## Next Steps

1. Initialize React + Vite + Capacitor scaffold
2. Bluetooth POC: Scan for PM5, connect, read one value
3. Basic UI: "Connect" button → Status indicator

---

## Research Completed
- [x] UX Trade-off Analysis (`analysis/bridge_tradeoffs.md`)
- [x] UX Journey Maps (`analysis/ux_journeys.md`)
- [x] Competitor: RowHero (`analysis/competitors_rowhero.md`)
