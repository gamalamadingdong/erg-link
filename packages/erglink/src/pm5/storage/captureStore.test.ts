import type { PM5CompletedCaptureV1 } from '../protocol/capture.js';
import { MemoryCaptureStore } from './captureStore.js';

const assert = {
    equal(actual: unknown, expected: unknown): void {
        if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    },
    deepEqual(actual: unknown, expected: unknown): void {
        const actualJson = JSON.stringify(actual);
        const expectedJson = JSON.stringify(expected);
        if (actualJson !== expectedJson) throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
    },
    throwsAsync: async (body: () => Promise<unknown>, expectedMessage: string): Promise<void> => {
        try {
            await body();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message === expectedMessage) return;
            throw new Error(`Expected error ${expectedMessage}, received ${message}`);
        }
        throw new Error(`Expected error ${expectedMessage}`);
    },
};

const tests: Promise<void>[] = [];
function test(name: string, body: () => Promise<void>): void {
    tests.push(body().then(() => console.log(`ok - ${name}`)));
}

function completedCapture(captureId: string): PM5CompletedCaptureV1 {
    return {
        _v: 1,
        captureId,
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
}

test('saves completed captures as pending and lists them in stable order', async () => {
    const store = new MemoryCaptureStore();
    await store.save(completedCapture('capture-b'), '2026-09-19T16:00:02.000Z');
    await store.save(completedCapture('capture-a'), '2026-09-19T16:00:01.000Z');

    const pending = await store.listPending(10);
    assert.deepEqual(pending.map((record) => record.capture.captureId), ['capture-a', 'capture-b']);
    assert.equal(pending[0].uploadStatus, 'pending');
    assert.equal(pending[0].attemptCount, 0);
});

test('persists retry state without changing capture identity', async () => {
    const store = new MemoryCaptureStore();
    await store.save(completedCapture('capture-1'), '2026-09-19T16:00:00.000Z');
    await store.beginUpload('capture-1', '2026-09-19T16:01:00.000Z');
    await store.failUpload('capture-1', 'network unavailable', '2026-09-19T16:01:01.000Z');
    await store.beginUpload('capture-1', '2026-09-19T16:02:00.000Z');

    const record = await store.get('capture-1');
    assert.equal(record?.capture.captureId, 'capture-1');
    assert.equal(record?.uploadStatus, 'uploading');
    assert.equal(record?.attemptCount, 2);
    assert.equal(record?.lastError, undefined);
});

test('recovers uploads interrupted before acknowledgement', async () => {
    const store = new MemoryCaptureStore();
    await store.save(completedCapture('capture-interrupted'), '2026-09-19T16:00:00.000Z');
    await store.beginUpload('capture-interrupted', '2026-09-19T16:01:00.000Z');

    assert.equal(await store.recoverStaleUploads(
        '2026-09-19T16:02:00.000Z',
        '2026-09-19T16:03:00.000Z',
    ), 1);
    const record = await store.get('capture-interrupted');
    assert.equal(record?.uploadStatus, 'failed');
    assert.equal(record?.lastError, 'Recovered interrupted PM5 capture upload');
    assert.equal((await store.listPending(10)).length, 1);
});

test('acknowledges upstream persistence and makes the capture immutable', async () => {
    const store = new MemoryCaptureStore();
    await store.save(completedCapture('capture-1'), '2026-09-19T16:00:00.000Z');
    await store.beginUpload('capture-1', '2026-09-19T16:01:00.000Z');
    await store.acknowledge('capture-1', {
        acknowledgedAt: '2026-09-19T16:01:02.000Z',
        upstreamWorkoutId: 'workout-1',
    });

    const record = await store.get('capture-1');
    assert.equal(record?.uploadStatus, 'acknowledged');
    assert.equal(record?.upstreamWorkoutId, 'workout-1');
    assert.equal((await store.listPending(10)).length, 0);
    await assert.throwsAsync(
        () => store.save(completedCapture('capture-1'), '2026-09-19T16:03:00.000Z'),
        'Acknowledged PM5 capture is immutable',
    );
});

await Promise.all(tests);
