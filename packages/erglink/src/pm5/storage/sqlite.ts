import type { SQLiteDBConnection } from '@capacitor-community/sqlite';

import type { PM5CompletedCaptureV1 } from '../protocol/capture.js';
import {
    acknowledgeStoredCapture,
    beginStoredCaptureUpload,
    failStoredCaptureUpload,
    type CaptureAcknowledgement,
    type CaptureStore,
    type StoredCapture,
    updateStoredCapture,
} from './captureStore.js';

const DATABASE_NAME = 'erglink-captures';
const DATABASE_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pm5_captures (
    capture_id TEXT PRIMARY KEY NOT NULL,
    upload_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    record_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pm5_captures_upload_created
    ON pm5_captures(upload_status, created_at);
`;

type CaptureRow = { record_json?: unknown };

export interface CaptureSQLiteDatabase {
    query(statement: string, values?: unknown[]): Promise<{ values?: unknown[] }>;
    run(statement: string, values?: unknown[]): Promise<unknown>;
}

function parseRecord(row: CaptureRow | undefined): StoredCapture | undefined {
    if (typeof row?.record_json !== 'string') return undefined;
    return JSON.parse(row.record_json) as StoredCapture;
}

export class MobileSQLiteCaptureStore implements CaptureStore {
    private dbPromise: Promise<CaptureSQLiteDatabase> | undefined;
    private readonly dbProvider: () => Promise<CaptureSQLiteDatabase>;

    constructor(dbProvider?: () => Promise<CaptureSQLiteDatabase>) {
        this.dbProvider = dbProvider ?? (() => this.openDb());
    }

    async save(capture: PM5CompletedCaptureV1, savedAt: string): Promise<StoredCapture> {
        const existing = await this.get(capture.captureId);
        const record = updateStoredCapture(existing, capture, savedAt);
        await this.put(record);
        return structuredClone(record);
    }

    async get(captureId: string): Promise<StoredCapture | undefined> {
        const db = await this.getDb();
        const result = await db.query(
            'SELECT record_json FROM pm5_captures WHERE capture_id = ? LIMIT 1',
            [captureId],
        );
        const rows = (result.values ?? []) as CaptureRow[];
        const record = parseRecord(rows[0]);
        return record ? structuredClone(record) : undefined;
    }

    async listPending(limit: number): Promise<StoredCapture[]> {
        const db = await this.getDb();
        const result = await db.query(
            `SELECT record_json FROM pm5_captures
             WHERE upload_status IN ('pending', 'failed')
             ORDER BY created_at ASC
             LIMIT ?`,
            [Math.max(0, limit)],
        );
        return ((result.values ?? []) as CaptureRow[])
            .map(parseRecord)
            .filter((record): record is StoredCapture => !!record)
            .map((record) => structuredClone(record));
    }

    async beginUpload(captureId: string, attemptedAt: string): Promise<StoredCapture> {
        return this.update(captureId, (record) => beginStoredCaptureUpload(record, attemptedAt));
    }

    async failUpload(captureId: string, error: string, failedAt: string): Promise<StoredCapture> {
        return this.update(captureId, (record) => failStoredCaptureUpload(record, error, failedAt));
    }

    async acknowledge(captureId: string, acknowledgement: CaptureAcknowledgement): Promise<StoredCapture> {
        return this.update(captureId, (record) => acknowledgeStoredCapture(record, acknowledgement));
    }

    private async update(
        captureId: string,
        mutate: (record: StoredCapture) => StoredCapture,
    ): Promise<StoredCapture> {
        const existing = await this.get(captureId);
        if (!existing) throw new Error('PM5 capture was not found');
        const record = mutate(existing);
        await this.put(record);
        return structuredClone(record);
    }

    private async put(record: StoredCapture): Promise<void> {
        const db = await this.getDb();
        await db.run(
            `INSERT INTO pm5_captures (
                capture_id, upload_status, created_at, updated_at, record_json
             ) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(capture_id) DO UPDATE SET
                upload_status = excluded.upload_status,
                updated_at = excluded.updated_at,
                record_json = excluded.record_json`,
            [
                record.capture.captureId,
                record.uploadStatus,
                record.createdAt,
                record.updatedAt,
                JSON.stringify(record),
            ],
        );
    }

    private getDb(): Promise<CaptureSQLiteDatabase> {
        this.dbPromise ??= this.dbProvider();
        return this.dbPromise;
    }

    private async openDb(): Promise<SQLiteDBConnection> {
        const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
        const sqlite = new SQLiteConnection(CapacitorSQLite);
        const existing = await sqlite.isConnection(DATABASE_NAME, false);
        const db = existing.result
            ? await sqlite.retrieveConnection(DATABASE_NAME, false)
            : await sqlite.createConnection(
                DATABASE_NAME,
                false,
                'no-encryption',
                DATABASE_VERSION,
                false,
            );
        await db.open();
        await db.execute(SCHEMA);
        return db;
    }
}

export const mobileSQLiteCaptureStore = new MobileSQLiteCaptureStore();
