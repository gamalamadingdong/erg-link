# System Patterns

**Last Updated**: 2026-01-30
**Status**: Revised (Erg-Link Identity)

## Architecture: The "Relay" Pattern

Erg-Link acts as a relay between hardware (PM5) and cloud (Supabase).

### Component Overview
```
┌─────────┐     ┌─────────────┐     ┌──────────┐     ┌─────────────────┐
│  PM5    │◄───►│  Erg-Link   │────►│ Supabase │◄───►│ LogbookCompanion│
│(Hardware)│ BT  │ (Mobile App)│ WS  │ (Cloud)  │ HTTP│   (Web App)     │
└─────────┘     └─────────────┘     └──────────┘     └─────────────────┘
```

### Data Flow
1. **PM5 → Erg-Link**: Bluetooth LE (stroke-by-stroke data, ~10-20Hz)
2. **Erg-Link → Supabase**: WebSocket insert (throttled to ~4Hz for bandwidth)
3. **Supabase → LogbookCompanion**: REST API read (on-demand or realtime subscription)

## Bluetooth Service Abstraction

```typescript
interface BluetoothService {
  scan(): Promise<Device[]>;
  connect(deviceId: string): Promise<void>;
  disconnect(): void;
  onData(callback: (data: PM5Data) => void): void;
}

// Web implementation uses navigator.bluetooth
// Native implementation uses @capacitor-community/bluetooth-le
```

## Data Synchronization

### Realtime Stream (Racing/Live View)
- **Frequency**: PM5 updates ~10-20Hz. Throttle to ~4Hz for network.
- **Payload**: `{ session_id, user_id, distance, pace, stroke_rate, timestamp }`
- **Protocol**: Supabase Realtime (WebSockets)

### Workout Capture (Default Mode)
- **Frequency**: Aggregate locally, sync summary on workout end
- **Payload**: Full `workout_logs` row + optional `workout_strokes`
- **Protocol**: Supabase REST insert

## Offline Handling

1. **No Network**: Queue workout in local storage (Capacitor Preferences or SQLite)
2. **On Reconnect**: Sync queued workouts to Supabase
3. **Deduplication**: Use `device_serial` + `date` + `distance` as unique key

## Guest Mode Flow

1. User opens Erg-Link without logging in
2. Workout captured with `user_id = NULL`, `session_token = <uuid>`
3. Workout stored in Supabase as "unclaimed"
4. Later: User logs in → "Claim" button appears → Links workout to their `user_id`

## iOS Compatibility

- **Constraint**: iOS Safari does not support Web Bluetooth
- **Solution**: Capacitor native wrapper with `@capacitor-community/bluetooth-le`
- **Fallback**: Web mode for Chrome (Android/Desktop)
