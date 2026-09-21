import type {
    AdditionalEndWorkoutSummaryData,
    AdditionalSplitIntervalData,
    AdditionalStatus1Data,
    AdditionalStatus2Data,
    AdditionalStatus3Data,
    AdditionalStrokeData,
    EndWorkoutAdditionalSummary2Data,
    EndWorkoutSummaryData,
    GeneralStatusData,
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

export interface NormalizedStrokeV2 extends NormalizedStroke {
    intervalNumber: number;
    intervalElapsedSeconds: number;
    intervalDistanceMeters: number;
    paceSecondsPer500m?: number;
    strokeRate?: number;
    heartRate?: number;
    powerWatts?: number;
    caloriesPerHour?: number;
    projectedWorkTimeSeconds?: number;
    projectedWorkDistanceMeters?: number;
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

export interface NormalizedSplitV2 extends NormalizedSplit {
    averageStrokeRate?: number;
    workHeartRate?: number;
    restHeartRate?: number;
    averagePaceSecondsPer500m?: number;
    totalCalories?: number;
    averageCaloriesPerHour?: number;
    speedMetersPerSecond?: number;
    powerWatts?: number;
    averageDragFactor?: number;
    ergMachineType?: number;
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

interface PM5CompletedCaptureBase {
    captureId: string;
    status: CaptureStatus;
    startedAt: string;
    completedAt?: string;
    timezone: string;
    rawNotifications: RawCaptureNotification[];
    summary?: CompletedCaptureSummary;
    rawEndSummary?: EndWorkoutSummaryData;
    rawAdditionalEndSummary?: AdditionalEndWorkoutSummaryData;
}

export interface PM5CompletedCaptureV1 extends PM5CompletedCaptureBase {
    _v: 1;
    captureVersion: 1;
    strokes: NormalizedStroke[];
    splits: NormalizedSplit[];
}

export interface PM5CompletedCaptureV2 extends PM5CompletedCaptureBase {
    _v: 2;
    captureVersion: 2;
    strokes: NormalizedStrokeV2[];
    splits: NormalizedSplitV2[];
    verification?: {
        workoutVerified: boolean;
        verificationValue: number;
        gameIdentifier: number;
        evidence: CaptureNotificationEvidence;
    };
    ergMachineType?: number;
    pmLogTimestamp?: {
        dateValue: number;
        timeValue: number;
    };
    rawAdditionalEndSummary2?: EndWorkoutAdditionalSummary2Data;
    latestAdditionalStatus3?: AdditionalStatus3Data;
    startState?: {
        status: GeneralStatusData;
        evidence: CaptureNotificationEvidence;
    };
}

export type PM5CompletedCapture = PM5CompletedCaptureV1 | PM5CompletedCaptureV2;

export interface PM5CaptureAccumulatorOptions {
    captureId: string;
    startedAt: string;
    timezone: string;
    statusAlignmentToleranceCentiseconds?: number;
}

interface TimedStatus1 {
    data: AdditionalStatus1Data;
}

interface TimedStatus2 {
    data: AdditionalStatus2Data;
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

function nearest<T>(values: T[], elapsedTime: number, getTime: (value: T) => number, tolerance: number): T | undefined {
    let best: T | undefined;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const value of values) {
        const delta = Math.abs(getTime(value) - elapsedTime);
        if (delta <= tolerance && delta < bestDelta) {
            best = value;
            bestDelta = delta;
        }
    }
    return best;
}

function present(value: number, invalid: number[] = [0]): number | undefined {
    return invalid.includes(value) ? undefined : value;
}

function scaled(value: number, divisor: number, invalid: number[] = [0]): number | undefined {
    const available = present(value, invalid);
    return available === undefined ? undefined : available / divisor;
}

export class PM5CaptureAccumulator {
    private readonly captureId: string;
    private readonly startedAt: string;
    private readonly timezone: string;
    private readonly alignmentTolerance: number;
    private status: CaptureStatus = 'recording';
    private completedAt: string | undefined;
    private readonly rawNotifications: RawCaptureNotification[] = [];
    private readonly strokes = new Map<number, { raw: StrokeData; normalized: NormalizedStroke }>();
    private readonly additionalStrokes = new Map<number, AdditionalStrokeData>();
    private readonly splits = new Map<number, NormalizedSplit>();
    private readonly additionalSplits = new Map<number, AdditionalSplitIntervalData>();
    private readonly status1: TimedStatus1[] = [];
    private readonly status2: TimedStatus2[] = [];
    private endSummary: EndWorkoutSummaryData | undefined;
    private additionalEndSummary: AdditionalEndWorkoutSummaryData | undefined;
    private additionalEndSummary2: EndWorkoutAdditionalSummary2Data | undefined;
    private additionalEndSummary2Evidence: CaptureNotificationEvidence | undefined;
    private latestAdditionalStatus3: AdditionalStatus3Data | undefined;
    private startState: PM5CompletedCaptureV2['startState'];

    constructor(options: PM5CaptureAccumulatorOptions) {
        if (!options.captureId || Number.isNaN(new Date(options.startedAt).getTime()) || !options.timezone) {
            throw new Error('PM5 capture identity is incomplete');
        }
        this.captureId = options.captureId;
        this.startedAt = options.startedAt;
        this.timezone = options.timezone;
        this.alignmentTolerance = options.statusAlignmentToleranceCentiseconds ?? 100;
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

    private requireCollecting(): void {
        if (this.status !== 'recording' && this.status !== 'completed') {
            throw new Error('PM5 capture is already terminal');
        }
    }

    ingestGeneralStatus(status: GeneralStatusData, evidence: CaptureNotificationEvidence): void {
        this.requireRecording();
        this.preserve(evidence);
        this.startState ??= {
            status: { ...status },
            evidence: { ...evidence, bytes: [...evidence.bytes] },
        };
    }

    ingestStatus1(status: AdditionalStatus1Data, evidence: CaptureNotificationEvidence): void {
        this.requireRecording();
        this.preserve(evidence);
        this.status1.push({ data: { ...status } });
    }

    ingestStatus2(status: AdditionalStatus2Data, evidence: CaptureNotificationEvidence): void {
        this.requireRecording();
        this.preserve(evidence);
        this.status2.push({ data: { ...status } });
    }

    ingestStroke(stroke: StrokeData, evidence: CaptureNotificationEvidence): void {
        this.requireCollecting();
        this.preserve(evidence);
        if (stroke.strokeCount === 0) return;
        this.strokes.set(stroke.strokeCount, { raw: { ...stroke }, normalized: normalizedStroke(stroke) });
    }

    ingestAdditionalStroke(stroke: AdditionalStrokeData, evidence: CaptureNotificationEvidence): void {
        this.requireCollecting();
        this.preserve(evidence);
        if (stroke.strokeCount !== 0) this.additionalStrokes.set(stroke.strokeCount, { ...stroke });
    }

    ingestSplit(split: SplitIntervalData, evidence: CaptureNotificationEvidence): void {
        this.requireCollecting();
        this.preserve(evidence);
        this.splits.set(split.intervalNumber, normalizedSplit(split));
    }

    ingestAdditionalSplit(split: AdditionalSplitIntervalData, evidence: CaptureNotificationEvidence): void {
        this.requireCollecting();
        this.preserve(evidence);
        this.additionalSplits.set(split.intervalNumber, { ...split });
    }

    ingestAdditionalStatus3(status: AdditionalStatus3Data, evidence: CaptureNotificationEvidence): void {
        this.requireCollecting();
        this.preserve(evidence);
        this.latestAdditionalStatus3 = { ...status };
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

    ingestAdditionalEndSummary2(summary: EndWorkoutAdditionalSummary2Data, evidence: CaptureNotificationEvidence): void {
        if (this.status !== 'recording' && this.status !== 'completed') this.requireRecording();
        this.preserve(evidence);
        this.additionalEndSummary2 = { ...summary };
        this.additionalEndSummary2Evidence = { ...evidence, bytes: [...evidence.bytes] };
        this.completeFromSummaries();
    }

    finish(status: Exclude<CaptureStatus, 'recording' | 'completed'>, completedAt: string): void {
        this.requireRecording();
        if (Number.isNaN(new Date(completedAt).getTime())) throw new Error('PM5 capture completion time is invalid');
        this.status = status;
        this.completedAt = completedAt;
    }

    private completeFromSummaries(): void {
        if (!this.endSummary || !this.additionalEndSummary || !this.additionalEndSummary2) return;
        this.status = 'completed';
        this.completedAt = new Date(new Date(this.startedAt).getTime() + this.endSummary.elapsedTime * 10).toISOString();
    }

    private intervalForStroke(raw: StrokeData): number {
        const status = nearest(this.status2, raw.elapsedTime, (entry) => entry.data.elapsedTime, this.alignmentTolerance);
        if (status && status.data.intervalCount > 0) return status.data.intervalCount;
        const split = [...this.splits.values()].sort((a, b) => a.intervalNumber - b.intervalNumber)
            .find((entry) => raw.elapsedTime <= entry.elapsedSeconds * 100);
        return split?.intervalNumber ?? 1;
    }

    private normalizedStrokeV2(raw: StrokeData, normalized: NormalizedStroke): NormalizedStrokeV2 {
        const intervalNumber = this.intervalForStroke(raw);
        const prior = [...this.splits.values()]
            .filter((entry) => entry.intervalNumber < intervalNumber)
            .sort((a, b) => b.intervalNumber - a.intervalNumber)[0];
        const status = nearest(this.status1, raw.elapsedTime, (entry) => entry.data.elapsedTime, this.alignmentTolerance)?.data;
        const additional = this.additionalStrokes.get(raw.strokeCount);
        return {
            ...normalized,
            intervalNumber,
            intervalElapsedSeconds: Math.max(0, normalized.elapsedSeconds - (prior?.elapsedSeconds ?? 0)),
            intervalDistanceMeters: Math.max(0, normalized.cumulativeDistanceMeters - (prior?.cumulativeDistanceMeters ?? 0)),
            paceSecondsPer500m: status ? scaled(status.currentPace, 100) : undefined,
            strokeRate: status ? present(status.strokeRate) : undefined,
            heartRate: status ? present(status.heartRate, [0, 255]) : undefined,
            powerWatts: additional ? present(additional.strokePower) : undefined,
            caloriesPerHour: additional ? present(additional.strokeCalories) : undefined,
            projectedWorkTimeSeconds: additional ? present(additional.projectedWorkTime) : undefined,
            projectedWorkDistanceMeters: additional ? present(additional.projectedWorkDistance) : undefined,
        };
    }

    snapshot(): PM5CompletedCaptureV2 {
        const strokeValues = [...this.strokes.values()]
            .sort((left, right) => left.normalized.strokeCount - right.normalized.strokeCount)
            .map(({ raw, normalized }) => this.normalizedStrokeV2(raw, normalized));
        const splitValues: NormalizedSplitV2[] = [...this.splits.values()]
            .sort((left, right) => left.intervalNumber - right.intervalNumber)
            .map((split) => {
                const extra = this.additionalSplits.get(split.intervalNumber);
                return {
                    ...split,
                    averageStrokeRate: extra ? present(extra.averageStrokeRate) : undefined,
                    workHeartRate: extra ? present(extra.workHeartRate, [0, 255]) : undefined,
                    restHeartRate: extra ? present(extra.restHeartRate, [0, 255]) : undefined,
                    averagePaceSecondsPer500m: extra ? scaled(extra.averagePace, 10) : undefined,
                    totalCalories: extra ? present(extra.totalCalories) : undefined,
                    averageCaloriesPerHour: extra ? present(extra.averageCalories) : undefined,
                    speedMetersPerSecond: extra ? scaled(extra.speed, 1000) : undefined,
                    powerWatts: extra ? present(extra.power) : undefined,
                    averageDragFactor: extra ? present(extra.averageDragFactor) : undefined,
                    ergMachineType: extra?.ergMachineType,
                };
            });
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
        const end2 = this.additionalEndSummary2;
        const end2Evidence = this.additionalEndSummary2Evidence;
        const logTimestamp = end2 ?? this.endSummary;

        return {
            _v: 2,
            captureId: this.captureId,
            captureVersion: 2,
            status: this.status,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            timezone: this.timezone,
            rawNotifications: this.rawNotifications.map((entry) => ({ ...entry, bytes: [...entry.bytes] })),
            strokes: strokeValues,
            splits: splitValues,
            summary,
            rawEndSummary: this.endSummary ? { ...this.endSummary } : undefined,
            rawAdditionalEndSummary: this.additionalEndSummary ? { ...this.additionalEndSummary } : undefined,
            rawAdditionalEndSummary2: end2 ? { ...end2 } : undefined,
            verification: end2 && end2Evidence ? {
                workoutVerified: end2.workoutVerified,
                verificationValue: end2.verificationValue,
                gameIdentifier: end2.gameIdentifier,
                evidence: { ...end2Evidence, bytes: [...end2Evidence.bytes] },
            } : undefined,
            ergMachineType: end2?.ergMachineType
                ?? splitValues.at(-1)?.ergMachineType
                ?? this.status1.at(-1)?.data.ergMachineType,
            pmLogTimestamp: logTimestamp
                ? { dateValue: logTimestamp.logDate, timeValue: logTimestamp.logTime }
                : undefined,
            latestAdditionalStatus3: this.latestAdditionalStatus3 ? { ...this.latestAdditionalStatus3 } : undefined,
            startState: this.startState ? {
                status: { ...this.startState.status },
                evidence: { ...this.startState.evidence, bytes: [...this.startState.evidence.bytes] },
            } : undefined,
        };
    }
}
