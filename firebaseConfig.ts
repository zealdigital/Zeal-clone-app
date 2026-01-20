
import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Updated configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyD6hKThovoSy58Q9iL9zTdnlz_QFqBW2Vc",
  authDomain: "zeal-401fd.firebaseapp.com",
  projectId: "zeal-401fd",
  storageBucket: "zeal-401fd.firebasestorage.app",
  messagingSenderId: "206668972996",
  appId: "1:206668972996:web:57f89b0a973a2260e95a91"
};

// Safety Check: Detect if the user hasn't updated the config yet.
export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app;
let db: Firestore | undefined;
let auth: Auth | undefined;

if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        console.log("Firebase initialized successfully.");
    } catch (error) {
        console.error("Firebase Initialization Error:", error);
    }
} else {
    console.warn("Firebase is NOT configured. The app will run in offline mode (LocalStorage only). Please update firebaseConfig.ts.");
}

export { db, auth };
