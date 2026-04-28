
import { db } from '../firebaseConfig';
import { doc, onSnapshot, writeBatch } from 'firebase/firestore';
import type { PersistedState } from '../types';

const COLLECTION_NAME = 'app_data';
const CONFIG_DOC_ID = 'globalState';
const BOOKINGS_PREFIX = 'bookings_part_';
const NOTIFICATIONS_PREFIX = 'notifications_part_';
const MAX_SHARDS = 50;

// Threshold for chunking (roughly 800KB worth of items to stay safe)
// We'll use a conservative number of items per chunk based on typical lead size
const ITEMS_PER_CHUNK = 400;

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

    // Keep track of all parts
    const parts: Record<string, any> = {};
    const unsubs: (() => void)[] = [];
    
    // We listen to the main config and a larger number of potential parts 
    // 50 parts @ 400 items = 20,000 capacity
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

        // Reassemble bookings
        for (let i = 0; i < MAX_SHARDS; i++) {
            const part = parts[`${BOOKINGS_PREFIX}${i}`];
            if (part && Array.isArray(part.chunk)) {
                allBookings = allBookings.concat(part.chunk);
            }
            const nPart = parts[`${NOTIFICATIONS_PREFIX}${i}`];
            if (nPart && Array.isArray(nPart.chunk)) {
                allNotifications = allNotifications.concat(nPart.chunk);
            }
        }

        const finalState: Partial<PersistedState> = {
            ...configProps,
            allBookings: allBookings.length > 0 ? allBookings : (configProps.allBookings || []),
            notifications: allNotifications.length > 0 ? allNotifications : (configProps.notifications || [])
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
 */
export const saveStateToFirebase = async (partialState: Partial<PersistedState>) => {
    if (!db) return;

    try {
        const batch = writeBatch(db);
        const cleanedState = stripUndefined(partialState);
        const { allBookings, notifications, ...rest } = cleanedState;
        let batchCount = 0;

        // Handle chunking for Bookings
        if (allBookings !== undefined && Array.isArray(allBookings)) {
            // Determine how many shards we actually need to write
            const neededShards = Math.max(1, Math.ceil(allBookings.length / ITEMS_PER_CHUNK));
            
            for (let i = 0; i < MAX_SHARDS; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${BOOKINGS_PREFIX}${i}`);
                if (i < neededShards) {
                    const chunk = allBookings.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                    batch.set(docRef, { chunk }, { merge: false });
                    batchCount++;
                } else if (i === 0 && allBookings.length === 0) {
                    // Just safety for index 0 if empty
                    batch.set(docRef, { chunk: [] }, { merge: false });
                    batchCount++;
                }
                // We don't overwrite every other shard unless we have a "delete" pattern
                // In this simplified sharded system, we assume shards beyond 'needed' are legacy or empty
            }
        }

        // Handle chunking for Notifications
        if (notifications !== undefined && Array.isArray(notifications)) {
            const neededShards = Math.max(1, Math.ceil(notifications.length / ITEMS_PER_CHUNK));
            
            for (let i = 0; i < MAX_SHARDS; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${NOTIFICATIONS_PREFIX}${i}`);
                if (i < neededShards) {
                    const chunk = notifications.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                    batch.set(docRef, { chunk }, { merge: false });
                    batchCount++;
                } else if (i === 0 && notifications.length === 0) {
                    batch.set(docRef, { chunk: [] }, { merge: false });
                    batchCount++;
                }
            }
        }

        // Save metadata/config
        if (Object.keys(rest).length > 0) {
            const configDocRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
            batch.set(configDocRef, rest, { merge: true });
            batchCount++;
        }

        if (batchCount > 0) {
            await batch.commit();
        }
    } catch (e) {
        console.error("Failed to sync state to cloud:", e);
    }
};
