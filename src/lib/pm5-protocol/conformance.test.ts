import { activeWorkoutSpecToWorkoutConfig, buildCSAFEFrame, buildRaceStateFrame, buildWorkoutFrames } from './commands';
import {
    buildExtendedCSAFEFrame,
    buildStandardCSAFEFrame,
    parseCSAFEFrame,
    stuffCSAFEBytes,
    unstuffCSAFEBytes,
} from './frame';
import {
    PM5DataAggregator,
    parseRowingAdditionalStatus1,
    parseRowingAdditionalStatus2,
    parseRowingGeneralStatus,
    parseRowingStrokeData,
    parseRowingSplitIntervalData,
    parseRowingEndWorkoutSummary,
    parseRowingAdditionalEndWorkoutSummary,
} from './parser';
import { PM5_CHARACTERISTICS } from './types';
import { ErgMachineType, IntervalType, StrokeState, WorkoutState, WorkoutType } from './types';
import { CSAFE_GETSTATUS_CMD, CSAFE_PM_SET_RACEOPERATIONTYPE, ScreenValue } from '../../constants/csafe';
import { parseCSAFEResponse } from './response';
import { decodePM5String, decodePM5Uint16LE } from './diagnostic';
import {
    assertPM5AcceptedResponse,
    assertPM5ControlFrameLength,
    parsePM5StatusProbe,
    selectPM5ResponseMode,
    selectPM5WriteMode,
} from './transport';

const assert = {
    equal(actual: unknown, expected: unknown): void {
        if (!Object.is(actual, expected)) {
            throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
        }
    },
    deepEqual(actual: unknown, expected: unknown): void {
        const actualJson = JSON.stringify(actual);
        const expectedJson = JSON.stringify(expected);
        if (actualJson !== expectedJson) {
            throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
        }
    },
    throws(body: () => void, expectedMessage: string): void {
        try {
            body();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message === expectedMessage) return;
            throw new Error(`Expected error ${expectedMessage}, received ${message}`);
        }
        throw new Error(`Expected error ${expectedMessage}`);
    },
};

function test(name: string, body: () => void): void {
    body();
    console.log(`ok - ${name}`);
}

function view(bytes: number[]): DataView {
    return new DataView(Uint8Array.from(bytes).buffer);
}

test('parses rowing general status using Concept2 little-endian units', () => {
    const parsed = parseRowingGeneralStatus(view([
        0x39, 0x30, 0x00, // 123.45 seconds
        0x85, 0x1a, 0x00, // 678.9 metres
        0x07, 0x01, 0x0a, 0x01, 0x03,
        0xdc, 0x05, 0x00, // 1,500 metres total work distance
        0x00, 0x00, 0x00, 0x00, 0x00,
    ]));

    assert.deepEqual(parsed, {
        elapsedTime: 12_345,
        distance: 6_789,
        workoutType: 7,
        intervalType: 1,
        workoutState: 10,
        rowingState: 1,
        strokeState: 3,
        totalWorkDistance: 1_500,
    });
});

test('parses additional status characteristics using their documented units', () => {
    const status1 = parseRowingAdditionalStatus1(view([
        0xe0, 0x2e, 0x00,
        0xe1, 0x10,
        28,
        255,
        0x39, 0x30,
        0xd4, 0x30,
        0xfa, 0x00,
        0xb8, 0x0b, 0x00,
        0,
    ]));
    assert.equal(status1.elapsedTime, 12_000);
    assert.equal(status1.speed, 4_321);
    assert.equal(status1.currentPace, 12_345);
    assert.equal(status1.restDistance, 250);
    assert.equal(status1.restTime, 3_000);

    const status2 = parseRowingAdditionalStatus2(view([
        0xe0, 0x2e, 0x00,
        4,
        0xfa, 0x00,
        0x7b, 0x00,
        0xf8, 0x2a,
        0x04, 0x01,
        0x84, 0x03,
        0xd2, 0x04, 0x00,
        0xf4, 0x01, 0x00,
    ]));
    assert.equal(status2.averagePower, 250);
    assert.equal(status2.totalCalories, 123);
    assert.equal(status2.splitAvgPace, 11_000);
    assert.equal(status2.lastSplitTime, 1_234);
    assert.equal(status2.lastSplitDistance, 500);
});

test('aggregates subscribed status characteristics into application units', () => {
    const aggregator = new PM5DataAggregator();
    aggregator.update(PM5_CHARACTERISTICS.ROWING_GENERAL_STATUS, view([
        0x39, 0x30, 0x00,
        0x85, 0x1a, 0x00,
        0x07, 0x01, 0x01, 0x01, 0x03,
        0xdc, 0x05, 0x00,
        0, 0, 0, 0, 0,
    ]));
    aggregator.update(PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS1, view([
        0x39, 0x30, 0x00,
        0xe1, 0x10,
        28,
        150,
        0x39, 0x30,
        0xd4, 0x30,
        0xfa, 0x00,
        0xb8, 0x0b, 0x00,
        0,
    ]));
    aggregator.update(PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS2, view([
        0x39, 0x30, 0x00,
        4,
        0xfa, 0x00,
        0x7b, 0x00,
        0xf8, 0x2a,
        0x04, 0x01,
        0x84, 0x03,
        0xd2, 0x04, 0x00,
        0xf4, 0x01, 0x00,
    ]));

    const data = aggregator.getData();
    assert.equal(data.elapsedTime, 123.45);
    assert.equal(data.distance, 678.9);
    assert.equal(data.pace, 123.45);
    assert.equal(data.averageWatts, 250);
    assert.equal(data.intervalCount, 4);
});

test('splits fixed-distance commands into complete BLE-safe frames', () => {
    const frames = buildWorkoutFrames({
        type: 'fixed_distance',
        value: 2_000,
        split: 500,
    });
    assert.equal(frames.every((frame) => frame.byteLength <= 20), true);
    const payload = frames.flatMap((frame) => parseCSAFEFrame(Array.from(frame)).contents.slice(2));
    assert.deepEqual(payload, [
        0x01, 0x01, 0x03,
        0x03, 0x05, 0x80, 0x00, 0x00, 0x07, 0xd0,
        0x05, 0x05, 0x80, 0x00, 0x00, 0x01, 0xf4,
        0x14, 0x01, 0x01,
        0x13, 0x02, 0x01, 0x01,
    ]);
});

test('uses Revision 0.34 command identifiers and enumerations', () => {
    assert.equal(CSAFE_PM_SET_RACEOPERATIONTYPE, 0x1e);
    assert.equal(StrokeState.WAITING_FOR_MINIMUM_SPEED, 0);
    assert.equal(StrokeState.WAITING_FOR_ACCELERATION, 1);
    assert.equal(StrokeState.DRIVING, 2);
    assert.equal(StrokeState.DWELLING, 3);
    assert.equal(StrokeState.RECOVERY, 4);
    assert.equal(WorkoutState.WORK_TIME_TO_REST, 8);
    assert.equal(WorkoutState.WORK_DISTANCE_TO_REST, 9);
    assert.equal(IntervalType.NONE, 255);
    assert.equal(WorkoutType.FIXED_WATT_MINUTE_INTERVAL, 13);
    assert.equal(WorkoutType.NUM, 14);
    assert.equal(ErgMachineType.STATIC_DYNAMIC, 8);
    assert.equal(ErgMachineType.STATIC_SKI, 128);
    assert.equal(ErgMachineType.BIKE, 192);
    assert.equal(ErgMachineType.MULTI_ERG_ROW, 224);
    assert.equal(ErgMachineType.MULTI_ERG_SKI, 225);
    assert.equal(ErgMachineType.MULTI_ERG_BIKE, 226);
    assert.equal(ScreenValue.TerminateWorkout, 2);
});

test('stuffs and unstuffs every reserved CSAFE frame byte', () => {
    const reserved = [0xf0, 0xf1, 0xf2, 0xf3, 0x00];
    const stuffed = stuffCSAFEBytes(reserved);

    assert.deepEqual(stuffed, [0xf3, 0x00, 0xf3, 0x01, 0xf3, 0x02, 0xf3, 0x03, 0x00]);
    assert.deepEqual(unstuffCSAFEBytes(stuffed), reserved);
});

test('builds and parses a stuffed standard CSAFE frame', () => {
    const frame = buildStandardCSAFEFrame([0xf0, 0x01]);
    assert.deepEqual(frame, [0xf1, 0xf3, 0x00, 0x01, 0xf3, 0x01, 0xf2]);
    assert.deepEqual(parseCSAFEFrame(frame), {
        kind: 'standard',
        contents: [0xf0, 0x01],
    });
});

test('builds and parses an extended CSAFE race-operation frame', () => {
    const frame = buildExtendedCSAFEFrame([0x1e, 0x01, 0x09], 0xfd, 0x00);
    assert.deepEqual(frame, [0xf0, 0xfd, 0x00, 0x1e, 0x01, 0x09, 0x16, 0xf2]);
    assert.deepEqual(parseCSAFEFrame(frame), {
        kind: 'extended',
        destination: 0xfd,
        source: 0x00,
        contents: [0x1e, 0x01, 0x09],
    });
});

test('rejects a CSAFE frame with an invalid checksum', () => {
    assert.throws(() => parseCSAFEFrame([0xf1, 0x80, 0x81, 0xf2]), 'Invalid CSAFE checksum');
});

test('uses an extended frame for an enabled race operation', () => {
    assert.deepEqual(
        Array.from(buildRaceStateFrame(9)),
        [0xf0, 0xfd, 0x00, 0x76, 0x03, 0x1e, 0x01, 0x09, 0x63, 0xf2],
    );
});

test('includes fixed-interval rest duration across BLE-safe frames', () => {
    const frames = buildWorkoutFrames({
        type: 'interval_distance',
        value: 500,
        rest: 30,
        repeats: 4,
    });
    assert.equal(frames.every((frame) => frame.byteLength <= 20), true);
    const payload = frames.flatMap((frame) => parseCSAFEFrame(Array.from(frame)).contents.slice(2));
    assert.deepEqual(payload, [
        0x01, 0x01, 0x07,
        0x03, 0x05, 0x80, 0x00, 0x00, 0x01, 0xf4,
        0x04, 0x02, 0x00, 0x1e,
        0x14, 0x01, 0x01,
        0x13, 0x02, 0x01, 0x01,
    ]);
});

test('parses CSAFE response status and command response data', () => {
    const frame = buildStandardCSAFEFrame([0x95, 0x91, 0x02, 0x34, 0x12]);
    assert.deepEqual(parseCSAFEResponse(frame), {
        frameKind: 'standard',
        status: {
            raw: 0x95,
            frameToggle: true,
            previousFrameStatus: 'reject',
            stateMachineState: 'in_use',
        },
        responses: [{ command: 0x91, data: [0x34, 0x12] }],
    });
});

test('rejects a truncated CSAFE command response', () => {
    const frame = buildStandardCSAFEFrame([0x01, 0x91, 0x03, 0x34]);
    assert.throws(() => parseCSAFEResponse(frame), 'Truncated CSAFE command response');
});

test('packs the official variable-interval command sequence into complete 20-byte frames', () => {
    const frames = buildWorkoutFrames({
        type: 'variable_interval',
        intervals: [
            { type: 'distance', value: 500, rest: 60 },
            { type: 'time', value: 180, rest: 0 },
        ],
    });
    assert.equal(frames.every((frame) => frame.byteLength <= 20), true);
    const payload = frames.flatMap((frame) => parseCSAFEFrame(Array.from(frame)).contents.slice(2));
    assert.deepEqual(payload, [
        0x18, 0x01, 0x00,
        0x01, 0x01, 0x08,
        0x17, 0x01, 0x01,
        0x03, 0x05, 0x80, 0x00, 0x00, 0x01, 0xf4,
        0x04, 0x02, 0x00, 0x3c,
        0x14, 0x01, 0x01,
        0x18, 0x01, 0x01,
        0x17, 0x01, 0x00,
        0x03, 0x05, 0x00, 0x00, 0x00, 0x46, 0x50,
        0x04, 0x02, 0x00, 0x00,
        0x14, 0x01, 0x01,
        0x13, 0x02, 0x01, 0x01,
    ]);
});

test('decodes read-only PM5 diagnostic characteristic values', () => {
    assert.equal(decodePM5String(view([0x50, 0x4d, 0x35, 0x00, 0x20])), 'PM5');
    assert.equal(decodePM5Uint16LE(view([0xb9, 0x00])), 185);
});

test('blocks CSAFE control values above the documented 20-byte limit', () => {
    assertPM5ControlFrameLength(new Uint8Array(20));
    assert.throws(
        () => assertPM5ControlFrameLength(new Uint8Array(21)),
        'CSAFE control frame is 21 bytes; PM5 BLE control values are limited to 20 bytes',
    );
});

test('accepts only an OK PM5 response status', () => {
    const accepted = buildStandardCSAFEFrame([0x01]);
    assert.equal(assertPM5AcceptedResponse(accepted).status.previousFrameStatus, 'ok');

    const rejected = buildStandardCSAFEFrame([0x11]);
    assert.throws(
        () => assertPM5AcceptedResponse(rejected),
        'PM5 rejected the previous CSAFE frame',
    );
});

test('builds and parses the public read-only GETSTATUS probe', () => {
    assert.deepEqual(Array.from(buildCSAFEFrame(CSAFE_GETSTATUS_CMD, [])), [0xf1, 0x80, 0x80, 0xf2]);
    const response = [0xf1, 0x81, 0x81, 0xf2];
    assert.deepEqual(parsePM5StatusProbe(response), {
        rawStatus: 0x81,
        frameToggle: true,
        previousFrameStatus: 'ok',
        stateMachineState: 'ready',
    });
});

test('selects transport operations from the PM5 advertised GATT properties', () => {
    assert.equal(selectPM5WriteMode({ write: true, writeWithoutResponse: true }), 'with_response');
    assert.equal(selectPM5ResponseMode({ read: false, notify: true }), 'notification');
    assert.equal(selectPM5ResponseMode({ read: true, notify: false }), 'read');
});

test('parses an actual rowing stroke notification', () => {
    assert.deepEqual(parseRowingStrokeData(view([
        0x6c, 0x07, 0x00, 0x40, 0x01, 0x00, 120, 80, 120, 0,
        200, 0, 0xe8, 0x03, 0xbc, 0x02, 0xf4, 0x01, 12, 0,
    ])), {
        elapsedTime: 1900,
        distance: 320,
        driveLength: 120,
        driveTime: 80,
        recoveryTime: 120,
        strokeDistance: 200,
        peakDriveForce: 1000,
        averageDriveForce: 700,
        workPerStroke: 500,
        strokeCount: 12,
    });
});

test('parses split and end-of-workout notifications', () => {
    assert.deepEqual(parseRowingSplitIntervalData(view([
        0x6c, 0x07, 0x00, 0x40, 0x01, 0x00, 190, 0, 0,
        32, 0, 0, 0, 0, 0, 0, 0, 1,
    ])), {
        elapsedTime: 1900,
        distance: 320,
        intervalTime: 190,
        intervalDistance: 32,
        restTime: 0,
        restDistance: 0,
        intervalType: 0,
        intervalNumber: 1,
    });

    assert.deepEqual(parseRowingEndWorkoutSummary(view([
        0x34, 0x12, 0x78, 0x56, 0x6c, 0x07, 0x00, 0x40, 0x01, 0x00,
        43, 255, 255, 255, 255, 110, 0, 0, 0x6e, 0x0a,
    ])), {
        logDate: 0x1234,
        logTime: 0x5678,
        elapsedTime: 1900,
        distance: 320,
        averageStrokeRate: 43,
        endingHeartRate: 255,
        averageHeartRate: 255,
        minHeartRate: 255,
        maxHeartRate: 255,
        averageDragFactor: 110,
        recoveryHeartRate: 0,
        workoutType: 0,
        averagePace: 2670,
    });

    assert.deepEqual(parseRowingAdditionalEndWorkoutSummary(view([
        0x34, 0x12, 0x78, 0x56, 0, 0, 0, 0, 1, 0, 18, 0,
        0, 0, 0, 0, 0, 100, 0,
    ])), {
        logDate: 0x1234,
        logTime: 0x5678,
        intervalType: 0,
        intervalSize: 0,
        intervalCount: 0,
        totalCalories: 1,
        watts: 18,
        totalRestDistance: 0,
        restTime: 0,
        averageCalories: 100,
    });
});

test('attaches RWN rest steps to the preceding PM5 variable work interval', () => {
    const config = activeWorkoutSpecToWorkoutConfig({
        _v: 1,
        type: 'variable_interval',
        intervals: [
            { type: 'distance', value: 500 },
            { type: 'rest', value: 60 },
            { type: 'time', value: 180 },
        ],
    });
    assert.deepEqual(config.intervals, [
        { type: 'distance', value: 500, rest: 60 },
        { type: 'time', value: 180, rest: 0 },
    ]);
});

test('maps fixed-interval work length from ActiveWorkoutSpec split_value', () => {
    const config = activeWorkoutSpecToWorkoutConfig({
        _v: 1,
        type: 'interval_distance',
        split_value: 500,
        rest: 210,
        repeats: 8,
    });
    assert.equal(config.value, 500);
    assert.equal(config.rest, 210);
    assert.equal(config.repeats, 8);
});
