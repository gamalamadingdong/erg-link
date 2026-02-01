import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PM5Data } from './bluetooth.types';

// Define the DB Schema
interface StrokeBufferDB extends DBSchema {
    strokes: {
        key: number; // auto-incrementing ID
        value: PM5Data & { sessionId?: string; timestamp_local: number };
        indexes: { 'by-session': string };
    };
}

const DB_NAME = 'erg-link-buffer';
const STORE_NAME = 'strokes';
const DB_VERSION = 1;

class StrokeBufferService {
    private dbPromise: Promise<IDBPDatabase<StrokeBufferDB>>;

    constructor() {
        this.dbPromise = openDB<StrokeBufferDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // Create an objectStore for this database
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                store.createIndex('by-session', 'sessionId');
            },
        });
    }

    /**
     * Appends a single stroke to the local buffer.
     */
    async append(data: PM5Data, sessionId?: string): Promise<void> {
        const db = await this.dbPromise;
        await db.add(STORE_NAME, {
            ...data,
            sessionId: sessionId || 'pending',
            timestamp_local: Date.now()
        });
    }

    /**
     * Retrieves all strokes for a specific session (or 'pending' if not yet assigned).
     */
    async getSessionStrokes(sessionId: string = 'pending'): Promise<(PM5Data & { timestamp_local: number })[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex(STORE_NAME, 'by-session', sessionId);
    }

    /**
     * Counts strokes in the buffer.
     */
    async count(sessionId: string = 'pending'): Promise<number> {
        const db = await this.dbPromise;
        return db.countFromIndex(STORE_NAME, 'by-session', sessionId);
    }

    /**
     * Clears strokes for a session after successful upload.
     */
    async clearSession(sessionId: string = 'pending'): Promise<void> {
        const db = await this.dbPromise;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const index = tx.store.index('by-session');

        // Iterate and delete cursor
        // Note: 'idb' makes this a bit manual for bulk delete by index, 
        // but efficient enough for 3000 items.
        let cursor = await index.openCursor(IDBKeyRange.only(sessionId));

        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }

        await tx.done;
    }

    /**
     * Exports session data as a JSON blob ready for upload.
     */
    async export(sessionId: string = 'pending'): Promise<Blob> {
        const strokes = await this.getSessionStrokes(sessionId);
        const json = JSON.stringify(strokes);
        return new Blob([json], { type: 'application/json' });
    }
}

export const strokeBuffer = new StrokeBufferService();
