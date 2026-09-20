import { parseCSAFEResponse, type CSAFEResponse } from './response.js';
import { CSAFE_GETSTATUS_CMD } from './csafe.js';

export const PM5_BLE_CONTROL_VALUE_LIMIT = 20;

export type PM5WriteMode = 'with_response' | 'without_response';
export type PM5ResponseMode = 'notification' | 'read';

export function selectPM5WriteMode(properties: {
    write: boolean;
    writeWithoutResponse: boolean;
}): PM5WriteMode {
    if (properties.write) return 'with_response';
    if (properties.writeWithoutResponse) return 'without_response';
    throw new Error('PM5 CSAFE receive characteristic is not writable');
}

export function selectPM5ResponseMode(properties: {
    read: boolean;
    notify: boolean;
}): PM5ResponseMode {
    if (properties.notify) return 'notification';
    if (properties.read) return 'read';
    throw new Error('PM5 CSAFE transmit characteristic has no supported response operation');
}

export function assertPM5ControlFrameLength(
    frame: Uint8Array,
    limit: number = PM5_BLE_CONTROL_VALUE_LIMIT,
): void {
    if (frame.byteLength > limit) {
        throw new Error(
            `CSAFE control frame is ${frame.byteLength} bytes; PM5 BLE control values are limited to ${limit} bytes`,
        );
    }
}

export function assertPM5AcceptedResponse(frame: readonly number[]): CSAFEResponse {
    const response = parseCSAFEResponse(frame);
    const status = response.status.previousFrameStatus;
    if (status === 'ok') return response;
    if (status === 'reject') throw new Error('PM5 rejected the previous CSAFE frame');
    if (status === 'bad') throw new Error('PM5 reported a bad previous CSAFE frame');
    throw new Error('PM5 is not ready for the previous CSAFE frame');
}

export interface PM5StatusProbe {
    rawStatus: number;
    frameToggle: boolean;
    previousFrameStatus: CSAFEResponse['status']['previousFrameStatus'];
    stateMachineState: CSAFEResponse['status']['stateMachineState'];
}

export function parsePM5StatusProbe(frame: readonly number[]): PM5StatusProbe {
    const response = assertPM5AcceptedResponse(frame);
    const command = response.responses.find((candidate) => candidate.command === CSAFE_GETSTATUS_CMD);
    if ((command && command.data.length !== 1) || (!command && response.responses.length > 0)) {
        const hex = frame.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
        throw new Error(`PM5 GETSTATUS response is missing or malformed; raw frame: ${hex}`);
    }
    return {
        rawStatus: response.status.raw,
        frameToggle: response.status.frameToggle,
        previousFrameStatus: response.status.previousFrameStatus,
        stateMachineState: response.status.stateMachineState,
    };
}
