import { initializeApp, getApps } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getFunctions } from "firebase/functions"

const firebasePublicDefaults = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyDRPwKIZA6owdYWyRprF1k2gfiyXnhyvkw",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "ga-gutter-guys-admin.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "ga-gutter-guys-admin",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "ga-gutter-guys-admin.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "733578728575",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:733578728575:web:ec94a0ef068a80ea095b4a",
} as const

const readEnv = (key: keyof typeof firebasePublicDefaults): string => {
  return (process.env[key] || firebasePublicDefaults[key]).trim()
}

const firebaseConfig = {
  apiKey: readEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
}

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)

export const functions = getFunctions(
  app,
  process.env.NEXT_PUBLIC_FUNCTIONS_REGION || "us-east1"
)