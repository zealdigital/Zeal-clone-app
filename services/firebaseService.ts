
import { db } from '../firebaseConfig';
import { doc, onSnapshot, writeBatch } from 'firebase/firestore';
import type { PersistedState } from '../types';

const COLLECTION_NAME = 'app_data';
const CONFIG_DOC_ID = 'globalState';
const BOOKINGS_PREFIX = 'bookings_part_';
const NOTIFICATIONS_PREFIX = 'notifications_part_';
const MAX_SHARDS = 150;
const ITEMS_PER_CHUNK = 200;

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
    onUpdate: (data: Partial<PersistedState>, isComplete: boolean) => void,
    onError?: (error: any) => void
) => {
    if (!db) return () => {};

    // Keep track of all parts
    const parts: Record<string, any> = {};
    const receivedIds = new Set<string>();
    const unsubs: (() => void)[] = [];
    
    // We listen to the main config and a larger number of potential parts 
    const docIds = [CONFIG_DOC_ID];
    for (let i = 0; i < MAX_SHARDS; i++) {
        docIds.push(`${BOOKINGS_PREFIX}${i}`);
        docIds.push(`${NOTIFICATIONS_PREFIX}${i}`);
    }

    let debounceTimer: any = null;
    const emitUpdate = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            let allBookings: any[] = [];
            let allNotifications: any[] = [];
            let configProps: any = {};

            // Merge config
            if (parts[CONFIG_DOC_ID]) {
                configProps = { ...parts[CONFIG_DOC_ID] };
            }

            // Reassemble bookings in correct order
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

            const isInitialLoadComplete = receivedIds.size >= docIds.length;
            
            // Only report allBookings if we have shard 0 OR we are done loading and it truly doesn't exist
            const hasShard0 = parts[`${BOOKINGS_PREFIX}0`] !== undefined;
            const reallyEmpty = isInitialLoadComplete && !hasShard0;

            const finalState: Partial<PersistedState> = {
                ...configProps,
                allBookings: (hasShard0 || reallyEmpty) ? allBookings : undefined,
                notifications: (hasShard0 || reallyEmpty) ? allNotifications : undefined
            };

            onUpdate(finalState, isInitialLoadComplete);
        }, 200); // 200ms debounce
    };

    docIds.forEach(id => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const unsub = onSnapshot(docRef, (snap) => {
            receivedIds.add(id);
            if (snap.exists()) {
                parts[id] = snap.data();
            } else {
                delete parts[id];
            }
            emitUpdate();
        }, (err) => {
            receivedIds.add(id);
            if (id === CONFIG_DOC_ID) {
                console.error("Firebase Sync Error:", err);
                if (onError) onError(err);
            }
            emitUpdate();
        });
        unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
};

let isSaving = false;
let pendingUpdates: Partial<PersistedState> | null = null;

/**
 * Saves specific fields of the app state to Firestore with chunking support via Batched Writes.
 * Uses multiple batches if necessary to stay under Firestore limits.
 * Implements a queue and delays to prevent "Write stream exhausted" errors.
 */
export const saveStateToFirebase = async (partialState: Partial<PersistedState>) => {
    if (!db) return;

    // Merge partial state into pending updates
    if (!pendingUpdates) {
        pendingUpdates = { ...partialState };
    } else {
        // Merge objects carefully
        Object.keys(partialState).forEach(key => {
            const k = key as keyof PersistedState;
            (pendingUpdates as any)[k] = partialState[k];
        });
    }

    if (isSaving) return;
    isSaving = true;

    try {
        while (pendingUpdates) {
            const stateToSave = { ...pendingUpdates };
            pendingUpdates = null;
            await performSave(stateToSave);
            // Heartbeat/yield between full save cycles if there are more updates
            if (pendingUpdates) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    } catch (e) {
        console.error("Critical Sync Loop Error:", e);
    } finally {
        isSaving = false;
    }
};

const performSave = async (partialState: Partial<PersistedState>) => {
    try {
        const cleanedState = stripUndefined(partialState);
        const { allBookings, notifications, ...rest } = cleanedState;
        
        let currentBatch = writeBatch(db);
        let batchCount = 0;

        const commitBatch = async () => {
            if (batchCount > 0) {
                await currentBatch.commit();
                // Mandatory yield to allow the SDK write stream to process
                // Increased delay to prevent "Write stream exhausted"
                await new Promise(resolve => setTimeout(resolve, 800));
                currentBatch = writeBatch(db);
                batchCount = 0;
            }
        };

        // Handle chunking for Bookings
        if (allBookings !== undefined && Array.isArray(allBookings)) {
            const neededShards = Math.max(1, Math.ceil(allBookings.length / ITEMS_PER_CHUNK));
            
            for (let i = 0; i < MAX_SHARDS; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${BOOKINGS_PREFIX}${i}`);
                if (i < neededShards) {
                    const chunk = allBookings.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                    currentBatch.set(docRef, { chunk }, { merge: false });
                } else {
                    currentBatch.delete(docRef);
                }
                batchCount++;

                if (batchCount >= 10) { // Reduced to 10 for extra safety and to stay under stream limits
                    await commitBatch();
                }
            }
        }

        // Handle chunking for Notifications
        if (notifications !== undefined && Array.isArray(notifications)) {
            const neededShards = Math.max(1, Math.ceil(notifications.length / ITEMS_PER_CHUNK));
            
            for (let i = 0; i < MAX_SHARDS; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${NOTIFICATIONS_PREFIX}${i}`);
                if (i < neededShards) {
                    const chunk = notifications.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                    currentBatch.set(docRef, { chunk }, { merge: false });
                } else {
                    currentBatch.delete(docRef);
                }
                batchCount++;

                if (batchCount >= 10) {
                    await commitBatch();
                }
            }
        }

        // Save metadata/config
        if (Object.keys(rest).length > 0) {
            const configDocRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
            currentBatch.set(configDocRef, rest, { merge: true });
            batchCount++;
        }

        // Final commit
        await commitBatch();
    } catch (e) {
        console.error("Failed to sync state to cloud:", e);
        throw e; // Rethrow to let the loop handle it
    }
};
