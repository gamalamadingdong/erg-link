import {
    PM5CaptureAccumulator,
    type CaptureNotificationEvidence,
} from './capture';
import type {
    AdditionalEndWorkoutSummaryData,
    EndWorkoutSummaryData,
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

    const snapshot = capture.snapshot();
    assert.equal(snapshot._v, 1);
    assert.equal(snapshot.captureVersion, 1);
    assert.equal(snapshot.status, 'completed');
    assert.equal(snapshot.completedAt, '2026-09-19T14:30:28.900Z');
    assert.equal(snapshot.rawNotifications.length, 4);
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
