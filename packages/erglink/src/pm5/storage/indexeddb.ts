import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { PM5CompletedCapture } from '../protocol/capture.js';
import {
    acknowledgeStoredCapture,
    beginStoredCaptureUpload,
    failStoredCaptureUpload,
    recoverStoredCaptureUpload,
    enrichAcknowledgedStoredCapture,
    type CaptureAcknowledgement,
    type CaptureStore,
    type CaptureUploadStatus,
    type StoredCapture,
    updateStoredCapture,
} from './captureStore.js';

interface CaptureStorageDB extends DBSchema {
    captures: {
        key: string;
        value: StoredCapture;
        indexes: {
            'by-upload-status': CaptureUploadStatus;
            'by-created-at': string;
        };
    };
}

export interface IndexedDBCaptureStoreOptions {
    databaseName?: string;
    databaseVersion?: number;
    databaseProvider?: () => Promise<unknown>;
}

export class IndexedDBCaptureStore implements CaptureStore {
    private dbPromise: Promise<IDBPDatabase<CaptureStorageDB>> | undefined;
    private readonly databaseName: string;
    private readonly databaseVersion: number;
    private readonly databaseProvider?: () => Promise<unknown>;

    constructor(options: IndexedDBCaptureStoreOptions = {}) {
        this.databaseName = options.databaseName ?? 'erg-link-buffer';
        this.databaseVersion = options.databaseVersion ?? 2;
        this.databaseProvider = options.databaseProvider;
    }

    async save(capture: PM5CompletedCapture, savedAt: string): Promise<StoredCapture> {
        const db = await this.getDb();
        const tx = db.transaction('captures', 'readwrite');
        const existing = await tx.store.get(capture.captureId);
        const record = updateStoredCapture(existing, capture, savedAt);
        await tx.store.put(record);
        await tx.done;
        return structuredClone(record);
    }

    async get(captureId: string): Promise<StoredCapture | undefined> {
        const record = await (await this.getDb()).get('captures', captureId);
        return record ? structuredClone(record) : undefined;
    }

    async listPending(limit: number, offset = 0): Promise<StoredCapture[]> {
        const db = await this.getDb();
        const pending = await db.getAllFromIndex('captures', 'by-upload-status', 'pending');
        const failed = await db.getAllFromIndex('captures', 'by-upload-status', 'failed');
        return [...pending, ...failed]
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
            .slice(Math.max(0, offset), Math.max(0, offset) + Math.max(0, limit))
            .map((record) => structuredClone(record));
    }

    async recoverStaleUploads(staleBefore: string, recoveredAt: string): Promise<number> {
        const db = await this.getDb();
        const uploading = await db.getAllFromIndex('captures', 'by-upload-status', 'uploading');
        const recovered = uploading
            .map((record) => recoverStoredCaptureUpload(record, staleBefore, recoveredAt))
            .filter((record): record is StoredCapture => !!record);
        if (!recovered.length) return 0;
        const tx = db.transaction('captures', 'readwrite');
        for (const record of recovered) await tx.store.put(record);
        await tx.done;
        return recovered.length;
    }

    async enrichAcknowledged(capture: PM5CompletedCapture, enrichedAt: string): Promise<StoredCapture> {
        return this.update(capture.captureId, (record) => enrichAcknowledgedStoredCapture(record, capture, enrichedAt));
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

    private getDb(): Promise<IDBPDatabase<CaptureStorageDB>> {
        this.dbPromise ??= this.databaseProvider
            ? this.databaseProvider().then((database) => database as IDBPDatabase<CaptureStorageDB>)
            : openDB<CaptureStorageDB>(this.databaseName, this.databaseVersion, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains('captures')) {
                        const captures = db.createObjectStore('captures', { keyPath: 'capture.captureId' });
                        captures.createIndex('by-upload-status', 'uploadStatus');
                        captures.createIndex('by-created-at', 'createdAt');
                    }
                },
            });
        return this.dbPromise;
    }

    private async update(
        captureId: string,
        mutate: (record: StoredCapture) => StoredCapture,
    ): Promise<StoredCapture> {
        const db = await this.getDb();
        const tx = db.transaction('captures', 'readwrite');
        const existing = await tx.store.get(captureId);
        if (!existing) throw new Error('PM5 capture was not found');
        const record = mutate(existing);
        await tx.store.put(record);
        await tx.done;
        return structuredClone(record);
    }
}

export const indexedDBCaptureStore = new IndexedDBCaptureStore();
