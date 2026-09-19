import 'fake-indexeddb/auto';

import type { PM5CompletedCaptureV1 } from '../lib/pm5-protocol/capture';
import { IndexedDBCaptureStore } from './indexedDbCaptureStore';
import { strokeBuffer } from './strokeBuffer';

const assert = {
    equal(actual: unknown, expected: unknown): void {
        if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    },
};

const capture: PM5CompletedCaptureV1 = {
    _v: 1,
    captureId: 'indexed-capture-1',
    captureVersion: 1,
    status: 'completed',
    startedAt: '2026-09-19T15:59:09.646Z',
    completedAt: '2026-09-19T15:59:36.046Z',
    timezone: 'America/New_York',
    rawNotifications: [],
    strokes: [],
    splits: [],
    summary: {
        workDistanceMeters: 100,
        workTimeSeconds: 26.4,
        averagePaceSecondsPer500m: 132,
        averageStrokeRate: 23,
        averageWatts: 152,
        totalCalories: 6,
        restDistanceMeters: 0,
        restTimeSeconds: 0,
        strokeCount: 10,
    },
};

await strokeBuffer.append({
    timestamp: 1,
    distance: 1,
    pace: 1,
    strokeRate: 1,
    watts: 1,
    elapsedTime: 1,
}, 'legacy-session');
assert.equal(await strokeBuffer.count('legacy-session'), 1);

const store = new IndexedDBCaptureStore();
await store.save(capture, '2026-09-19T16:00:00.000Z');
assert.equal((await store.listPending(10)).length, 1);
assert.equal((await store.get(capture.captureId))?.capture.captureId, capture.captureId);
assert.equal(await strokeBuffer.count('legacy-session'), 1);

await store.beginUpload(capture.captureId, '2026-09-19T16:01:00.000Z');
await store.failUpload(capture.captureId, 'offline', '2026-09-19T16:01:01.000Z');
assert.equal((await store.get(capture.captureId))?.attemptCount, 1);
assert.equal((await store.get(capture.captureId))?.uploadStatus, 'failed');

await store.beginUpload(capture.captureId, '2026-09-19T16:02:00.000Z');
await store.acknowledge(capture.captureId, {
    acknowledgedAt: '2026-09-19T16:02:01.000Z',
    upstreamWorkoutId: 'workout-indexed-1',
});
assert.equal((await store.get(capture.captureId))?.uploadStatus, 'acknowledged');
assert.equal((await store.listPending(10)).length, 0);

console.log('ok - IndexedDB capture lifecycle preserves the legacy stroke store');
