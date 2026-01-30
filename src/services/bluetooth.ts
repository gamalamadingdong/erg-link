/**
 * Bluetooth Service Factory
 * 
 * Automatically selects the appropriate Bluetooth implementation
 * based on the current platform.
 */

import { Capacitor } from '@capacitor/core';
import type { BluetoothService } from './bluetooth.types';
import { webBluetoothService } from './bluetooth.web';
import { nativeBluetoothService } from './bluetooth.native';

// Export types
export * from './bluetooth.types';

/**
 * Returns the appropriate Bluetooth service for the current platform.
 * - Native (iOS/Android): Uses Capacitor BLE plugin
 * - Web (Chrome): Uses Web Bluetooth API
 */
export function getBluetoothService(): BluetoothService {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
        console.log('[Bluetooth] Using native implementation');
        return nativeBluetoothService;
    } else {
        console.log('[Bluetooth] Using web implementation');
        return webBluetoothService;
    }
}

// Default export for convenience
export const bluetoothService = getBluetoothService();
