import { CSAFE_FRAME } from './types';

/**
 * Constructs a standard CSAFE frame with command, data, and checksum.
 * Note: Does not currently handle byte-stuffing (rarely needed for simple commands).
 */
export function buildCSAFEFrame(command: number, data: number[]): Uint8Array {
    // 1. Prepare Content: [Command] [Length] [Data...]
    const content = [command];

    // Length byte: Required for "Long Commands" (cmd < 0x80)
    // Short commands (cmd >= 0x80) have implied length 0
    if (command < 0x80) {
        content.push(data.length);
    }

    // Data bytes
    content.push(...data);

    // 2. Calculate Checksum (XOR of content)
    let checksum = 0;
    content.forEach(b => checksum ^= b);

    // 3. Wrap: [Start] [Content] [Checksum] [Stop]
    return new Uint8Array([
        CSAFE_FRAME.START_FLAG,
        ...content,
        checksum,
        CSAFE_FRAME.STOP_FLAG
    ]);
}
