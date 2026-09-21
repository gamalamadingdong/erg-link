import type { PM5CompletedCaptureV1 } from '../protocol/capture.js';
import {
    MobileSQLiteCaptureStore,
    type CaptureSQLiteDatabase,
} from './sqlite.js';

class FakeSQLiteDatabase implements CaptureSQLiteDatabase {
    private readonly records = new Map<string, string>();

    async query(statement: string, values: unknown[] = []): Promise<{ values?: unknown[] }> {
        if (statement.includes('WHERE capture_id')) {
            const json = this.records.get(String(values[0]));
            return { values: json ? [{ record_json: json }] : [] };
        }
        const uploadingOnly = statement.includes("upload_status = 'uploading'");
        const rows = [...this.records.values()]
            .map((json) => ({ json, record: JSON.parse(json) as { uploadStatus: string; createdAt: string } }))
            .filter(({ record }) => uploadingOnly
                ? record.uploadStatus === 'uploading'
                : record.uploadStatus === 'pending' || record.uploadStatus === 'failed')
            .sort((a, b) => a.record.createdAt.localeCompare(b.record.createdAt));
        const offset = Number(values[1] ?? 0);
        const limited = uploadingOnly ? rows : rows.slice(offset, offset + Number(values[0]));
        return { values: limited.map(({ json }) => ({ record_json: json })) };
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

const database = new FakeSQLiteDatabase();
const store = new MobileSQLiteCaptureStore(async () => database);
await store.save(capture, '2026-09-19T12:01:00.000Z');
if ((await store.listPending(10)).length !== 1) throw new Error('Expected one pending capture');
if ((await store.beginUpload(capture.captureId, '2026-09-19T12:02:00.000Z')).attemptCount !== 1) {
    throw new Error('Expected first upload attempt');
}
await store.failUpload(capture.captureId, 'offline', '2026-09-19T12:03:00.000Z');
await store.beginUpload(capture.captureId, '2026-09-19T12:04:00.000Z');
if (await store.recoverStaleUploads('2026-09-19T12:05:00.000Z', '2026-09-19T12:05:01.000Z') !== 1) {
    throw new Error('Expected interrupted SQLite upload recovery');
}
await store.beginUpload(capture.captureId, '2026-09-19T12:06:00.000Z');
const acknowledged = await store.acknowledge(capture.captureId, {
    acknowledgedAt: '2026-09-19T12:07:00.000Z',
    upstreamWorkoutId: 'lc-workout-1',
});
if (acknowledged.uploadStatus !== 'acknowledged' || acknowledged.attemptCount !== 3) {
    throw new Error('Expected acknowledged capture after retry');
}

console.log('ok - package SQLite adapter follows the shared lifecycle');
