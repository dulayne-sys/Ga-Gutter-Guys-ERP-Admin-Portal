import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebasePublicDefaults = {
  apiKey: "AIzaSyDRPwKIZA6owdYWyRprF1k2gfiyXnhyvkw",
  authDomain: "ga-gutter-guys-admin.firebaseapp.com",
  projectId: "ga-gutter-guys-admin",
  storageBucket: "ga-gutter-guys-admin.firebasestorage.app",
  messagingSenderId: "733578728575",
  appId: "1:733578728575:web:ec94a0ef068a80ea095b4a",
} as const;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? firebasePublicDefaults.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? firebasePublicDefaults.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? firebasePublicDefaults.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? firebasePublicDefaults.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? firebasePublicDefaults.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? firebasePublicDefaults.appId,
};

const isBrowser = typeof window !== "undefined";
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const canInit = isBrowser && missingKeys.length === 0;

if (isBrowser && missingKeys.length > 0) {
  throw new Error(
    `Missing Firebase env vars: ${missingKeys.join(", ")}. Check NEXT_PUBLIC_FIREBASE_* in .env.local.`
  );
}

const app = canInit
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null;
export const firestore = app ? getFirestore(app) : null;
const functionsRegion = process.env.NEXT_PUBLIC_FUNCTIONS_REGION || "us-east1";
export const functions = app ? getFunctions(app, functionsRegion) : null;
