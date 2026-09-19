export function decodePM5String(value: DataView): string {
    return new TextDecoder().decode(value).replace(/\0.*$/s, '').trim();
}

export function decodePM5Uint16LE(value: DataView): number {
    if (value.byteLength < 2) throw new Error('PM5 diagnostic value is shorter than 2 bytes');
    return value.getUint16(0, true);
}
