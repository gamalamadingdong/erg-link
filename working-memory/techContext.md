# Tech Context

**Last Updated**: 2026-01-30
**Status**: Revised (Erg-Link + LogbookCompanion Integration)

## Core Technology Stack

### 1. Architectural Strategy: Shared Backend
Erg-Link and LogbookCompanion share the same Supabase project. Erg-Link is a **React + Vite** web app wrapped in **Capacitor** for native Bluetooth capabilities.

- **Web Mode**: Runs in browser (Chrome). Uses **Web Bluetooth API**.
- **Native Mode**: Runs as iOS/Android App. Uses **Capacitor Bluetooth LE** plugin.
- **Benefit**: Single codebase. iOS requires native for Bluetooth; Android works either way.

### 2. Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Mobile Bridge**: **Capacitor** (v7)
- **Styling**: TailwindCSS
- **State Management**: Zustand

### 3. Backend & Realtime (Shared with LogbookCompanion)
- **Platform**: Supabase
- **Project**: `vmlhcbkyonemmlawnqqr.supabase.co`
- **Database**: PostgreSQL (shared tables: `workout_logs`, `workout_strokes`, `profiles`)
- **Realtime**: **Supabase Realtime** (WebSockets) for live streaming

### 4. Hardware Interfaces (Bluetooth)
- **Abstraction Layer**: `BluetoothService` interface with swappable implementations:
    - *Implementation A (Web)*: `navigator.bluetooth` (Chrome/Bluefy)
    - *Implementation B (Native)*: `@capacitor-community/bluetooth-le` (iOS/Android App)
- **Reference**: `ErgometerJS` library for PM5 protocol

## Known Constraints
- **Apple App Store Review**: "Utility" apps that relay data are scrutinized. Position as "Workout Logger" (validates data capture use case).
- **Android Permissions**: Requires Location/Nearby Devices permissions for BLE scanning.
- **iOS Safari**: Does not support Web Bluetooth — native app required.

## Environment Variables
```bash
VITE_SUPABASE_URL=https://vmlhcbkyonemmlawnqqr.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

## Shared Database Schema Extensions

Erg-Link writes to the same tables as LogbookCompanion, with additional fields:

```sql
-- Existing workout_logs table, extended:
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'concept2_api';
-- Values: 'concept2_api', 'erg_link_live', 'erg_link_manual'

ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS device_serial TEXT;
-- PM5 serial number for deduplication
```
