import type { NormalizedSplitV2, NormalizedStrokeV2, PM5CompletedCaptureV2 } from './capture.js';
import { ErgMachineType, IntervalType, WorkoutType } from './types.js';
import { PM5_CAPTURE_VIOLATION_CODES, validatePm5Capture, type PM5CaptureViolationCode } from './validation.js';

interface FixtureShape {
    id: string;
    workoutType: number;
    intervals: Array<{ distanceMeters: number; workTimeSeconds: number; restTimeSeconds: number }>;
    fixedDistanceTarget?: number;
    strokeRate?: number;
}

const paceSecondsPer500m = 120;
const averageWatts = Math.round(2.8 / Math.pow(paceSecondsPer500m / 500, 3));
const evidence = (characteristic: string, sequence: number) => ({
    characteristic,
    receivedAt: `2026-09-21T12:00:${String(sequence).padStart(2, '0')}.000Z`,
    bytes: [sequence],
});

function createFixture(shape: FixtureShape): PM5CompletedCaptureV2 {
    const splits: NormalizedSplitV2[] = [];
    const strokes: NormalizedStrokeV2[] = [];
    const strokeRate = shape.strokeRate ?? 28;
    const intervalType = [WorkoutType.FIXED_TIME_NO_SPLITS, WorkoutType.FIXED_TIME_SPLITS, WorkoutType.FIXED_TIME_INTERVAL].includes(shape.workoutType)
        ? IntervalType.TIME
        : IntervalType.DISTANCE;
    let cumulativeDistance = 0;
    let cumulativeTime = 0;
    let strokeCount = 0;

    shape.intervals.forEach((interval, index) => {
        const intervalNumber = index + 1;
        cumulativeDistance += interval.distanceMeters;
        cumulativeTime += interval.workTimeSeconds;
        splits.push({
            intervalNumber,
            intervalType,
            elapsedSeconds: cumulativeTime,
            cumulativeDistanceMeters: cumulativeDistance,
            workTimeSeconds: interval.workTimeSeconds,
            workDistanceMeters: interval.distanceMeters,
            restTimeSeconds: interval.restTimeSeconds,
            restDistanceMeters: 0,
            averageStrokeRate: strokeRate,
            averagePaceSecondsPer500m: paceSecondsPer500m,
            powerWatts: averageWatts,
            ergMachineType: ErgMachineType.STATIC_E,
        });
        const strokesInInterval = Math.max(1, Math.round(interval.workTimeSeconds * strokeRate / 60));
        const strokeDistance = interval.distanceMeters / strokesInInterval;
        for (let strokeIndex = 1; strokeIndex <= strokesInInterval; strokeIndex += 1) {
            strokeCount += 1;
            const fraction = strokeIndex / strokesInInterval;
            const intervalDistance = interval.distanceMeters * fraction;
            const intervalTime = interval.workTimeSeconds * fraction;
            strokes.push({
                strokeCount,
                elapsedSeconds: cumulativeTime - interval.workTimeSeconds + intervalTime,
                cumulativeDistanceMeters: cumulativeDistance - interval.distanceMeters + intervalDistance,
                driveLengthMeters: 1.2,
                driveTimeSeconds: 0.8,
                recoveryTimeSeconds: Math.max(0.2, interval.workTimeSeconds / strokesInInterval - 0.8),
                strokeDistanceMeters: strokeDistance,
                peakDriveForcePounds: 100,
                averageDriveForcePounds: 80,
                workPerStrokeJoules: 400,
                intervalNumber,
                intervalElapsedSeconds: intervalTime,
                intervalDistanceMeters: intervalDistance,
                paceSecondsPer500m,
                strokeRate,
                heartRate: 150,
                powerWatts: averageWatts,
            });
        }
    });

    const finalIntervalRestTime = shape.intervals.at(-1)?.restTimeSeconds ?? 0;
    const logDate = 13627;
    const logTime = 43200;
    const verificationEvidence = evidence('ce06003c-43e5-11e4-916c-0800200c9a66', 3);
    return {
        _v: 2,
        captureVersion: 2,
        captureId: shape.id,
        status: 'completed',
        startedAt: '2026-09-21T12:00:00.000Z',
        completedAt: new Date(Date.parse('2026-09-21T12:00:00.000Z') + cumulativeTime * 1000).toISOString(),
        timezone: 'America/New_York',
        rawNotifications: [
            { ...evidence('ce060031-43e5-11e4-916c-0800200c9a66', 1), sequence: 0 },
            { ...verificationEvidence, sequence: 1 },
        ],
        strokes,
        splits,
        summary: {
            workDistanceMeters: cumulativeDistance,
            workTimeSeconds: cumulativeTime,
            averagePaceSecondsPer500m: paceSecondsPer500m,
            averageStrokeRate: strokeRate,
            averageWatts,
            totalCalories: Math.round(cumulativeTime / 10),
            restDistanceMeters: 0,
            restTimeSeconds: finalIntervalRestTime,
            strokeCount,
        },
        rawEndSummary: {
            logDate,
            logTime,
            elapsedTime: cumulativeTime * 100,
            distance: cumulativeDistance * 10,
            averageStrokeRate: strokeRate,
            endingHeartRate: 160,
            averageHeartRate: 150,
            minHeartRate: 120,
            maxHeartRate: 165,
            averageDragFactor: 120,
            recoveryHeartRate: 0,
            workoutType: shape.workoutType,
            averagePace: paceSecondsPer500m * 10,
        },
        rawAdditionalEndSummary: {
            logDate,
            logTime,
            intervalType,
            intervalSize: shape.intervals[0].distanceMeters,
            intervalCount: shape.intervals.length,
            totalCalories: Math.round(cumulativeTime / 10),
            watts: averageWatts,
            totalRestDistance: 0,
            restTime: finalIntervalRestTime,
            averageCalories: 700,
        },
        rawAdditionalEndSummary2: {
            logDate,
            logTime,
            averagePace: paceSecondsPer500m * 10,
            gameIdentifier: 0,
            workoutVerified: true,
            verificationValue: 0x10,
            gameScore: 0,
            ergMachineType: ErgMachineType.STATIC_E,
        },
        verification: {
            workoutVerified: true,
            verificationValue: 0x10,
            gameIdentifier: 0,
            evidence: verificationEvidence,
        },
        ergMachineType: ErgMachineType.STATIC_E,
        pmLogTimestamp: { dateValue: logDate, timeValue: logTime },
        startState: {
            status: {
                elapsedTime: 0,
                distance: 0,
                workoutType: shape.workoutType,
                intervalType,
                workoutState: 1,
                rowingState: 0,
                strokeState: 0,
                totalWorkDistance: shape.fixedDistanceTarget ?? 0,
            },
            evidence: evidence('ce060031-43e5-11e4-916c-0800200c9a66', 1),
        },
    };
}

const fixedDistance = (id: string, distanceMeters: number): PM5CompletedCaptureV2 => createFixture({
    id,
    workoutType: WorkoutType.FIXED_DISTANCE_SPLITS,
    fixedDistanceTarget: distanceMeters,
    intervals: Array.from({ length: Math.max(1, distanceMeters / 500) }, () => ({
        distanceMeters: Math.min(500, distanceMeters),
        workTimeSeconds: Math.min(500, distanceMeters) / 500 * paceSecondsPer500m,
        restTimeSeconds: 0,
    })),
});

const fixedTime = (id: string, minutes: number, strokeRate?: number): PM5CompletedCaptureV2 => createFixture({
    id,
    workoutType: WorkoutType.FIXED_TIME_SPLITS,
    strokeRate,
    intervals: Array.from({ length: minutes / 5 }, () => ({
        distanceMeters: 300 / paceSecondsPer500m * 500,
        workTimeSeconds: 300,
        restTimeSeconds: 0,
    })),
});

const repeatedDistanceIntervals = (
    id: string,
    count: number,
    distanceMeters: number,
    restTimeSeconds: number,
): PM5CompletedCaptureV2 => createFixture({
    id,
    workoutType: WorkoutType.FIXED_DISTANCE_INTERVAL,
    intervals: Array.from({ length: count }, () => ({
        distanceMeters,
        workTimeSeconds: distanceMeters / 500 * paceSecondsPer500m,
        restTimeSeconds,
    })),
});

const variableDistanceIntervals = (
    id: string,
    distances: number[],
    rests: number[],
): PM5CompletedCaptureV2 => createFixture({
    id,
    workoutType: WorkoutType.VARIABLE_INTERVAL,
    intervals: distances.map((distanceMeters, index) => ({
        distanceMeters,
        workTimeSeconds: distanceMeters / 500 * paceSecondsPer500m,
        restTimeSeconds: rests[index],
    })),
});

export const PM5_VALIDATION_FIXTURES = {
    fixed500m: fixedDistance('fixed-500m', 500),
    fixed2000m: fixedDistance('fixed-2000m', 2000),
    fixed10000m: fixedDistance('fixed-10000m', 10000),
    fixed20Minutes: fixedTime('fixed-20-minutes', 20),
    fixed30Minutes: fixedTime('fixed-30-minutes', 30),
    pete8x500m: repeatedDistanceIntervals('pete-8x500m', 8, 500, 210),
    pete5x1500m: repeatedDistanceIntervals('pete-5x1500m', 5, 1500, 300),
    peteSpeedPyramid: variableDistanceIntervals(
        'pete-speed-pyramid',
        [250, 500, 750, 1000, 750, 500, 250],
        [90, 180, 270, 360, 270, 180, 90],
    ),
    pete4x2000m: repeatedDistanceIntervals('pete-4x2000m', 4, 2000, 300),
    pete4x1000m: repeatedDistanceIntervals('pete-4x1000m', 4, 1000, 300),
    peteLongPyramid: variableDistanceIntervals('pete-3000-2500-2000', [3000, 2500, 2000], [300, 300, 300]),
    pete30r20: fixedTime('pete-30r20', 30, 20),
    pete3x2000m: repeatedDistanceIntervals('pete-3x2000m', 3, 2000, 300),
    peteHourOfPower: fixedTime('pete-hour-of-power', 60, 22),
    peteCascadingPyramid: variableDistanceIntervals('pete-3000-2000-1000', [3000, 2000, 1000], [240, 240, 240]),
} satisfies Record<string, PM5CompletedCaptureV2>;

function clone(capture: PM5CompletedCaptureV2): PM5CompletedCaptureV2 {
    return structuredClone(capture);
}

function codes(capture: PM5CompletedCaptureV2): PM5CaptureViolationCode[] {
    return validatePm5Capture(capture).violations.map((violation) => violation.code);
}

function expectViolation(
    name: string,
    mutate: (capture: PM5CompletedCaptureV2) => void,
    expected: PM5CaptureViolationCode,
    base: PM5CompletedCaptureV2 = PM5_VALIDATION_FIXTURES.fixed2000m,
): void {
    const capture = clone(base);
    mutate(capture);
    const actual = codes(capture);
    if (!actual.includes(expected)) throw new Error(`${name}: expected ${expected}, received ${actual.join(', ')}`);
    console.log(`ok - ${name}`);
}

for (const [name, capture] of Object.entries(PM5_VALIDATION_FIXTURES)) {
    const result = validatePm5Capture(capture);
    if (!result.valid) throw new Error(`${name}: expected valid fixture, received ${result.violations.map((item) => item.code).join(', ')}`);
    console.log(`ok - validates ${name}`);
}

expectViolation('rejects version 1', (capture) => Object.assign(capture, { _v: 1, captureVersion: 1 }), PM5_CAPTURE_VIOLATION_CODES.CAPTURE_VERSION_UNSUPPORTED);
expectViolation('rejects unsupported workout type', (capture) => { if (capture.rawEndSummary) capture.rawEndSummary.workoutType = WorkoutType.JUST_ROW_SPLITS; }, PM5_CAPTURE_VIOLATION_CODES.WORKOUT_TYPE_UNSUPPORTED);
expectViolation('requires completed status', (capture) => { capture.status = 'aborted'; }, PM5_CAPTURE_VIOLATION_CODES.CAPTURE_NOT_COMPLETED);
expectViolation('requires all summaries', (capture) => { capture.rawAdditionalEndSummary = undefined; }, PM5_CAPTURE_VIOLATION_CODES.END_SUMMARIES_MISSING);
expectViolation('requires fixed-distance target', (capture) => { if (capture.summary) capture.summary.workDistanceMeters -= 1; }, PM5_CAPTURE_VIOLATION_CODES.WORK_DISTANCE_MISMATCH);
expectViolation('rejects rest in a single piece', (capture) => { if (capture.summary) capture.summary.restTimeSeconds = 1; }, PM5_CAPTURE_VIOLATION_CODES.REST_PRESENT);
expectViolation('reconciles final split', (capture) => { capture.splits.at(-1)!.cumulativeDistanceMeters -= 10; }, PM5_CAPTURE_VIOLATION_CODES.FINAL_SPLIT_MISMATCH);
expectViolation('reconciles final stroke', (capture) => { capture.strokes.at(-1)!.cumulativeDistanceMeters -= 200; }, PM5_CAPTURE_VIOLATION_CODES.FINAL_STROKE_MISMATCH);
expectViolation('requires contiguous strokes', (capture) => { capture.strokes[2].strokeCount += 1; }, PM5_CAPTURE_VIOLATION_CODES.STROKE_COUNT_SEQUENCE_INVALID);
expectViolation('requires monotonic stroke time', (capture) => { capture.strokes[2].elapsedSeconds = capture.strokes[1].elapsedSeconds; }, PM5_CAPTURE_VIOLATION_CODES.STROKE_TIME_NOT_MONOTONIC);
expectViolation('requires monotonic stroke distance', (capture) => { capture.strokes[2].cumulativeDistanceMeters = capture.strokes[1].cumulativeDistanceMeters; }, PM5_CAPTURE_VIOLATION_CODES.STROKE_DISTANCE_NOT_MONOTONIC);
expectViolation('keeps strokes inside the completed window', (capture) => { if (capture.summary) capture.strokes[0].elapsedSeconds = capture.summary.workTimeSeconds + 1; }, PM5_CAPTURE_VIOLATION_CODES.STROKE_OUTSIDE_COMPLETED_WINDOW);
expectViolation('reconciles pace and time', (capture) => { if (capture.summary) capture.summary.averagePaceSecondsPer500m += 1; }, PM5_CAPTURE_VIOLATION_CODES.PACE_TIME_MISMATCH);
expectViolation('reconciles pace and watts', (capture) => { if (capture.summary) capture.summary.averageWatts += 10; }, PM5_CAPTURE_VIOLATION_CODES.WATTS_PACE_MISMATCH);
expectViolation('requires PM log timestamp', (capture) => { capture.pmLogTimestamp = undefined; }, PM5_CAPTURE_VIOLATION_CODES.PM_LOG_TIMESTAMP_MISSING);
expectViolation('requires RowErg machine type', (capture) => { capture.ergMachineType = ErgMachineType.STATIC_SKI; }, PM5_CAPTURE_VIOLATION_CODES.ERG_MACHINE_NOT_ROWERG);
expectViolation('requires 0x003c evidence', (capture) => { capture.verification = undefined; }, PM5_CAPTURE_VIOLATION_CODES.VERIFICATION_EVIDENCE_MISSING);
expectViolation('requires stationary start evidence', (capture) => { if (capture.startState) capture.startState.status.distance = 1; }, PM5_CAPTURE_VIOLATION_CODES.START_STATE_EVIDENCE_MISSING);
expectViolation('requires interval count parity', (capture) => { if (capture.rawAdditionalEndSummary) capture.rawAdditionalEndSummary.intervalCount += 1; }, PM5_CAPTURE_VIOLATION_CODES.INTERVAL_COUNT_MISMATCH, PM5_VALIDATION_FIXTURES.pete8x500m);
expectViolation('requires interval sequence', (capture) => { capture.splits[1].intervalNumber = 4; }, PM5_CAPTURE_VIOLATION_CODES.INTERVAL_SEQUENCE_INVALID, PM5_VALIDATION_FIXTURES.pete8x500m);
expectViolation('reconciles interval totals', (capture) => { capture.splits[0].workDistanceMeters -= 10; }, PM5_CAPTURE_VIOLATION_CODES.INTERVAL_TOTALS_MISMATCH, PM5_VALIDATION_FIXTURES.pete8x500m);
expectViolation('keeps strokes inside their intervals', (capture) => { capture.strokes[0].intervalNumber = 99; }, PM5_CAPTURE_VIOLATION_CODES.STROKE_INTERVAL_INVALID, PM5_VALIDATION_FIXTURES.peteSpeedPyramid);
expectViolation('reconciles normalized and raw summaries', (capture) => { if (capture.rawEndSummary) capture.rawEndSummary.distance += 10; }, PM5_CAPTURE_VIOLATION_CODES.RAW_SUMMARY_MISMATCH);
expectViolation('reconciles completed stroke count', (capture) => { if (capture.summary) capture.summary.strokeCount += 1; }, PM5_CAPTURE_VIOLATION_CODES.STROKE_COUNT_SUMMARY_MISMATCH);
expectViolation('reconciles stroke cadence', (capture) => {
    if (capture.summary) capture.summary.averageStrokeRate += 5;
    if (capture.rawEndSummary) capture.rawEndSummary.averageStrokeRate += 5;
}, PM5_CAPTURE_VIOLATION_CODES.STROKE_RATE_MISMATCH);
expectViolation('requires consistent interval types', (capture) => { if (capture.rawAdditionalEndSummary) capture.rawAdditionalEndSummary.intervalType = IntervalType.TIME; }, PM5_CAPTURE_VIOLATION_CODES.INTERVAL_TYPE_MISMATCH, PM5_VALIDATION_FIXTURES.pete8x500m);
expectViolation('requires retained verification notification', (capture) => { capture.rawNotifications = capture.rawNotifications.filter((item) => !item.characteristic.includes('003c')); }, PM5_CAPTURE_VIOLATION_CODES.VERIFICATION_EVIDENCE_MISSING);
expectViolation('requires retained start notification', (capture) => { capture.rawNotifications = capture.rawNotifications.filter((item) => !item.characteristic.includes('0031')); }, PM5_CAPTURE_VIOLATION_CODES.START_STATE_EVIDENCE_MISSING);
expectViolation('requires interval-local stroke progression', (capture) => {
    capture.strokes.filter((stroke) => stroke.intervalNumber === 1).forEach((stroke) => {
        stroke.intervalElapsedSeconds = 0;
        stroke.intervalDistanceMeters = 0;
    });
}, PM5_CAPTURE_VIOLATION_CODES.STROKE_INTERVAL_INVALID, PM5_VALIDATION_FIXTURES.pete8x500m);

const roundedLongPiece = clone(PM5_VALIDATION_FIXTURES.fixed10000m);
const timeScale = 2401 / 2400;
if (roundedLongPiece.summary && roundedLongPiece.rawEndSummary && roundedLongPiece.rawAdditionalEndSummary) {
    roundedLongPiece.summary.workTimeSeconds = 2401;
    roundedLongPiece.summary.averagePaceSecondsPer500m = 120.1;
    roundedLongPiece.summary.averageWatts = Math.round(2.8 / Math.pow(120.1 / 500, 3));
    roundedLongPiece.rawEndSummary.elapsedTime = 240100;
    roundedLongPiece.rawEndSummary.averagePace = 1201;
    roundedLongPiece.rawAdditionalEndSummary.watts = roundedLongPiece.summary.averageWatts;
}
roundedLongPiece.splits.forEach((split) => {
    split.elapsedSeconds *= timeScale;
    split.workTimeSeconds *= timeScale;
});
roundedLongPiece.strokes.forEach((stroke) => {
    stroke.elapsedSeconds *= timeScale;
    stroke.intervalElapsedSeconds *= timeScale;
    stroke.driveTimeSeconds *= timeScale;
    stroke.recoveryTimeSeconds *= timeScale;
});
const roundedResult = validatePm5Capture(roundedLongPiece);
if (!roundedResult.valid) throw new Error(`distance-scaled pace tolerance rejected valid rounding: ${roundedResult.violations.map((item) => item.code).join(', ')}`);
console.log('ok - scales pace tolerance with workout distance');
