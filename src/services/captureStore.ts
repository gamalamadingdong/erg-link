import type { PM5CompletedCaptureV1 } from '../lib/pm5-protocol/capture';

export type CaptureUploadStatus = 'held' | 'pending' | 'uploading' | 'failed' | 'acknowledged';

export interface StoredCapture {
    capture: PM5CompletedCaptureV1;
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
    save(capture: PM5CompletedCaptureV1, savedAt: string): Promise<StoredCapture>;
    get(captureId: string): Promise<StoredCapture | undefined>;
    listPending(limit: number): Promise<StoredCapture[]>;
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

export function createStoredCapture(capture: PM5CompletedCaptureV1, savedAt: string): StoredCapture {
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
    capture: PM5CompletedCaptureV1,
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

export class MemoryCaptureStore implements CaptureStore {
    private readonly records = new Map<string, StoredCapture>();

    async save(capture: PM5CompletedCaptureV1, savedAt: string): Promise<StoredCapture> {
        const record = updateStoredCapture(this.records.get(capture.captureId), capture, savedAt);
        this.records.set(capture.captureId, clone(record));
        return clone(record);
    }

    async get(captureId: string): Promise<StoredCapture | undefined> {
        const record = this.records.get(captureId);
        return record ? clone(record) : undefined;
    }

    async listPending(limit: number): Promise<StoredCapture[]> {
        return [...this.records.values()]
            .filter((record) => record.uploadStatus === 'pending' || record.uploadStatus === 'failed')
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
            .slice(0, Math.max(0, limit))
            .map(clone);
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
