import { parseCSAFEFrame } from './frame.js';

export type PreviousFrameStatus = 'ok' | 'reject' | 'bad' | 'not_ready';
export type StateMachineState =
    | 'error'
    | 'ready'
    | 'idle'
    | 'have_id'
    | 'in_use'
    | 'pause'
    | 'finish'
    | 'manual'
    | 'offline'
    | 'unknown';

export interface CSAFEResponseStatus {
    raw: number;
    frameToggle: boolean;
    previousFrameStatus: PreviousFrameStatus;
    stateMachineState: StateMachineState;
}

export interface CSAFECommandResponse {
    command: number;
    data: number[];
}

export interface CSAFEResponse {
    frameKind: 'standard' | 'extended';
    destination?: number;
    source?: number;
    status: CSAFEResponseStatus;
    responses: CSAFECommandResponse[];
}

const PREVIOUS_FRAME_STATUS: Record<number, PreviousFrameStatus> = {
    0x00: 'ok',
    0x10: 'reject',
    0x20: 'bad',
    0x30: 'not_ready',
};

const STATE_MACHINE_STATE: Record<number, StateMachineState> = {
    0x00: 'error',
    0x01: 'ready',
    0x02: 'idle',
    0x03: 'have_id',
    0x05: 'in_use',
    0x06: 'pause',
    0x07: 'finish',
    0x08: 'manual',
    0x09: 'offline',
};

export function parseCSAFEResponse(frame: readonly number[]): CSAFEResponse {
    const parsed = parseCSAFEFrame(frame);
    const [rawStatus, ...body] = parsed.contents;
    if (rawStatus === undefined) throw new Error('Missing CSAFE response status');

    const responses: CSAFECommandResponse[] = [];
    let offset = 0;
    while (offset < body.length) {
        const command = body[offset];
        const length = body[offset + 1];
        if (command === undefined || length === undefined || offset + 2 + length > body.length) {
            throw new Error('Truncated CSAFE command response');
        }
        responses.push({ command, data: body.slice(offset + 2, offset + 2 + length) });
        offset += 2 + length;
    }

    return {
        frameKind: parsed.kind,
        ...(parsed.kind === 'extended'
            ? { destination: parsed.destination, source: parsed.source }
            : {}),
        status: {
            raw: rawStatus,
            frameToggle: (rawStatus & 0x80) !== 0,
            previousFrameStatus: PREVIOUS_FRAME_STATUS[rawStatus & 0x30],
            stateMachineState: STATE_MACHINE_STATE[rawStatus & 0x0f] ?? 'unknown',
        },
        responses,
    };
}
