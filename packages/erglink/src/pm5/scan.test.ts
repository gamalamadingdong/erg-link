import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { PM5_SERVICES } from './protocol/index.js';
import { buildPM5ScanOptions, PM5_SCAN_NAME_PREFIX } from './scan.js';

test('discovers a PM5 by its advertised name prefix', () => {
    assert.equal(buildPM5ScanOptions().namePrefix, PM5_SCAN_NAME_PREFIX);
    assert.equal(PM5_SCAN_NAME_PREFIX, 'PM5');
});

test('never filters a scan on GATT services that are not advertised', () => {
    const options = buildPM5ScanOptions();

    // Regression guard: filtering on the Rowing service (0x0030) matched no
    // advertisement, so iOS scans hung indefinitely and no PM5 was ever found.
    assert.equal(options.services, undefined);
});

test('the rowing service remains available for post-connect GATT access', () => {
    assert.equal(PM5_SERVICES.PM5, 'ce060030-43e5-11e4-916c-0800200c9a66');
});
