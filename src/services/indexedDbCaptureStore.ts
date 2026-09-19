import type { PM5CompletedCaptureV1 } from '../lib/pm5-protocol/capture';
import {
    acknowledgeStoredCapture,
    beginStoredCaptureUpload,
    failStoredCaptureUpload,
    type CaptureAcknowledgement,
    type CaptureStore,
    type StoredCapture,
    updateStoredCapture,
} from './captureStore';
import { getErgLinkDB } from './ergLinkDb';

export class IndexedDBCaptureStore implements CaptureStore {
    async save(capture: PM5CompletedCaptureV1, savedAt: string): Promise<StoredCapture> {
        const db = await getErgLinkDB();
        const tx = db.transaction('captures', 'readwrite');
        const existing = await tx.store.get(capture.captureId);
        const record = updateStoredCapture(existing, capture, savedAt);
        await tx.store.put(record);
        await tx.done;
        return structuredClone(record);
    }

    async get(captureId: string): Promise<StoredCapture | undefined> {
        const record = await (await getErgLinkDB()).get('captures', captureId);
        return record ? structuredClone(record) : undefined;
    }

    async listPending(limit: number): Promise<StoredCapture[]> {
        const db = await getErgLinkDB();
        const pending = await db.getAllFromIndex('captures', 'by-upload-status', 'pending');
        const failed = await db.getAllFromIndex('captures', 'by-upload-status', 'failed');
        return [...pending, ...failed]
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
            .slice(0, Math.max(0, limit))
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
        const db = await getErgLinkDB();
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
