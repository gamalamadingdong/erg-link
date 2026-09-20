import type {
    AdditionalEndWorkoutSummaryData,
    EndWorkoutSummaryData,
    SplitIntervalData,
    StrokeData,
} from './types.js';

export type CaptureStatus = 'recording' | 'completed' | 'aborted' | 'incomplete_capture';

export interface CaptureNotificationEvidence {
    characteristic: string;
    receivedAt: string;
    bytes: number[];
}

export interface RawCaptureNotification extends CaptureNotificationEvidence {
    sequence: number;
}

export interface NormalizedStroke {
    strokeCount: number;
    elapsedSeconds: number;
    cumulativeDistanceMeters: number;
    driveLengthMeters: number;
    driveTimeSeconds: number;
    recoveryTimeSeconds: number;
    strokeDistanceMeters: number;
    peakDriveForcePounds: number;
    averageDriveForcePounds: number;
    workPerStrokeJoules: number;
}

export interface NormalizedSplit {
    intervalNumber: number;
    intervalType: number;
    elapsedSeconds: number;
    cumulativeDistanceMeters: number;
    workTimeSeconds: number;
    workDistanceMeters: number;
    restTimeSeconds: number;
    restDistanceMeters: number;
}

export interface CompletedCaptureSummary {
    workDistanceMeters: number;
    workTimeSeconds: number;
    averagePaceSecondsPer500m: number;
    averageStrokeRate: number;
    averageWatts: number;
    totalCalories: number;
    restDistanceMeters: number;
    restTimeSeconds: number;
    strokeCount: number;
}

export interface PM5CompletedCaptureV1 {
    _v: 1;
    captureId: string;
    captureVersion: 1;
    status: CaptureStatus;
    startedAt: string;
    completedAt?: string;
    timezone: string;
    rawNotifications: RawCaptureNotification[];
    strokes: NormalizedStroke[];
    splits: NormalizedSplit[];
    summary?: CompletedCaptureSummary;
    rawEndSummary?: EndWorkoutSummaryData;
    rawAdditionalEndSummary?: AdditionalEndWorkoutSummaryData;
}

export interface PM5CaptureAccumulatorOptions {
    captureId: string;
    startedAt: string;
    timezone: string;
}

function normalizedStroke(stroke: StrokeData): NormalizedStroke {
    return {
        strokeCount: stroke.strokeCount,
        elapsedSeconds: stroke.elapsedTime / 100,
        cumulativeDistanceMeters: stroke.distance / 10,
        driveLengthMeters: stroke.driveLength / 100,
        driveTimeSeconds: stroke.driveTime / 100,
        recoveryTimeSeconds: stroke.recoveryTime / 100,
        strokeDistanceMeters: stroke.strokeDistance / 100,
        peakDriveForcePounds: stroke.peakDriveForce / 10,
        averageDriveForcePounds: stroke.averageDriveForce / 10,
        workPerStrokeJoules: stroke.workPerStroke / 10,
    };
}

function normalizedSplit(split: SplitIntervalData): NormalizedSplit {
    return {
        intervalNumber: split.intervalNumber,
        intervalType: split.intervalType,
        elapsedSeconds: split.elapsedTime / 100,
        cumulativeDistanceMeters: split.distance / 10,
        workTimeSeconds: split.intervalTime / 10,
        workDistanceMeters: split.intervalDistance,
        restTimeSeconds: split.restTime,
        restDistanceMeters: split.restDistance,
    };
}

export class PM5CaptureAccumulator {
    private readonly captureId: string;
    private readonly startedAt: string;
    private readonly timezone: string;
    private status: CaptureStatus = 'recording';
    private completedAt: string | undefined;
    private readonly rawNotifications: RawCaptureNotification[] = [];
    private readonly strokes = new Map<number, NormalizedStroke>();
    private readonly splits = new Map<number, NormalizedSplit>();
    private endSummary: EndWorkoutSummaryData | undefined;
    private additionalEndSummary: AdditionalEndWorkoutSummaryData | undefined;

    constructor(options: PM5CaptureAccumulatorOptions) {
        if (!options.captureId || Number.isNaN(new Date(options.startedAt).getTime()) || !options.timezone) {
            throw new Error('PM5 capture identity is incomplete');
        }
        this.captureId = options.captureId;
        this.startedAt = options.startedAt;
        this.timezone = options.timezone;
    }

    private preserve(evidence: CaptureNotificationEvidence): void {
        this.rawNotifications.push({
            sequence: this.rawNotifications.length,
            characteristic: evidence.characteristic,
            receivedAt: evidence.receivedAt,
            bytes: [...evidence.bytes],
        });
    }

    private requireRecording(): void {
        if (this.status !== 'recording') throw new Error('PM5 capture is already terminal');
    }

    ingestStroke(stroke: StrokeData, evidence: CaptureNotificationEvidence): void {
        this.requireRecording();
        this.preserve(evidence);
        if (stroke.strokeCount === 0) return;
        this.strokes.set(stroke.strokeCount, normalizedStroke(stroke));
    }

    ingestSplit(split: SplitIntervalData, evidence: CaptureNotificationEvidence): void {
        this.requireRecording();
        this.preserve(evidence);
        this.splits.set(split.intervalNumber, normalizedSplit(split));
    }

    ingestEndSummary(summary: EndWorkoutSummaryData, evidence: CaptureNotificationEvidence): void {
        if (this.status !== 'recording' && this.status !== 'completed') this.requireRecording();
        this.preserve(evidence);
        this.endSummary = { ...summary };
        this.completeFromSummaries();
    }

    ingestAdditionalEndSummary(summary: AdditionalEndWorkoutSummaryData, evidence: CaptureNotificationEvidence): void {
        if (this.status !== 'recording' && this.status !== 'completed') this.requireRecording();
        this.preserve(evidence);
        this.additionalEndSummary = { ...summary };
        this.completeFromSummaries();
    }

    finish(status: Exclude<CaptureStatus, 'recording' | 'completed'>, completedAt: string): void {
        this.requireRecording();
        if (Number.isNaN(new Date(completedAt).getTime())) throw new Error('PM5 capture completion time is invalid');
        this.status = status;
        this.completedAt = completedAt;
    }

    private completeFromSummaries(): void {
        if (!this.endSummary || !this.additionalEndSummary) return;
        this.status = 'completed';
        this.completedAt = new Date(
            new Date(this.startedAt).getTime() + this.endSummary.elapsedTime * 10,
        ).toISOString();
    }

    snapshot(): PM5CompletedCaptureV1 {
        const strokeValues = [...this.strokes.values()].sort((left, right) => left.strokeCount - right.strokeCount);
        const splitValues = [...this.splits.values()].sort((left, right) => left.intervalNumber - right.intervalNumber);
        const summary = this.endSummary && this.additionalEndSummary ? {
            workDistanceMeters: this.endSummary.distance / 10,
            workTimeSeconds: this.endSummary.elapsedTime / 100,
            averagePaceSecondsPer500m: this.endSummary.averagePace / 10,
            averageStrokeRate: this.endSummary.averageStrokeRate,
            averageWatts: this.additionalEndSummary.watts,
            totalCalories: this.additionalEndSummary.totalCalories,
            restDistanceMeters: this.additionalEndSummary.totalRestDistance,
            restTimeSeconds: this.additionalEndSummary.restTime,
            strokeCount: strokeValues.at(-1)?.strokeCount ?? 0,
        } : undefined;

        return {
            _v: 1,
            captureId: this.captureId,
            captureVersion: 1,
            status: this.status,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            timezone: this.timezone,
            rawNotifications: this.rawNotifications.map((entry) => ({ ...entry, bytes: [...entry.bytes] })),
            strokes: strokeValues.map((entry) => ({ ...entry })),
            splits: splitValues.map((entry) => ({ ...entry })),
            summary,
            rawEndSummary: this.endSummary ? { ...this.endSummary } : undefined,
            rawAdditionalEndSummary: this.additionalEndSummary ? { ...this.additionalEndSummary } : undefined,
        };
    }
}
