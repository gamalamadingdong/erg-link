/**
 * PM5 native scan options.
 *
 * Kept free of Capacitor imports so discovery behavior can be unit tested
 * without loading a native plugin runtime.
 */

/** Advertised name prefix used by every PM5 monitor. */
export const PM5_SCAN_NAME_PREFIX = 'PM5';

export interface PM5ScanOptions {
    namePrefix: string;
    services?: string[];
}

/**
 * Build the options used to discover a PM5 over native Bluetooth.
 *
 * Native scan filters match the *advertisement* packet only. PM5 services such
 * as the Rowing service (0x0030) are GATT services resolved after connecting,
 * so filtering a scan on them matches no advertisement and the scan appears to
 * hang forever. Discovery therefore matches the advertised name prefix,
 * mirroring the hardware-proven browser driver, which filters on `namePrefix`
 * and passes PM5 services as non-filtering `optionalServices`.
 *
 * Services are resolved after connecting, so omitting them here does not
 * restrict later GATT access.
 */
export function buildPM5ScanOptions(): PM5ScanOptions {
    return { namePrefix: PM5_SCAN_NAME_PREFIX };
}
