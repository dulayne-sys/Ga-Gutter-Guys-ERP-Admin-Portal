import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDRPwKIZA6owdYWyRprF1k2gfiyXnhyvkw",
  authDomain: "ga-gutter-guys-admin.firebaseapp.com",
  projectId: "ga-gutter-guys-admin",
  storageBucket: "ga-gutter-guys-admin.firebasestorage.app",
  messagingSenderId: "733578728575",
  appId: "1:733578728575:web:ec94a0ef068a80ea095b4a",
  measurementId: "G-RS4D30EYJT"
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
