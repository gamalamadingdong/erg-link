import type { PM5CompletedCaptureV1 } from '@readyall/erglink/pm5';
import {
    MobileSQLiteCaptureStore,
    type CaptureSQLiteDatabase,
} from './mobileSQLiteCaptureStore';

const assert = {
    equal(actual: unknown, expected: unknown): void {
        if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    },
};

async function test(name: string, body: () => Promise<void>): Promise<void> {
    await body();
    console.log(`ok - ${name}`);
}

class FakeSQLiteDatabase implements CaptureSQLiteDatabase {
    private readonly records = new Map<string, string>();

    async query(statement: string, values: unknown[] = []): Promise<{ values?: unknown[] }> {
        if (statement.includes('WHERE capture_id')) {
            const json = this.records.get(String(values[0]));
            return { values: json ? [{ record_json: json }] : [] };
        }
        const rows = [...this.records.values()]
            .map((json) => ({ json, record: JSON.parse(json) as { uploadStatus: string; createdAt: string } }))
            .filter(({ record }) => record.uploadStatus === 'pending' || record.uploadStatus === 'failed')
            .sort((a, b) => a.record.createdAt.localeCompare(b.record.createdAt))
            .slice(0, Number(values[0]))
            .map(({ json }) => ({ record_json: json }));
        return { values: rows };
    }

    async run(_statement: string, values: unknown[] = []): Promise<void> {
        this.records.set(String(values[0]), String(values[4]));
    }
}

const capture: PM5CompletedCaptureV1 = {
    _v: 1,
    captureId: 'mobile-capture',
    captureVersion: 1,
    status: 'completed',
    startedAt: '2026-09-19T12:00:00.000Z',
    completedAt: '2026-09-19T12:00:30.000Z',
    timezone: 'America/New_York',
    rawNotifications: [],
    strokes: [],
    splits: [],
    summary: {
        workDistanceMeters: 100,
        workTimeSeconds: 30,
        averagePaceSecondsPer500m: 150,
        averageStrokeRate: 20,
        averageWatts: 104,
        totalCalories: 5,
        restDistanceMeters: 0,
        restTimeSeconds: 0,
        strokeCount: 10,
    },
};

await test('mobile SQLite adapter follows the shared retry and acknowledgement lifecycle', async () => {
    const database = new FakeSQLiteDatabase();
    const store = new MobileSQLiteCaptureStore(async () => database);

    await store.save(capture, '2026-09-19T12:01:00.000Z');
    assert.equal((await store.listPending(10)).length, 1);
    assert.equal((await store.beginUpload(capture.captureId, '2026-09-19T12:02:00.000Z')).attemptCount, 1);
    assert.equal((await store.failUpload(capture.captureId, 'offline', '2026-09-19T12:03:00.000Z')).uploadStatus, 'failed');
    await store.beginUpload(capture.captureId, '2026-09-19T12:04:00.000Z');
    const acknowledged = await store.acknowledge(capture.captureId, {
        acknowledgedAt: '2026-09-19T12:05:00.000Z',
        upstreamWorkoutId: 'lc-workout-1',
    });
    assert.equal(acknowledged.uploadStatus, 'acknowledged');
    assert.equal(acknowledged.attemptCount, 2);
    assert.equal((await store.listPending(10)).length, 0);
});
