import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

/* Hardcoded fallback config — env vars take precedence when available */
const env = (key: string, fallback: string): string =>
  (process.env[key] ?? "").trim() || fallback;

const firebaseConfig = {
  apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY", "AIzaSyB_Ix6wZi_7pRAHKUr1cUEBgAyKz1JuLU4"),
  authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "ga-gutter-guys-admin.firebaseapp.com"),
  projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "ga-gutter-guys-admin"),
  storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "ga-gutter-guys-admin.firebasestorage.app"),
  messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "733578728575"),
  appId: env("NEXT_PUBLIC_FIREBASE_APP_ID", "1:733578728575:web:ec94a0ef068a80ea095b4a"),
  measurementId: env("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", "G-RS4D30EYJT"),
};

const isBrowser = typeof window !== "undefined";

const app = isBrowser
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null;
export const firestore = app ? getFirestore(app) : null;
const functionsRegion = env("NEXT_PUBLIC_FUNCTIONS_REGION", "us-east1");
export const functions = app ? getFunctions(app, functionsRegion) : null;
