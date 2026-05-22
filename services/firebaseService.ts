import { db } from '../firebaseConfig';
import { doc, onSnapshot, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import type { PersistedState, Booking } from '../types';

const COLLECTION_NAME = 'app_data';
const CONFIG_DOC_ID = 'globalState';
const BOOKINGS_PREFIX = 'bookings_part_';
const NOTIFICATIONS_PREFIX = 'notifications_part_';
const MAX_SHARDS = 300;
const ITEMS_PER_CHUNK = 100;

// Throttling variables to prevent "Write stream exhausted"
let lastWriteTime = 0;
const MIN_WRITE_INTERVAL = 200; // milliseconds between writes
let pendingSaveTimeout: ReturnType<typeof setTimeout> | null = null;
let queuedPartialState: Partial<PersistedState> | null = null;

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
 * Find which shard a booking belongs to based on its ID
 */
const getShardIndexForBooking = (bookingId: number): number => {
    return Math.floor(bookingId / ITEMS_PER_CHUNK) % MAX_SHARDS;
};

/**
 * Save a single booking directly to its shard (incremental update)
 * This is MUCH faster than rewriting all shards
 */
export const saveSingleBookingToFirebase = async (booking: Booking): Promise<boolean> => {
    if (!db) return false;
    
    try {
        // Throttle writes to prevent rate limiting
        const now = Date.now();
        const timeSinceLastWrite = now - lastWriteTime;
        if (timeSinceLastWrite < MIN_WRITE_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, MIN_WRITE_INTERVAL - timeSinceLastWrite));
        }
        
        const shardIndex = getShardIndexForBooking(booking.id);
        const shardId = `${BOOKINGS_PREFIX}${shardIndex}`;
        const shardRef = doc(db, COLLECTION_NAME, shardId);
        
        // Read current shard
        const shardSnap = await getDoc(shardRef);
        let chunk: Booking[] = shardSnap.exists() ? shardSnap.data().chunk : [];
        
        // Find and update or append the booking
        const existingIndex = chunk.findIndex((b: Booking) => b.id === booking.id);
        if (existingIndex >= 0) {
            chunk[existingIndex] = booking;
        } else {
            chunk.push(booking);
        }
        
        // Write back only this shard
        await setDoc(shardRef, { chunk }, { merge: true });
        lastWriteTime = Date.now();
        
        return true;
    } catch (error) {
        console.error("Failed to save single booking:", error);
        return false;
    }
};

/**
 * Delete a single booking from its shard
 */
export const deleteSingleBookingFromFirebase = async (bookingId: number): Promise<boolean> => {
    if (!db) return false;
    
    try {
        const shardIndex = getShardIndexForBooking(bookingId);
        const shardId = `${BOOKINGS_PREFIX}${shardIndex}`;
        const shardRef = doc(db, COLLECTION_NAME, shardId);
        
        const shardSnap = await getDoc(shardRef);
        if (!shardSnap.exists()) return false;
        
        let chunk: Booking[] = shardSnap.data().chunk;
        const newChunk = chunk.filter((b: Booking) => b.id !== bookingId);
        
        if (newChunk.length !== chunk.length) {
            await setDoc(shardRef, { chunk: newChunk }, { merge: true });
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("Failed to delete booking:", error);
        return false;
    }
};

/**
 * Listens to multiple Firestore documents and reconstructs the state.
 */
export const subscribeToState = (
    onUpdate: (data: Partial<PersistedState>, isComplete: boolean) => void,
    onError?: (error: any) => void
) => {
    if (!db) return () => {};

    const parts: Record<string, any> = {};
    const receivedIds = new Set<string>();
    const unsubs: (() => void)[] = [];
    
    const docIds = [CONFIG_DOC_ID];
    for (let i = 0; i < MAX_SHARDS; i++) {
        docIds.push(`${BOOKINGS_PREFIX}${i}`);
        docIds.push(`${NOTIFICATIONS_PREFIX}${i}`);
    }

    let debounceTimer: any = null;
    let firstLoadComplete = false;
    
    const emitUpdate = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            let allBookings: any[] = [];
            let allNotifications: any[] = [];
            let configProps: any = {};

            if (parts[CONFIG_DOC_ID]) {
                configProps = { ...parts[CONFIG_DOC_ID] };
            }

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
            
            // Show sync message only during initial load, not on every update
            if (!firstLoadComplete && !isInitialLoadComplete) {
                // Still loading initial data
            } else {
                firstLoadComplete = true;
            }

            const hasShard0 = parts[`${BOOKINGS_PREFIX}0`] !== undefined;
            const reallyEmpty = isInitialLoadComplete && !hasShard0;

            const finalState: Partial<PersistedState> = {
                ...configProps,
                allBookings: (hasShard0 || reallyEmpty) ? allBookings : undefined,
                notifications: (hasShard0 || reallyEmpty) ? allNotifications : undefined
            };

            onUpdate(finalState, isInitialLoadComplete);
        }, 300); // Reduced debounce for better responsiveness
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
 * Optimized to only sync when necessary and with proper throttling.
 */
export const saveStateToFirebase = async (partialState: Partial<PersistedState>) => {
    if (!db) return;

    // Merge partial state into pending updates
    if (!pendingUpdates) {
        pendingUpdates = { ...partialState };
    } else {
        Object.keys(partialState).forEach(key => {
            const k = key as keyof PersistedState;
            (pendingUpdates as any)[k] = partialState[k];
        });
    }

    // Debounce save to avoid excessive writes
    if (pendingSaveTimeout) {
        clearTimeout(pendingSaveTimeout);
    }
    
    pendingSaveTimeout = setTimeout(async () => {
        if (!pendingUpdates) return;
        
        if (isSaving) {
            // Wait for current save to finish
            const checkInterval = setInterval(() => {
                if (!isSaving) {
                    clearInterval(checkInterval);
                    performQueuedSave();
                }
            }, 100);
            return;
        }
        
        await performQueuedSave();
    }, 500);
    
    async function performQueuedSave() {
        const stateToSave = { ...pendingUpdates! };
        pendingUpdates = null;
        
        setIsSaving(true);
        try {
            await performSave(stateToSave);
        } catch (e) {
            console.error("Critical Sync Loop Error:", e);
        } finally {
            setIsSaving(false);
        }
    }
};

// Throttling for batch commits
let batchCommitQueue: Promise<void> = Promise.resolve();

const performSave = async (partialState: Partial<PersistedState>) => {
    try {
        const cleanedState = stripUndefined(partialState);
        const { allBookings, notifications, ...rest } = cleanedState;
        
        // Throttle writes to prevent rate limiting
        const now = Date.now();
        const timeSinceLastWrite = now - lastWriteTime;
        if (timeSinceLastWrite < MIN_WRITE_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, MIN_WRITE_INTERVAL - timeSinceLastWrite));
        }
        
        let currentBatch = writeBatch(db);
        let batchCount = 0;

        const commitBatch = async () => {
            if (batchCount > 0) {
                await batchCommitQueue;
                batchCommitQueue = currentBatch.commit().catch(async (err: any) => {
                    if (err?.code === 'resource-exhausted' || err?.message?.includes('stream exhausted')) {
                        console.warn("Resource exhausted, waiting for cooldown...");
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        return currentBatch.commit();
                    }
                    throw err;
                });
                await batchCommitQueue;
                
                currentBatch = writeBatch(db);
                batchCount = 0;
                lastWriteTime = Date.now();
            }
        };

        // Handle chunking for Bookings - ONLY update shards that actually changed
        if (allBookings !== undefined && Array.isArray(allBookings)) {
            const neededShards = Math.ceil(allBookings.length / ITEMS_PER_CHUNK);
            
            // Track which shards we've processed to avoid duplicate work
            const processedShards = new Set<number>();
            
            for (let i = 0; i < neededShards; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${BOOKINGS_PREFIX}${i}`);
                const chunk = allBookings.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                if (chunk.length > 0) {
                    currentBatch.set(docRef, { chunk }, { merge: false });
                    batchCount++;
                    processedShards.add(i);
                }
                
                if (batchCount >= 8) { // Slightly smaller batch size for better performance
                    await commitBatch();
                }
            }
            
            // Clean up extra shards that are no longer needed
            for (let i = neededShards; i < MAX_SHARDS; i++) {
                if (processedShards.has(i)) continue;
                const docRef = doc(db, COLLECTION_NAME, `${BOOKINGS_PREFIX}${i}`);
                currentBatch.delete(docRef);
                batchCount++;
                processedShards.add(i);
                
                if (batchCount >= 8) {
                    await commitBatch();
                }
            }
        }

        // Handle chunking for Notifications - similar optimization
        if (notifications !== undefined && Array.isArray(notifications)) {
            const neededShards = Math.ceil(notifications.length / ITEMS_PER_CHUNK);
            
            for (let i = 0; i < neededShards; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${NOTIFICATIONS_PREFIX}${i}`);
                const chunk = notifications.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
                if (chunk.length > 0) {
                    currentBatch.set(docRef, { chunk }, { merge: false });
                    batchCount++;
                }
                
                if (batchCount >= 8) {
                    await commitBatch();
                }
            }
            
            for (let i = neededShards; i < MAX_SHARDS; i++) {
                const docRef = doc(db, COLLECTION_NAME, `${NOTIFICATIONS_PREFIX}${i}`);
                currentBatch.delete(docRef);
                batchCount++;
                
                if (batchCount >= 8) {
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
        lastWriteTime = Date.now();
        
    } catch (e) {
        console.error("Failed to sync state to cloud:", e);
        throw e;
    }
};
