import 'fake-indexeddb/auto';

import { openDB } from 'idb';

import type { PM5CompletedCaptureV1 } from '../protocol/capture.js';
import { IndexedDBCaptureStore } from './indexeddb.js';

const databaseName = 'erglink-storage-package-test';
const legacyDb = await openDB(databaseName, 1, {
    upgrade(db) {
        db.createObjectStore('strokes', { autoIncrement: true });
    },
});
legacyDb.close();

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

const store = new IndexedDBCaptureStore({ databaseName });
await store.save(capture, '2026-09-19T16:00:00.000Z');
if ((await store.listPending(10)).length !== 1) throw new Error('Expected one pending capture');
await store.beginUpload(capture.captureId, '2026-09-19T16:01:00.000Z');
await store.failUpload(capture.captureId, 'offline', '2026-09-19T16:01:01.000Z');
await store.beginUpload(capture.captureId, '2026-09-19T16:02:00.000Z');
await store.acknowledge(capture.captureId, {
    acknowledgedAt: '2026-09-19T16:02:01.000Z',
    upstreamWorkoutId: 'workout-indexed-1',
});
if ((await store.listPending(10)).length !== 0) throw new Error('Expected no pending captures');

const upgradedDb = await openDB(databaseName, 2);
if (!upgradedDb.objectStoreNames.contains('strokes')) throw new Error('Legacy stroke store was not preserved');
if (!upgradedDb.objectStoreNames.contains('captures')) throw new Error('Capture store was not created');

const injectedStore = new IndexedDBCaptureStore({ databaseProvider: async () => upgradedDb });
await injectedStore.save({ ...capture, captureId: 'injected-capture-1' }, '2026-09-19T17:00:00.000Z');
if ((await injectedStore.get('injected-capture-1'))?.capture.captureId !== 'injected-capture-1') {
    throw new Error('Injected IndexedDB provider did not persist the capture');
}
upgradedDb.close();

console.log('ok - package IndexedDB lifecycle preserves legacy stores and accepts an app-owned database');
