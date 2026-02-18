const isBrowser = typeof window !== "undefined";

const firebasePublicDefaults = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyDRPwKIZA6owdYWyRprF1k2gfiyXnhyvkw",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "ga-gutter-guys-admin.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "ga-gutter-guys-admin",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "ga-gutter-guys-admin.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "733578728575",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:733578728575:web:ec94a0ef068a80ea095b4a",
} as const;

const requiredFirebaseVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const readFirebaseVar = (key: keyof typeof firebasePublicDefaults): string =>
  (process.env[key] ?? firebasePublicDefaults[key]).trim();

const missingFirebaseVars = requiredFirebaseVars.filter((key) => !readFirebaseVar(key as keyof typeof firebasePublicDefaults));

if (isBrowser && missingFirebaseVars.length > 0) {
  throw new Error(`Missing Firebase env vars: ${missingFirebaseVars.join(", ")}.`);
}

export const FUNCTIONS_REGION = process.env.NEXT_PUBLIC_FUNCTIONS_REGION || "us-east1";
const projectId = readFirebaseVar("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const envBaseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL ?? "";

export const FUNCTIONS_BASE_URL = envBaseUrl
  || (projectId ? `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net` : "");
