import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { PM5Data } from './bluetooth.types';
import type { CaptureUploadStatus, StoredCapture } from '@readyall/erglink';

export interface BufferedPM5Notification extends PM5Data {
    sessionId?: string;
    timestamp_local: number;
}

export interface ErgLinkDB extends DBSchema {
    strokes: {
        key: number;
        value: BufferedPM5Notification;
        indexes: { 'by-session': string };
    };
    captures: {
        key: string;
        value: StoredCapture;
        indexes: {
            'by-upload-status': CaptureUploadStatus;
            'by-created-at': string;
        };
    };
}

const DB_NAME = 'erg-link-buffer';
const DB_VERSION = 2;
let dbPromise: Promise<IDBPDatabase<ErgLinkDB>> | undefined;

export function getErgLinkDB(): Promise<IDBPDatabase<ErgLinkDB>> {
    dbPromise ??= openDB<ErgLinkDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('strokes')) {
                const strokes = db.createObjectStore('strokes', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                strokes.createIndex('by-session', 'sessionId');
            }
            if (!db.objectStoreNames.contains('captures')) {
                const captures = db.createObjectStore('captures', { keyPath: 'capture.captureId' });
                captures.createIndex('by-upload-status', 'uploadStatus');
                captures.createIndex('by-created-at', 'createdAt');
            }
        },
    });
    return dbPromise;
}
