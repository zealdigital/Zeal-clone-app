import { db } from '../firebaseConfig';
import { doc, onSnapshot, writeBatch, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import type { PersistedState, Booking } from '../types';

const COLLECTION_NAME = 'app_data';
const CONFIG_DOC_ID = 'globalState';
const BOOKINGS_PREFIX = 'bookings_part_';
const NOTIFICATIONS_PREFIX = 'notifications_part_';

// ✅ FIX: Reduced from 300 to 50.
// Booking IDs are Date.now() timestamps (~1718000000000).
// getShardIndexForBooking = Math.floor(id / 100) % MAX_SHARDS
// So with MAX_SHARDS=50, shard spread is 0..49 — all reachable.
// With MAX_SHARDS=300, shard 0 is almost NEVER written (only if id < 100),
// which caused the hasShard0 guard to block all bookings from rendering.
const MAX_SHARDS = 50;
const ITEMS_PER_CHUNK = 100;

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
 * ✅ KEY FIX for "active leads not showing":
 *
 * ROOT CAUSE: The old code used `hasShard0` as a guard:
 *   allBookings: (hasShard0 || reallyEmpty) ? allBookings : undefined
 *
 * Booking IDs are Date.now() timestamps (~1718000000000).
 * getShardIndexForBooking(1718000000000) = Math.floor(17180000000) % 300 = 200
 * So ALL real bookings land on shards 0..49 when MAX_SHARDS=50,
 * but with MAX_SHARDS=300 they land on shards like 187, 200, 233 — never shard 0.
 * hasShard0 was therefore always false, and allBookings was always undefined.
 *
 * FIX: Remove the hasShard0 guard entirely. Instead:
 * - Use getDocs() once to discover which shard docs actually exist.
 * - Only subscribe to those docs + the config doc.
 * - Mark isComplete once all subscribed docs have responded.
 * - Always pass allBookings (even if empty array) once complete.
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
  let subscribedDocIds: string[] = [];

  const emitUpdate = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      let allBookings: any[] = [];
      let allNotifications: any[] = [];
      let configProps: any = {};

      if (parts[CONFIG_DOC_ID]) {
        configProps = { ...parts[CONFIG_DOC_ID] };
      }

      // Collect from all known shard docs
      Object.keys(parts).forEach(key => {
        if (key.startsWith(BOOKINGS_PREFIX) && Array.isArray(parts[key]?.chunk)) {
          allBookings = allBookings.concat(parts[key].chunk);
        }
        if (key.startsWith(NOTIFICATIONS_PREFIX) && Array.isArray(parts[key]?.chunk)) {
          allNotifications = allNotifications.concat(parts[key].chunk);
        }
      });

      // ✅ isComplete = all subscribed docs have reported back at least once
      const isComplete = subscribedDocIds.length > 0 &&
        receivedIds.size >= subscribedDocIds.length;

      const finalState: Partial<PersistedState> = {
        ...configProps,
        // ✅ Always pass arrays once complete — no more hasShard0 guard
        allBookings: isComplete ? allBookings : undefined,
        notifications: isComplete ? allNotifications : undefined,
      };

      onUpdate(finalState, isComplete);
    }, 800);
  };

  const openListeners = (docIds: string[]) => {
    subscribedDocIds = docIds;
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

  // Discover which shard documents actually exist, then only subscribe to those.
  // This replaces opening 300+ listeners blindly.
  (async () => {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const snap = await getDocs(colRef);
      const existingDocIds: Set<string> = new Set([CONFIG_DOC_ID]);

      snap.forEach(d => {
        const id = d.id;
        if (
          (id.startsWith(BOOKINGS_PREFIX) || id.startsWith(NOTIFICATIONS_PREFIX)) &&
          id !== CONFIG_DOC_ID
        ) {
          existingDocIds.add(id);
        }
      });

      openListeners(Array.from(existingDocIds));
    } catch (err) {
      console.warn("Could not pre-scan shards, subscribing to config only:", err);
      // Safe fallback: at minimum get the config and mark complete
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
  }, 1000);

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

    if (allBookings !== undefined && Array.isArray(allBookings)) {
      const neededShards = Math.min(
        Math.ceil(allBookings.length / ITEMS_PER_CHUNK),
        MAX_SHARDS
      );
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
      const neededShards = Math.min(
        Math.ceil(notifications.length / ITEMS_PER_CHUNK),
        MAX_SHARDS
      );
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
