import {
    calculateCSAFEChecksum,
    CSAFE_EXTENDED_FRAME_START,
    CSAFE_FRAME_START,
    CSAFE_FRAME_STOP,
    CSAFE_FRAME_STUFF,
} from '../../constants/csafe';

export type ParsedCSAFEFrame =
    | { kind: 'standard'; contents: number[] }
    | { kind: 'extended'; destination: number; source: number; contents: number[] };

const STUFF_CODE_BY_BYTE = new Map<number, number>([
    [CSAFE_EXTENDED_FRAME_START, 0x00],
    [CSAFE_FRAME_START, 0x01],
    [CSAFE_FRAME_STOP, 0x02],
    [CSAFE_FRAME_STUFF, 0x03],
]);

const BYTE_BY_STUFF_CODE = [
    CSAFE_EXTENDED_FRAME_START,
    CSAFE_FRAME_START,
    CSAFE_FRAME_STOP,
    CSAFE_FRAME_STUFF,
] as const;

export function stuffCSAFEBytes(bytes: readonly number[]): number[] {
    const result: number[] = [];
    for (const byte of bytes) {
        const code = STUFF_CODE_BY_BYTE.get(byte);
        if (code === undefined) result.push(byte);
        else result.push(CSAFE_FRAME_STUFF, code);
    }
    return result;
}

export function unstuffCSAFEBytes(bytes: readonly number[]): number[] {
    const result: number[] = [];
    for (let index = 0; index < bytes.length; index += 1) {
        const byte = bytes[index];
        if (byte !== CSAFE_FRAME_STUFF) {
            result.push(byte);
            continue;
        }

        const code = bytes[index + 1];
        if (code === undefined || code > 0x03) {
            throw new Error('Invalid CSAFE byte-stuffing sequence');
        }
        result.push(BYTE_BY_STUFF_CODE[code]);
        index += 1;
    }
    return result;
}

export function buildStandardCSAFEFrame(contents: readonly number[]): number[] {
    const checksum = calculateCSAFEChecksum([...contents]);
    return [CSAFE_FRAME_START, ...stuffCSAFEBytes([...contents, checksum]), CSAFE_FRAME_STOP];
}

export function buildExtendedCSAFEFrame(
    contents: readonly number[],
    destination: number,
    source: number,
): number[] {
    const checksum = calculateCSAFEChecksum([...contents]);
    return [
        CSAFE_EXTENDED_FRAME_START,
        ...stuffCSAFEBytes([destination, source, ...contents, checksum]),
        CSAFE_FRAME_STOP,
    ];
}

export function parseCSAFEFrame(frame: readonly number[]): ParsedCSAFEFrame {
    const start = frame[0];
    if ((start !== CSAFE_FRAME_START && start !== CSAFE_EXTENDED_FRAME_START) ||
        frame[frame.length - 1] !== CSAFE_FRAME_STOP) {
        throw new Error('Invalid CSAFE frame delimiters');
    }

    const payload = unstuffCSAFEBytes(frame.slice(1, -1));
    const addressBytes = start === CSAFE_EXTENDED_FRAME_START ? 2 : 0;
    if (payload.length <= addressBytes) throw new Error('Incomplete CSAFE frame');

    const checksum = payload[payload.length - 1];
    const contents = payload.slice(addressBytes, -1);
    if (calculateCSAFEChecksum(contents) !== checksum) {
        throw new Error('Invalid CSAFE checksum');
    }

    if (start === CSAFE_FRAME_START) return { kind: 'standard', contents };
    return {
        kind: 'extended',
        destination: payload[0],
        source: payload[1],
        contents,
    };
}
