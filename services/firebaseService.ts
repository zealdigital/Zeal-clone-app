
import { db } from '../firebaseConfig';
import { doc, onSnapshot, writeBatch,getFirestore, collection, getDocs } from 'firebase/firestore';
import type { PersistedState } from '../types';


const COLLECTION_NAME = 'app_data';
const CONFIG_DOC_ID = 'globalState';
const BOOKINGS_PREFIX = 'bookings_part_';
const NOTIFICATIONS_PREFIX = 'notifications_part_';
const MAX_SHARDS = 300;
const ITEMS_PER_CHUNK = 100;

const db = getFirestore(app);
/**
 * Deletes all booking documents from Firebase Firestore
 * This permanently removes the data from the cloud
 */
export const deleteAllBookingsFromFirebase = async (): Promise<{ success: boolean, count: number }> => {
    try {
        const bookingsRef = collection(db, 'bookings');
        const snapshot = await getDocs(bookingsRef);
        
        if (snapshot.empty) {
            return { success: true, count: 0 };
        }
        
        // Firestore batches can only delete 500 documents at once
        const batches = [];
        let currentBatch = writeBatch(db);
        let operationCount = 0;
        let deletedCount = 0;
        
        for (const doc of snapshot.docs) {
            currentBatch.delete(doc.ref);
            operationCount++;
            deletedCount++;
            
            if (operationCount === 500) {
                batches.push(currentBatch.commit());
                currentBatch = writeBatch(db);
                operationCount = 0;
            }
        }
        
        if (operationCount > 0) {
            batches.push(currentBatch.commit());
        }
        
        await Promise.all(batches);
        return { success: true, count: deletedCount };
        
    } catch (error) {
        console.error('Error deleting bookings from Firebase:', error);
        throw error;
    }
};


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
        }, 500); // Increased debounce for large data sets
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
let onSyncStatusChange: ((isSaving: boolean) => void) | null = null;

export const subscribeToSyncStatus = (callback: (isSaving: boolean) => void) => {
    onSyncStatusChange = callback;
    return () => { onSyncStatusChange = null; };
};

const setIsSaving = (val: boolean) => {
    isSaving = val;
    if (onSyncStatusChange) onSyncStatusChange(val);
};

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
    setIsSaving(true);

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
        setIsSaving(false);
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
                try {
                    await currentBatch.commit();
                    // Increased delay and smaller batches to prevent resource exhaustion
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (err: any) {
                    if (err?.code === 'resource-exhausted' || err?.message?.includes('stream exhausted')) {
                        console.warn("Resource exhausted, waiting for cooldown...");
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        await currentBatch.commit();
                    } else {
                        throw err;
                    }
                }
                currentBatch = writeBatch(db);
                batchCount = 0;
            }
        };

        // Handle chunking for Bookings
        if (allBookings !== undefined && Array.isArray(allBookings)) {
            const neededShards = Math.ceil(allBookings.length / ITEMS_PER_CHUNK);
            // We only need to clear if the previous save was larger, but we don't know for sure
            // To be safe but efficient, we'll only delete shards if the total count is being reduced
            // However, without state, we must still loop. We'll reduce the batch size.
            
            for (let i = 0; i < MAX_SHARDS; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${BOOKINGS_PREFIX}${i}`);
                if (i < neededShards) {
                    const chunk = allBookings.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                    if (chunk.length > 0) {
                        currentBatch.set(docRef, { chunk }, { merge: false });
                        batchCount++;
                    }
                } else {
                    // If we are resetting (empty array), or if we have extra shards, clean them up
                    // We clean up at least 50 extra shards per save to eventually reach a clean state
                    if (allBookings.length === 0 || i < (neededShards + 50)) { 
                        currentBatch.delete(docRef);
                        batchCount++;
                    }
                }

                if (batchCount >= 10) { // Batch size 10 is safe for 100-item chunks (~1-2MB total)
                    await commitBatch();
                }
            }
        }

        // Handle chunking for Notifications
        if (notifications !== undefined && Array.isArray(notifications)) {
            const neededShards = Math.ceil(notifications.length / ITEMS_PER_CHUNK);
            
            for (let i = 0; i < MAX_SHARDS; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${NOTIFICATIONS_PREFIX}${i}`);
                if (i < neededShards) {
                    const chunk = notifications.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                    if (chunk.length > 0) {
                        currentBatch.set(docRef, { chunk }, { merge: false });
                        batchCount++;
                    }
                } else {
                    if (notifications.length === 0 || i < (neededShards + 50)) {
                        currentBatch.delete(docRef);
                        batchCount++;
                    }
                }

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
