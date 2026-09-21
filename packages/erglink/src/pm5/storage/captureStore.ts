import type { PM5CompletedCapture } from '../protocol/capture.js';

export type CaptureUploadStatus = 'held' | 'pending' | 'uploading' | 'failed' | 'acknowledged';

export interface StoredCapture {
    capture: PM5CompletedCapture;
    uploadStatus: CaptureUploadStatus;
    attemptCount: number;
    createdAt: string;
    updatedAt: string;
    lastAttemptAt?: string;
    lastError?: string;
    acknowledgedAt?: string;
    upstreamWorkoutId?: string;
}

export interface CaptureAcknowledgement {
    acknowledgedAt: string;
    upstreamWorkoutId: string;
}

export interface CaptureStore {
    save(capture: PM5CompletedCapture, savedAt: string): Promise<StoredCapture>;
    get(captureId: string): Promise<StoredCapture | undefined>;
    listPending(limit: number, offset?: number): Promise<StoredCapture[]>;
    recoverStaleUploads(staleBefore: string, recoveredAt: string): Promise<number>;
    enrichAcknowledged(capture: PM5CompletedCapture, enrichedAt: string): Promise<StoredCapture>;
    beginUpload(captureId: string, attemptedAt: string): Promise<StoredCapture>;
    failUpload(captureId: string, error: string, failedAt: string): Promise<StoredCapture>;
    acknowledge(captureId: string, acknowledgement: CaptureAcknowledgement): Promise<StoredCapture>;
}

function validateInstant(value: string): void {
    if (Number.isNaN(new Date(value).getTime())) throw new Error('Capture store timestamp is invalid');
}

function clone(record: StoredCapture): StoredCapture {
    return structuredClone(record);
}

export function createStoredCapture(capture: PM5CompletedCapture, savedAt: string): StoredCapture {
    validateInstant(savedAt);
    return {
        capture: structuredClone(capture),
        uploadStatus: capture.status === 'completed' ? 'pending' : 'held',
        attemptCount: 0,
        createdAt: savedAt,
        updatedAt: savedAt,
    };
}

export function updateStoredCapture(
    existing: StoredCapture | undefined,
    capture: PM5CompletedCapture,
    savedAt: string,
): StoredCapture {
    if (!existing) return createStoredCapture(capture, savedAt);
    if (existing.uploadStatus === 'acknowledged') throw new Error('Acknowledged PM5 capture is immutable');
    validateInstant(savedAt);
    return {
        ...existing,
        capture: structuredClone(capture),
        uploadStatus: existing.uploadStatus === 'held' && capture.status === 'completed'
            ? 'pending'
            : existing.uploadStatus,
        updatedAt: savedAt,
    };
}

export function beginStoredCaptureUpload(record: StoredCapture, attemptedAt: string): StoredCapture {
    if (record.uploadStatus !== 'pending' && record.uploadStatus !== 'failed') {
        throw new Error('PM5 capture is not ready for upload');
    }
    validateInstant(attemptedAt);
    return {
        ...record,
        uploadStatus: 'uploading',
        attemptCount: record.attemptCount + 1,
        lastAttemptAt: attemptedAt,
        lastError: undefined,
        updatedAt: attemptedAt,
    };
}

export function failStoredCaptureUpload(record: StoredCapture, error: string, failedAt: string): StoredCapture {
    if (record.uploadStatus !== 'uploading') throw new Error('PM5 capture upload is not in progress');
    if (!error.trim()) throw new Error('PM5 capture upload error is required');
    validateInstant(failedAt);
    return {
        ...record,
        uploadStatus: 'failed',
        lastError: error,
        updatedAt: failedAt,
    };
}

export function recoverStoredCaptureUpload(
    record: StoredCapture,
    staleBefore: string,
    recoveredAt: string,
): StoredCapture | undefined {
    validateInstant(staleBefore);
    validateInstant(recoveredAt);
    if (record.uploadStatus !== 'uploading') return undefined;
    if (record.lastAttemptAt
        && new Date(record.lastAttemptAt).getTime() >= new Date(staleBefore).getTime()) return undefined;
    return failStoredCaptureUpload(record, 'Recovered interrupted PM5 capture upload', recoveredAt);
}

export function acknowledgeStoredCapture(
    record: StoredCapture,
    acknowledgement: CaptureAcknowledgement,
): StoredCapture {
    if (record.uploadStatus !== 'uploading') throw new Error('PM5 capture upload is not in progress');
    if (!acknowledgement.upstreamWorkoutId.trim()) throw new Error('Upstream workout ID is required');
    validateInstant(acknowledgement.acknowledgedAt);
    return {
        ...record,
        uploadStatus: 'acknowledged',
        acknowledgedAt: acknowledgement.acknowledgedAt,
        upstreamWorkoutId: acknowledgement.upstreamWorkoutId,
        lastError: undefined,
        updatedAt: acknowledgement.acknowledgedAt,
    };
}

export function enrichAcknowledgedStoredCapture(
    existing: StoredCapture,
    capture: PM5CompletedCapture,
    enrichedAt: string,
): StoredCapture {
    if (existing.uploadStatus !== 'acknowledged') throw new Error('PM5 capture is not acknowledged');
    if (capture.captureId !== existing.capture.captureId
        || capture.captureVersion !== existing.capture.captureVersion
        || capture.status !== 'completed') {
        throw new Error('Acknowledged PM5 capture identity is immutable');
    }
    if (capture.rawNotifications.length < existing.capture.rawNotifications.length) {
        throw new Error('Acknowledged PM5 capture evidence cannot be removed');
    }
    for (let index = 0; index < existing.capture.rawNotifications.length; index += 1) {
        if (JSON.stringify(capture.rawNotifications[index])
            !== JSON.stringify(existing.capture.rawNotifications[index])) {
            throw new Error('Acknowledged PM5 capture evidence must be append-only');
        }
    }
    validateInstant(enrichedAt);
    return {
        ...existing,
        capture: structuredClone(capture),
        updatedAt: enrichedAt,
    };
}

export class MemoryCaptureStore implements CaptureStore {
    private readonly records = new Map<string, StoredCapture>();

    async save(capture: PM5CompletedCapture, savedAt: string): Promise<StoredCapture> {
        const record = updateStoredCapture(this.records.get(capture.captureId), capture, savedAt);
        this.records.set(capture.captureId, clone(record));
        return clone(record);
    }

    async get(captureId: string): Promise<StoredCapture | undefined> {
        const record = this.records.get(captureId);
        return record ? clone(record) : undefined;
    }

    async listPending(limit: number, offset = 0): Promise<StoredCapture[]> {
        return [...this.records.values()]
            .filter((record) => record.uploadStatus === 'pending' || record.uploadStatus === 'failed')
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
            .slice(Math.max(0, offset), Math.max(0, offset) + Math.max(0, limit))
            .map(clone);
    }

    async recoverStaleUploads(staleBefore: string, recoveredAt: string): Promise<number> {
        let recovered = 0;
        for (const [captureId, existing] of this.records) {
            const record = recoverStoredCaptureUpload(existing, staleBefore, recoveredAt);
            if (!record) continue;
            this.records.set(captureId, clone(record));
            recovered += 1;
        }
        return recovered;
    }

    async enrichAcknowledged(capture: PM5CompletedCapture, enrichedAt: string): Promise<StoredCapture> {
        const existing = this.records.get(capture.captureId);
        if (!existing) throw new Error('PM5 capture was not found');
        const record = enrichAcknowledgedStoredCapture(existing, capture, enrichedAt);
        this.records.set(capture.captureId, clone(record));
        return clone(record);
    }

    async beginUpload(captureId: string, attemptedAt: string): Promise<StoredCapture> {
        const existing = this.records.get(captureId);
        if (!existing) throw new Error('PM5 capture was not found');
        const record = beginStoredCaptureUpload(existing, attemptedAt);
        this.records.set(captureId, clone(record));
        return clone(record);
    }

    async failUpload(captureId: string, error: string, failedAt: string): Promise<StoredCapture> {
        const existing = this.records.get(captureId);
        if (!existing) throw new Error('PM5 capture was not found');
        const record = failStoredCaptureUpload(existing, error, failedAt);
        this.records.set(captureId, clone(record));
        return clone(record);
    }

    async acknowledge(captureId: string, acknowledgement: CaptureAcknowledgement): Promise<StoredCapture> {
        const existing = this.records.get(captureId);
        if (!existing) throw new Error('PM5 capture was not found');
        const record = acknowledgeStoredCapture(existing, acknowledgement);
        this.records.set(captureId, clone(record));
        return clone(record);
    }
}
