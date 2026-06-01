import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Ang exact configuration ng SkedLink project mo
const firebaseConfig = {
  apiKey: "AIzaSyAoGhQ84zpQ7gJwpSTrFlc4yeDi9HDE1XU",
  authDomain: "skedlink.firebaseapp.com",
  projectId: "skedlink",
  storageBucket: "skedlink.firebasestorage.app",
  messagingSenderId: "268984963083",
  appId: "1:268984963083:web:90094331c4c380d424770e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// I-export ang Auth (para sa login) at DB (para sa database ng schedule at dorms)
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);