# erg-link

**erg-link** is a Bluetooth Low Energy (BLE) bridge for Concept2 rowing machines, enabling real-time workout data streaming to web applications.

## Features

- **PM5 BLE Integration**: Connects to Concept2 PM5 monitors via Bluetooth
- **Real-time Data Streaming**: Live workout metrics (distance, pace, heart rate, power)
- **CSAFE Protocol Support**: Implements Concept2's CSAFE-over-BLE specification
- **Cross-Platform**: Built with Capacitor for iOS and Android
- **WebSocket Bridge**: Streams data to web apps for analysis and logging

## Architecture

erg-link acts as a bridge between:
1. **Concept2 PM5** (via BLE) → Workout data
2. **Mobile App** (iOS/Android) → Data processing
3. **Web App** (via WebSocket) → Analytics & storage

## Use Cases

- Live session monitoring for coaches
- Real-time workout data for training apps
- Group workout synchronization
- Custom analytics dashboards

## Getting Started

### Prerequisites
- Node.js 18+
- iOS/Android development environment (Xcode/Android Studio)
- Concept2 rowing machine with PM5 monitor

### Installation

```bash
npm install
```

### Development

```bash
# Run web version
npm run dev

# Build for iOS
npx cap sync ios
npx cap open ios

# Build for Android
npx cap sync android
npx cap open android
```

## Related Projects

- **[logbook-companion](https://github.com/gamalamadingdong/logbook-companion)** - Web app for rowing analytics and training plans

## CSAFE Specification

See `csafe-spec/` for the Concept2 CSAFE-over-BLE protocol documentation.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Author

© 2026 Sam Gammon
