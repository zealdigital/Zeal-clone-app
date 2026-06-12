import { db } from '../firebaseConfig';
import {
  doc, onSnapshot, writeBatch, getDoc, setDoc,
  collection, getDocs, query, where
} from 'firebase/firestore';
import type { PersistedState, Booking } from '../types';

const COLLECTION_NAME = 'app_data';
const CONFIG_DOC_ID = 'globalState';
const BOOKINGS_PREFIX = 'bookings_part_';
const NOTIFICATIONS_PREFIX = 'notifications_part_';

// ✅ FIX 1: Reduced from 300 to a realistic max.
// Most apps never exceed 50 shards (= 5000 bookings at 100/shard).
// Raise this if you ever exceed 5000 bookings.
const MAX_SHARDS = 50;
const ITEMS_PER_CHUNK = 100;

// Throttle variables
let lastWriteTime = 0;
const MIN_WRITE_INTERVAL = 300;
let pendingSaveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingUpdates: Partial<PersistedState> | null = null;

const stripUndefined = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(item => stripUndefined(item));
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val !== undefined) cleaned[key] = stripUndefined(val);
    });
    return cleaned;
  }
  return obj;
};

const getShardIndexForBooking = (bookingId: number): number => {
  return Math.floor(bookingId / ITEMS_PER_CHUNK) % MAX_SHARDS;
};

// ✅ FIX 2: saveSingleBookingToFirebase — unchanged, already correct
export const saveSingleBookingToFirebase = async (booking: Booking): Promise<boolean> => {
  if (!db) return false;
  try {
    const now = Date.now();
    const timeSinceLastWrite = now - lastWriteTime;
    if (timeSinceLastWrite < MIN_WRITE_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_WRITE_INTERVAL - timeSinceLastWrite));
    }
    const shardIndex = getShardIndexForBooking(booking.id);
    const shardId = `${BOOKINGS_PREFIX}${shardIndex}`;
    const shardRef = doc(db, COLLECTION_NAME, shardId);
    const shardSnap = await getDoc(shardRef);
    let chunk: Booking[] = shardSnap.exists() ? shardSnap.data().chunk : [];
    const existingIndex = chunk.findIndex((b: Booking) => b.id === booking.id);
    if (existingIndex >= 0) {
      chunk[existingIndex] = booking;
    } else {
      chunk.push(booking);
    }
    await setDoc(shardRef, { chunk }, { merge: true });
    lastWriteTime = Date.now();
    return true;
  } catch (error) {
    console.error("Failed to save single booking:", error);
    return false;
  }
};

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
 * ✅ FIX 3: Smart subscribeToState
 *
 * OLD behaviour: open 601 onSnapshot listeners immediately on ALL shards.
 * NEW behaviour:
 *   1. One-time getDocs on the collection to discover which shard docs actually exist.
 *   2. Only open onSnapshot listeners on docs that exist + the config doc.
 *   3. Debounce increased from 300ms → 800ms so the initial load causes at most
 *      a handful of React renders instead of hundreds.
 *   4. isComplete fires as soon as all KNOWN docs have responded — not after
 *      waiting for all 601 empty docs to time out.
 */
export const subscribeToState = (
  onUpdate: (data: Partial<PersistedState>, isComplete: boolean) => void,
  onError?: (error: any) => void
) => {
  if (!db) return () => {};

  const parts: Record<string, any> = {};
  const receivedIds = new Set<string>();
  const unsubs: (() => void)[] = [];
  let debounceTimer: any = null;
  let expectedIds: string[] = [];
  let firstLoadComplete = false;

  const emitUpdate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    // ✅ FIX 4: Increased debounce from 300ms to 800ms
    // During initial load this prevents React from re-rendering on every arriving shard.
    // For live updates (1-2 docs changing) the 800ms delay is imperceptible.
    debounceTimer = setTimeout(() => {
      let allBookings: any[] = [];
      let allNotifications: any[] = [];
      let configProps: any = {};

      if (parts[CONFIG_DOC_ID]) {
        configProps = { ...parts[CONFIG_DOC_ID] };
      }

      // Reconstruct from shards that actually have data
      Object.keys(parts).forEach(key => {
        if (key.startsWith(BOOKINGS_PREFIX) && Array.isArray(parts[key]?.chunk)) {
          allBookings = allBookings.concat(parts[key].chunk);
        }
        if (key.startsWith(NOTIFICATIONS_PREFIX) && Array.isArray(parts[key]?.chunk)) {
          allNotifications = allNotifications.concat(parts[key].chunk);
        }
      });

      const isInitialLoadComplete = receivedIds.size >= expectedIds.length;

      if (!firstLoadComplete && isInitialLoadComplete) {
        firstLoadComplete = true;
      }

      const finalState: Partial<PersistedState> = {
        ...configProps,
        allBookings: allBookings.length > 0 ? allBookings : (isInitialLoadComplete ? [] : undefined),
        notifications: allNotifications.length > 0 ? allNotifications : (isInitialLoadComplete ? [] : undefined),
      };

      onUpdate(finalState, isInitialLoadComplete);
    }, 800);
  };

  const openListeners = (docIds: string[]) => {
    expectedIds = docIds;
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
  };

  // ✅ FIX 5: Discover which shards actually exist before opening any listeners.
  // This replaces opening 601 listeners blindly.
  (async () => {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snap = await getDocs(colRef);
      const existingDocIds: string[] = [];

      // Always listen to the config doc
      existingDocIds.push(CONFIG_DOC_ID);

      snap.forEach(d => {
        const id = d.id;
        // Only include shard docs within our known range
        if (
          id === CONFIG_DOC_ID ||
          (id.startsWith(BOOKINGS_PREFIX) && parseInt(id.replace(BOOKINGS_PREFIX, '')) < MAX_SHARDS) ||
          (id.startsWith(NOTIFICATIONS_PREFIX) && parseInt(id.replace(NOTIFICATIONS_PREFIX, '')) < MAX_SHARDS)
        ) {
          if (!existingDocIds.includes(id)) {
            existingDocIds.push(id);
          }
        }
      });

      // If no shard docs exist yet (fresh install), still mark as complete
      if (existingDocIds.length === 1) {
        // Only config doc — likely a fresh install, no bookings yet
        openListeners(existingDocIds);
      } else {
        openListeners(existingDocIds);
      }
    } catch (err) {
      console.error("Failed to discover shards, falling back to config-only:", err);
      // Graceful fallback: at minimum listen to the config doc
      openListeners([CONFIG_DOC_ID]);
    }
  })();

  return () => unsubs.forEach(u => u());
};

// ── Sync status ──────────────────────────────────────────────────────────────

let isSaving = false;
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
 * ✅ FIX 6: saveStateToFirebase — debounce increased from 500ms → 1000ms
 * so that rapid sequential updates (e.g. BDM clicking through statuses) are
 * batched into one write instead of firing a Firestore batch per click.
 */
export const saveStateToFirebase = async (partialState: Partial<PersistedState>) => {
  if (!db) return;

  if (!pendingUpdates) {
    pendingUpdates = { ...partialState };
  } else {
    Object.keys(partialState).forEach(key => {
      const k = key as keyof PersistedState;
      (pendingUpdates as any)[k] = partialState[k];
    });
  }

  if (pendingSaveTimeout) clearTimeout(pendingSaveTimeout);

  pendingSaveTimeout = setTimeout(async () => {
    if (!pendingUpdates) return;
    if (isSaving) {
      const checkInterval = setInterval(() => {
        if (!isSaving) {
          clearInterval(checkInterval);
          performQueuedSave();
        }
      }, 100);
      return;
    }
    await performQueuedSave();
  }, 1000); // ✅ increased from 500ms

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

let batchCommitQueue: Promise<void> = Promise.resolve();

const performSave = async (partialState: Partial<PersistedState>) => {
  try {
    const cleanedState = stripUndefined(partialState);
    const { allBookings, notifications, ...rest } = cleanedState;

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

    // ✅ FIX 7: Only write shards that are NEEDED, don't delete up to MAX_SHARDS.
    // The old code would delete shards 0..299 every save — even empty ones.
    // Now we only write shards with data and delete shards beyond neededShards
    // (capped at MAX_SHARDS, not 300).
    if (allBookings !== undefined && Array.isArray(allBookings)) {
      const neededShards = Math.ceil(allBookings.length / ITEMS_PER_CHUNK);
      const processedShards = new Set<number>();

      for (let i = 0; i < neededShards; i++) {
        const docRef = doc(db, COLLECTION_NAME, `${BOOKINGS_PREFIX}${i}`);
        const chunk = allBookings.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
        if (chunk.length > 0) {
          currentBatch.set(docRef, { chunk }, { merge: false });
          batchCount++;
          processedShards.add(i);
        }
        if (batchCount >= 8) await commitBatch();
      }

      // Only clean up shards up to MAX_SHARDS, not 300
      for (let i = neededShards; i < MAX_SHARDS; i++) {
        if (processedShards.has(i)) continue;
        const docRef = doc(db, COLLECTION_NAME, `${BOOKINGS_PREFIX}${i}`);
        currentBatch.delete(docRef);
        batchCount++;
        processedShards.add(i);
        if (batchCount >= 8) await commitBatch();
      }
    }

    if (notifications !== undefined && Array.isArray(notifications)) {
      const neededShards = Math.ceil(notifications.length / ITEMS_PER_CHUNK);
      for (let i = 0; i < neededShards; i++) {
        const docRef = doc(db, COLLECTION_NAME, `${NOTIFICATIONS_PREFIX}${i}`);
        const chunk = notifications.slice(i * ITEMS_PER_CHUNK, (i + 1) * ITEMS_PER_CHUNK);
        if (chunk.length > 0) {
          currentBatch.set(docRef, { chunk }, { merge: false });
          batchCount++;
        }
        if (batchCount >= 8) await commitBatch();
      }
      for (let i = neededShards; i < MAX_SHARDS; i++) {
        const docRef = doc(db, COLLECTION_NAME, `${NOTIFICATIONS_PREFIX}${i}`);
        currentBatch.delete(docRef);
        batchCount++;
        if (batchCount >= 8) await commitBatch();
      }
    }

    if (Object.keys(rest).length > 0) {
      const configDocRef = doc(db, COLLECTION_NAME, CONFIG_DOC_ID);
      currentBatch.set(configDocRef, rest, { merge: true });
      batchCount++;
    }

    await commitBatch();
    lastWriteTime = Date.now();
  } catch (e) {
    console.error("Failed to sync state to cloud:", e);
    throw e;
  }
};
