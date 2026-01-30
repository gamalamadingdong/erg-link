# Implementation Plan - Phase 1: Bridge Prototype

**Goal**: Validate that we can connect to a Concept2 PM5 via Web Bluetooth using a standard React + Vite stack.

## User Review Required
> [!IMPORTANT]
> **Bluetooth Constraint**: This **Phase 1 Prototype** will use **Web Bluetooth** (Chrome/Android/Bluefy). It will NOT work in iOS Safari.
> **Phase 2 Plan**: We will add **Capacitor** later to wrap this app for native iOS support, bypassing the Safari limitation.

## Proposed Changes

### 1. Project Initialization [New]
Initialize `erg-racer` as a **standard React + Vite app**.
*   **Tech Stack**: React 18, Vite, TypeScript, TailwindCSS 4.0.
*   *Note*: Matches `LogbookAnalyzer` structure. Capacitor will be added in Phase 2.

### 2. Feature: Device Connector [New]
Create the core connectivity logic.
*   **File**: `src/lib/bluetooth/pm5.ts`
    *   Logic to call `navigator.bluetooth.requestDevice()`
    *   Filter for Concept2 Service UUID: `ce060000-43e5-11e4-916c-0800200c9a66`
*   **File**: `src/components/DeviceScanner.tsx`
    *   UI: "Scan for PM5" button.
    *   Status: "Scanning...", "Connected", "Error".
    *   Display: Raw data stream (mocked or real).

### 3. Basic UI Skeleton [New]
*   **File**: `src/App.tsx`
    *   Simple layout with a "Connect" header and the Scanner component.

## Verification Plan

### Automated Tests
*   *Note*: Web Bluetooth cannot be easily automated in CI/CD (requires hardware). We will lint and build-check only.
*   `npm run lint`
*   `npm run build`

### Manual Verification
1.  **Browser Check**: Open the app in Chrome (Desktop).
2.  **Hardware Check**:
    *   Turn on a Concept2 PM5.
    *   Click "Connect Erg".
    *   **Success**: The browser's native Bluetooth Permission dialog appears showing "PM5 ...".
    *   **Select**: Click the device and Pair.
    *   **Verify**: App shows "Connected" state.
