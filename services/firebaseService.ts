
import { db } from '../firebaseConfig';
import { doc, onSnapshot, writeBatch } from 'firebase/firestore';
import type { PersistedState } from '../types';

const COLLECTION_NAME = 'app_data';
const CONFIG_DOC_ID = 'globalState';
const BOOKINGS_PREFIX = 'bookings_part_';
const NOTIFICATIONS_PREFIX = 'notifications_part_';
const MAX_SHARDS = 40;

// Threshold for chunking (roughly 500KB-700KB worth of items to stay safe)
const ITEMS_PER_CHUNK = 500;

/**
 * Recursively removes any keys with the value of undefined from an object.
 */
const stripUndefined = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(item => stripUndefined(item));
    } else if (obj !== null && typeof obj === 'object') {
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
            const val = obj[key];
            if (val !== undefined) {
                cleaned[key] = stripUndefined(val);
            }
        });
        return cleaned;
    }
    return obj;
};

/**
 * Listens to multiple Firestore documents and reconstructs the state.
 */
export const subscribeToState = (
    onUpdate: (data: Partial<PersistedState>) => void,
    onError?: (error: any) => void
) => {
    if (!db) return () => {};

    // Keep track of all parts across multiple buckets
    const parts: Record<string, any> = {};
    const unsubs: (() => void)[] = [];
    
    // Total capacity = 40 chunks * 500 = 20,000 items
    const docIds = [CONFIG_DOC_ID];
    for (let i = 0; i < MAX_SHARDS; i++) {
        docIds.push(`${BOOKINGS_PREFIX}${i}`);
        docIds.push(`${NOTIFICATIONS_PREFIX}${i}`);
    }

    const emitUpdate = () => {
        let allBookings: any[] = [];
        let allNotifications: any[] = [];
        let configProps: any = {};

        // Merge config
        if (parts[CONFIG_DOC_ID]) {
            configProps = { ...parts[CONFIG_DOC_ID] };
        }

        // Reassemble bookings and notifications in order
        for (let i = 0; i < MAX_SHARDS; i++) {
            const bPart = parts[`${BOOKINGS_PREFIX}${i}`];
            if (bPart && Array.isArray(bPart.chunk)) {
                allBookings = [...allBookings, ...bPart.chunk];
            }
            const nPart = parts[`${NOTIFICATIONS_PREFIX}${i}`];
            if (nPart && Array.isArray(nPart.chunk)) {
                allNotifications = [...allNotifications, ...nPart.chunk];
            }
        }

        const finalState: Partial<PersistedState> = {
            ...configProps,
            allBookings,
            notifications: allNotifications
        };

        onUpdate(finalState);
    };

    docIds.forEach(id => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const unsub = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                parts[id] = snap.data();
            } else {
                delete parts[id];
            }
            emitUpdate();
        }, (err) => {
            if (id === CONFIG_DOC_ID) {
                console.error("Firebase Sync Error:", err);
                if (onError) onError(err);
            }
        });
        unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
};

/**
 * Saves specific fields of the app state to Firestore with chunking support via Batched Writes.
 * Optimized to avoid "Request payload size exceeds the limit" error by splitting into smaller batches.
 */
export const saveStateToFirebase = async (partialState: Partial<PersistedState>) => {
    if (!db) return;

    try {
        const cleanedState = stripUndefined(partialState);
        const { allBookings, notifications, ...rest } = cleanedState;
        
        const ops: { ref: any, data: any }[] = [];

        // 1. Prepare Metadata updates
        if (Object.keys(rest).length > 0) {
            ops.push({ 
                ref: doc(db, COLLECTION_NAME, CONFIG_DOC_ID), 
                data: rest 
            });
        }

        // 2. Prepare Sharded Bookings
        if (allBookings !== undefined && Array.isArray(allBookings)) {
            const neededShards = Math.max(1, Math.ceil(allBookings.length / ITEMS_PER_CHUNK));
            for (let i = 0; i < MAX_SHARDS; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${BOOKINGS_PREFIX}${i}`);
                if (i < neededShards) {
                    const chunk = allBookings.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                    ops.push({ ref: docRef, data: { chunk } });
                } else {
                    // Always clear unused shards to prevent stale data leaking from previous larger saves
                    ops.push({ ref: docRef, data: { chunk: [] } });
                }
            }
        }

        // 3. Prepare Sharded Notifications
        if (notifications !== undefined && Array.isArray(notifications)) {
            const neededShards = Math.max(1, Math.ceil(notifications.length / ITEMS_PER_CHUNK));
            for (let i = 0; i < MAX_SHARDS; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${NOTIFICATIONS_PREFIX}${i}`);
                if (i < neededShards) {
                    const chunk = notifications.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                    ops.push({ ref: docRef, data: { chunk } });
                } else {
                    ops.push({ ref: docRef, data: { chunk: [] } });
                }
            }
        }

        if (ops.length === 0) return;

        // 4. Commit operations in multiple small batches
        // Each batch will contain max 5 documents to stay under the 10MB payload size limit 
        // (assuming each document could be up to 1MB)
        const BATCH_SIZE_DOCS = 5;
        for (let i = 0; i < ops.length; i += BATCH_SIZE_DOCS) {
            const currentBatch = writeBatch(db);
            const chunk = ops.slice(i, i + BATCH_SIZE_DOCS);
            
            chunk.forEach(op => {
                // If it's the config doc, we merge. Otherwise we overwrite chunks.
                if (op.ref.id === CONFIG_DOC_ID) {
                    currentBatch.set(op.ref, op.data, { merge: true });
                } else {
                    currentBatch.set(op.ref, op.data, { merge: false });
                }
            });
            
            await currentBatch.commit();
        }

    } catch (e) {
        console.error("Failed to sync state to cloud:", e);
    }
};
