import type { ActiveWorkoutSpec, PM5ProgrammingReceiptV1 } from '../types/ergSession.types';
import { activeWorkoutSpecToWorkoutConfig, buildWorkoutFrames } from '../lib/pm5-protocol/commands';
import { createDirectPM5ProgrammingRequest, PM5ProgrammingService } from './pm5ProgrammingService';

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

async function test(name: string, body: () => Promise<void>): Promise<void> {
    await body();
    console.log(`ok - ${name}`);
}

const request: ActiveWorkoutSpec = {
    _v: 1,
    programming_request_id: 'request-1',
    programming_requested_at: '2026-09-19T18:00:00.000Z',
    source_rwn: '4x500m/1:00r',
    lowering_mode: 'exact',
    type: 'interval_distance',
    split_value: 500,
    rest: 60,
    repeats: 4,
};

await test('serializes programming and writes received/programmed receipts', async () => {
    const order: string[] = [];
    const receipts: PM5ProgrammingReceiptV1[] = [];
    const times = ['2026-09-19T18:00:01.000Z', '2026-09-19T18:00:02.000Z'];
    const service = new PM5ProgrammingService({
        program: async () => { order.push('program'); },
        writeReceipt: async (receipt: PM5ProgrammingReceiptV1) => { order.push(receipt.status); receipts.push(receipt); },
        now: () => times.shift() ?? '2026-09-19T18:00:03.000Z',
    });

    const receipt = await service.deliver(request);

    assert.deepEqual(order, ['received', 'program', 'programmed']);
    assert.equal(receipt.status, 'programmed');
    assert.equal(receipts.length, 2);
});

await test('deduplicates a completed request unless reconnect forces delivery', async () => {
    let calls = 0;
    const service = new PM5ProgrammingService({
        program: async () => { calls += 1; },
        writeReceipt: async () => undefined,
        now: () => '2026-09-19T18:00:01.000Z',
    });

    await service.deliver(request);
    await service.deliver(request);
    await service.deliver(request, { force: true });

    assert.equal(calls, 2);
});

await test('classifies PM5 rejection and records an explicit receipt', async () => {
    const receipts: PM5ProgrammingReceiptV1[] = [];
    const service = new PM5ProgrammingService({
        program: async () => { throw new Error('PM5 rejected the previous CSAFE frame'); },
        writeReceipt: async (receipt: PM5ProgrammingReceiptV1) => { receipts.push(receipt); },
        now: () => '2026-09-19T18:00:01.000Z',
    });

    const receipt = await service.deliver(request);

    assert.equal(receipt.status, 'rejected');
    assert.equal(receipts.at(-1)?.status, 'rejected');
});

await test('translates direct athlete RWN without a coach session', async () => {
    const translated = createDirectPM5ProgrammingRequest('2000m', {
        requestId: 'direct-1',
        requestedAt: '2026-09-19T18:00:00.000Z',
    });
    assert.equal(translated.mode, 'exact');
    assert.deepEqual(translated.request, {
        _v: 1,
        type: 'fixed_distance',
        value: 2000,
        programming_request_id: 'direct-1',
        programming_requested_at: '2026-09-19T18:00:00.000Z',
        source_rwn: '2000m',
        lowering_mode: 'exact',
        lowering_notes: [],
    });

    const intervals = createDirectPM5ProgrammingRequest('8x500m/3:30r');
    assert.equal(intervals.mode, 'prompt_only');
    assert.equal(intervals.request?.repeats, 8);
    assert.equal(intervals.notes[0].includes('complete 8 reps'), true);

    const unsupported = createDirectPM5ProgrammingRequest('v500m/40cal/500m');
    assert.equal(unsupported.mode, 'unsupported');
    assert.equal(unsupported.request, null);
});

await test('translates the full Pete Plan speed pyramid into BLE-safe PM5 frames', async () => {
    const pyramid = '250m/1:30r+500m/3:00r+750m/4:30r+1000m/6:00r+750m/4:30r+500m/3:00r+250m/1:30r';
    const translated = createDirectPM5ProgrammingRequest(pyramid, {
        requestId: 'pyramid-1',
        requestedAt: '2026-09-19T18:00:00.000Z',
    });
    assert.equal(translated.mode, 'exact');
    assert.equal(translated.request?.intervals?.length, 14);
    const config = activeWorkoutSpecToWorkoutConfig(translated.request!);
    assert.equal(config.intervals?.length, 7);
    assert.deepEqual(config.intervals?.map((interval) => [interval.value, interval.rest]), [
        [250, 90], [500, 180], [750, 270], [1000, 360], [750, 270], [500, 180], [250, 90],
    ]);
    const frames = buildWorkoutFrames(config);
    assert.equal(frames.every((frame) => frame.byteLength <= 20), true);
});
