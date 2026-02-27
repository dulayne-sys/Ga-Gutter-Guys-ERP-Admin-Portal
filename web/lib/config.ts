/* Hardcoded fallbacks for when Turbopack / Next.js fails to inline NEXT_PUBLIC_ env vars */
const FB_DEFAULTS: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyB_Ix6wZi_7pRAHKUr1cUEBgAyKz1JuLU4",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "ga-gutter-guys-admin.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "ga-gutter-guys-admin",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "ga-gutter-guys-admin.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "733578728575",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:733578728575:web:ec94a0ef068a80ea095b4a",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-RS4D30EYJT",
};

const readEnv = (key: string): string =>
  (process.env[key] ?? "").trim() || FB_DEFAULTS[key] || "";

export const FUNCTIONS_REGION = (process.env.NEXT_PUBLIC_FUNCTIONS_REGION ?? "").trim() || "us-east1";
const projectId = readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const envBaseUrl = (process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL ?? "").trim();

export const FUNCTIONS_BASE_URL = envBaseUrl
  || (projectId ? `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net` : "");
