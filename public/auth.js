import { waitForFirebase } from "./firebase.js";

export async function getToken() {
  const firebase = await waitForFirebase();
  const auth = firebase.auth();

  if (auth.currentUser) {
    return auth.currentUser.getIdToken();
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      if (!user) {
        resolve(null);
        return;
      }

      user.getIdToken().then(resolve).catch(reject);
    }, reject);
  });
}
