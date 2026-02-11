const isBrowser = typeof window !== "undefined";

const requiredFirebaseVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const missingFirebaseVars = requiredFirebaseVars.filter((key) => !process.env[key]);

if (isBrowser && missingFirebaseVars.length > 0) {
  throw new Error(`Missing Firebase env vars: ${missingFirebaseVars.join(", ")}.`);
}

export const FUNCTIONS_REGION = process.env.NEXT_PUBLIC_FUNCTIONS_REGION || "us-east1";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const envBaseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL ?? "";

export const FUNCTIONS_BASE_URL = envBaseUrl
  || (projectId ? `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net` : "");
