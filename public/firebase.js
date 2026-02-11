export const waitForFirebase = () => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.firebase && typeof window.firebase.auth === "function") {
        clearInterval(timer);
        resolve(window.firebase);
        return;
      }

      if (Date.now() - start > 10000) {
        clearInterval(timer);
        reject(new Error("Firebase SDK not ready"));
      }
    }, 50);
  });
};
