import {
    PM5CaptureAccumulator,
    type CaptureNotificationEvidence,
    type PM5CompletedCapture,
} from './capture';
import type {
    AdditionalEndWorkoutSummaryData,
    EndWorkoutSummaryData,
    AdditionalStatus1Data,
    AdditionalStatus2Data,
    AdditionalStrokeData,
    EndWorkoutAdditionalSummary2Data,
    SplitIntervalData,
    StrokeData,
} from './types';

const assert = {
    equal(actual: unknown, expected: unknown): void {
        if (!Object.is(actual, expected)) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    },
    deepEqual(actual: unknown, expected: unknown): void {
        const actualJson = JSON.stringify(actual);
        const expectedJson = JSON.stringify(expected);
        if (actualJson !== expectedJson) throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
    },
};

function test(name: string, body: () => void): void {
    body();
    console.log(`ok - ${name}`);
}

function evidence(characteristic: string, sequence: number): CaptureNotificationEvidence {
    return {
        characteristic,
        receivedAt: `2026-09-19T14:30:${String(sequence).padStart(2, '0')}.000Z`,
        bytes: [sequence & 0xff, (sequence >> 8) & 0xff],
    };
}

function stroke(strokeCount: number, pass: number): StrokeData {
    return {
        elapsedTime: strokeCount * 250,
        distance: strokeCount * 90,
        driveLength: 127,
        driveTime: 85,
        recoveryTime: 202,
        strokeDistance: 1140,
        peakDriveForce: 1219,
        averageDriveForce: 922,
        workPerStroke: 4400 + pass,
        strokeCount,
    };
}

const split: SplitIntervalData = {
    elapsedTime: 2886,
    distance: 1000,
    intervalTime: 289,
    intervalDistance: 100,
    restTime: 0,
    restDistance: 0,
    intervalType: 1,
    intervalNumber: 1,
};

const summary: EndWorkoutSummaryData = {
    logDate: 13625,
    logTime: 2845,
    elapsedTime: 2890,
    distance: 1000,
    averageStrokeRate: 21,
    endingHeartRate: 0,
    averageHeartRate: 0,
    minHeartRate: 0,
    maxHeartRate: 0,
    averageDragFactor: 188,
    recoveryHeartRate: 0,
    workoutType: 3,
    averagePace: 1445,
};

const additionalSummary: AdditionalEndWorkoutSummaryData = {
    logDate: 13625,
    logTime: 2845,
    intervalType: 1,
    intervalSize: 100,
    intervalCount: 1,
    totalCalories: 5,
    watts: 116,
    totalRestDistance: 0,
    restTime: 0,
    averageCalories: 699,
};

test('preserves raw evidence and deduplicates normalized strokes by PM5 stroke count', () => {
    const capture = new PM5CaptureAccumulator({
        captureId: 'capture-1',
        startedAt: '2026-09-19T14:30:00.000Z',
        timezone: 'America/New_York',
    });

    let sequence = 0;
    capture.ingestStroke(stroke(0, 0), evidence('0x0035', sequence++));
    for (let count = 1; count <= 10; count += 1) {
        capture.ingestStroke(stroke(count, 1), evidence('0x0035', sequence++));
        capture.ingestStroke(stroke(count, 2), evidence('0x0035', sequence++));
    }

    const snapshot = capture.snapshot();
    assert.equal(snapshot.status, 'recording');
    assert.equal(snapshot.rawNotifications.length, 21);
    assert.equal(snapshot.strokes.length, 10);
    assert.equal(snapshot.strokes[9].strokeCount, 10);
    assert.equal(snapshot.strokes[9].workPerStrokeJoules, 440.2);
});

test('finalizes from paired PM5 summaries and uses summary totals as authoritative', () => {
    const capture = new PM5CaptureAccumulator({
        captureId: 'capture-2',
        startedAt: '2026-09-19T14:30:00.000Z',
        timezone: 'America/New_York',
    });

    capture.ingestStroke(stroke(10, 2), evidence('0x0035', 1));
    capture.ingestSplit(split, evidence('0x0037', 2));
    capture.ingestEndSummary(summary, evidence('0x0039', 3));
    assert.equal(capture.snapshot().status, 'recording');
    capture.ingestAdditionalEndSummary(additionalSummary, evidence('0x003a', 4));
    assert.equal(capture.snapshot().status, 'recording');
    capture.ingestAdditionalEndSummary2({
        logDate: 13625,
        logTime: 2845,
        averagePace: 1445,
        gameIdentifier: 0,
        workoutVerified: true,
        verificationValue: 0x10,
        gameScore: 0,
        ergMachineType: 0,
    }, evidence('0x003c', 5));

    const snapshot = capture.snapshot();
    assert.equal(snapshot._v, 2);
    assert.equal(snapshot.captureVersion, 2);
    assert.equal(snapshot.status, 'completed');
    assert.equal(snapshot.completedAt, '2026-09-19T14:30:28.900Z');
    assert.equal(snapshot.rawNotifications.length, 5);
    assert.equal(snapshot.splits.length, 1);
    assert.deepEqual(snapshot.summary, {
        workDistanceMeters: 100,
        workTimeSeconds: 28.9,
        averagePaceSecondsPer500m: 144.5,
        averageStrokeRate: 21,
        averageWatts: 116,
        totalCalories: 5,
        restDistanceMeters: 0,
        restTimeSeconds: 0,
        strokeCount: 10,
    });
});

test('records explicit aborted and incomplete terminal states', () => {
    const aborted = new PM5CaptureAccumulator({
        captureId: 'capture-3',
        startedAt: '2026-09-19T14:30:00.000Z',
        timezone: 'America/New_York',
    });
    aborted.finish('aborted', '2026-09-19T14:30:10.000Z');
    assert.equal(aborted.snapshot().status, 'aborted');

    const incomplete = new PM5CaptureAccumulator({
        captureId: 'capture-4',
        startedAt: '2026-09-19T14:30:00.000Z',
        timezone: 'America/New_York',
    });
    incomplete.finish('incomplete_capture', '2026-09-19T14:30:11.000Z');
    assert.equal(incomplete.snapshot().status, 'incomplete_capture');
});


test('aligns status data within tolerance and computes interval-relative stroke values', () => {
    const capture = new PM5CaptureAccumulator({ captureId: 'capture-v2', startedAt: '2026-09-19T14:30:00.000Z', timezone: 'America/New_York', statusAlignmentToleranceCentiseconds: 50 });
    capture.ingestSplit({ ...split, elapsedTime: 1000, distance: 1000, intervalNumber: 1 }, evidence('0x0037', 1));
    const status1: AdditionalStatus1Data = { elapsedTime: 1250, speed: 0, strokeRate: 28, heartRate: 150, currentPace: 14000, averagePace: 0, restDistance: 0, restTime: 0, ergMachineType: 0 };
    const status2: AdditionalStatus2Data = { elapsedTime: 1250, intervalCount: 2, averagePower: 0, totalCalories: 0, splitAvgPace: 0, splitAvgPower: 0, splitAvgCalories: 0, lastSplitTime: 0, lastSplitDistance: 0 };
    const extraStroke: AdditionalStrokeData = { elapsedTime: 1250, strokePower: 250, strokeCalories: 900, strokeCount: 11, projectedWorkTime: 600, projectedWorkDistance: 2000 };
    capture.ingestStatus1(status1, evidence('0x0032', 2));
    capture.ingestStatus2(status2, evidence('0x0033', 3));
    capture.ingestStroke({ ...stroke(11, 0), elapsedTime: 1250, distance: 1250 }, evidence('0x0035', 4));
    capture.ingestAdditionalStroke(extraStroke, evidence('0x0036', 5));
    const end2: EndWorkoutAdditionalSummary2Data = { logDate: 0x1234, logTime: 0x5678, averagePace: 1400, gameIdentifier: 0, workoutVerified: true, verificationValue: 0x10, gameScore: 0, ergMachineType: 0 };
    capture.ingestAdditionalEndSummary2(end2, evidence('0x003c', 6));

    const snapshot = capture.snapshot();
    const normalized = snapshot.strokes[0];
    assert.equal(normalized.intervalNumber, 2);
    assert.equal(normalized.intervalElapsedSeconds, 2.5);
    assert.equal(normalized.intervalDistanceMeters, 25);
    assert.equal(normalized.paceSecondsPer500m, 140);
    assert.equal(normalized.strokeRate, 28);
    assert.equal(normalized.heartRate, 150);
    assert.equal(normalized.powerWatts, 250);
    assert.equal(normalized.caloriesPerHour, 900);
    assert.equal(normalized.projectedWorkTimeSeconds, 600);
    assert.equal(normalized.projectedWorkDistanceMeters, 2000);
    assert.equal(snapshot.verification?.workoutVerified, true);
    assert.deepEqual(snapshot.pmLogTimestamp, { dateValue: 0x1234, timeValue: 0x5678 });
    assert.equal(snapshot.ergMachineType, 0);
});

test('omits optional stroke metrics when no status sample is within tolerance', () => {
    const capture = new PM5CaptureAccumulator({ captureId: 'capture-no-alignment', startedAt: '2026-09-19T14:30:00.000Z', timezone: 'America/New_York', statusAlignmentToleranceCentiseconds: 25 });
    capture.ingestStatus1({ elapsedTime: 100, speed: 0, strokeRate: 30, heartRate: 160, currentPace: 13000, averagePace: 0, restDistance: 0, restTime: 0, ergMachineType: 0 }, evidence('0x0032', 1));
    capture.ingestStroke({ ...stroke(1, 0), elapsedTime: 200 }, evidence('0x0035', 2));
    const normalized = capture.snapshot().strokes[0];
    assert.equal(normalized.paceSecondsPer500m, undefined);
    assert.equal(normalized.strokeRate, undefined);
    assert.equal(normalized.heartRate, undefined);
    assert.equal(capture.snapshot().ergMachineType, 0);
});

test('keeps version-one captures readable through the union contract', () => {
    const legacy: PM5CompletedCapture = { _v: 1, captureVersion: 1, captureId: 'legacy', status: 'completed', startedAt: '2026-09-19T14:30:00.000Z', completedAt: '2026-09-19T14:31:00.000Z', timezone: 'America/New_York', rawNotifications: [], strokes: [], splits: [] };
    assert.equal(legacy._v, 1);
    assert.equal(legacy.captureVersion, 1);
});
