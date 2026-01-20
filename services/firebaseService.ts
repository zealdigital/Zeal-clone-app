
import { db } from '../firebaseConfig';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import type { PersistedState } from '../types';

const DOC_ID = 'globalState';
const COLLECTION_NAME = 'app_data';

/**
 * Listens to the global Firestore document and triggers a callback on every change.
 * This is the heart of the real-time multi-user synchronization.
 */
export const subscribeToState = (
    onUpdate: (data: Partial<PersistedState>) => void,
    onError?: (error: any) => void
) => {
    if (!db) return () => {};

    const docRef = doc(db, COLLECTION_NAME, DOC_ID);

    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as Partial<PersistedState>;
            onUpdate(data);
        } else {
            // Document doesn't exist yet, return empty object to trigger default initialization
            onUpdate({});
        }
    }, (error) => {
        console.error("Firebase Sync Error:", error);
        if (onError) onError(error);
    });
};

/**
 * Saves the current app state to Firestore.
 * In a multi-user environment, this ensures all clients stay in sync.
 */
export const saveStateToFirebase = async (state: PersistedState) => {
    if (!db) return;

    try {
        const docRef = doc(db, COLLECTION_NAME, DOC_ID);
        // We use setDoc which overwrites. In a high-traffic app, 
        // updateDoc or transactions would be better, but for this portal,
        // setDoc ensures the entire complex object (branding, slots, etc) stays aligned.
        await setDoc(docRef, state, { merge: false });
    } catch (e) {
        console.error("Failed to sync state to cloud:", e);
    }
};
