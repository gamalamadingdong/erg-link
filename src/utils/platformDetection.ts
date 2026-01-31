/**
 * Platform Detection Utilities
 * 
 * Detects iOS devices and Web Bluetooth support for conditional UI rendering.
 */

/**
 * Check if the current device is running iOS
 */
export function isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;

    const userAgent = navigator.userAgent || navigator.vendor || '';

    // Check for iOS devices
    return /iPad|iPhone|iPod/.test(userAgent) ||
        // iPad on iOS 13+ reports as Mac
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Check if Web Bluetooth API is supported
 * Note: On iOS, even Chrome/Edge use WebKit which doesn't support Web Bluetooth
 */
export function isWebBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Check if the user should be prompted to download the native app
 * Returns true for iOS devices (Web Bluetooth never works there)
 */
export function shouldShowAppDownloadPrompt(): boolean {
    return isIOS();
}

/**
 * App Store URLs (update these when the iOS app is published)
 */
export const APP_STORE_URL = 'https://apps.apple.com/app/erg-link/id000000000'; // Placeholder
export const BLUEFY_URL = 'https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055';
