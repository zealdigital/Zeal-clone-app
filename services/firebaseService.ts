
import { db } from '../firebaseConfig';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { PersistedState } from '../types';

const DOC_ID = 'globalState';
const COLLECTION_NAME = 'app_data';

/**
 * Recursively removes any keys with the value of undefined from an object.
 * Firestore does not support 'undefined' as a value, even with merge: true.
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
 * Listens to the global Firestore document and triggers a callback on every change.
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
            onUpdate({});
        }
    }, (error) => {
        console.error("Firebase Sync Error:", error);
        if (onError) onError(error);
    });
};

/**
 * Saves specific fields of the app state to Firestore.
 * This targeted update approach prevents race conditions and significantly 
 * improves performance by reducing payload size.
 */
export const saveStateToFirebase = async (partialState: Partial<PersistedState>) => {
    if (!db) return;

    try {
        const docRef = doc(db, COLLECTION_NAME, DOC_ID);
        // Clean the payload to remove any 'undefined' values that would crash Firestore
        const cleanedState = stripUndefined(partialState);
        // Using merge: true ensures we only overwrite the keys provided in partialState
        await setDoc(docRef, cleanedState, { merge: true });
    } catch (e) {
        console.error("Failed to sync state to cloud:", e);
    }
};
