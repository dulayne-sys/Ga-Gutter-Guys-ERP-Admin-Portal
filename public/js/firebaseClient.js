import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged as onAuthStateChangedCore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const firebaseConfig = window.__FIREBASE_CONFIG__ || {};
const requiredKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  console.error("Missing Firebase config keys:", missingKeys.join(", "));
}

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
const functionsRegion = window.__FUNCTIONS_REGION__ || "us-east1";
export const functions = getFunctions(app, functionsRegion);

export const onAuthStateChanged = (handler) => onAuthStateChangedCore(auth, handler);

export const getIdToken = async () => {
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
};
