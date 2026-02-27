/* eslint-disable */
// Run from Cloud Shell: node scripts/bootstrap-users.js
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const USERS = [
  { email: "admin@gagutterguys.com", role: "admin", displayName: "GA Admin" },
  { email: "dulayne@hitfluenctech.com", role: "admin", displayName: "Dulayne" },
];

async function main() {
  for (const u of USERS) {
    try {
      // Look up existing Firebase Auth user by email
      const record = await auth.getUserByEmail(u.email);
      const data = {
        email: u.email,
        role: u.role,
        displayName: record.displayName || u.displayName,
        photoURL: record.photoURL || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection("users").doc(record.uid).set(data, { merge: true });
      console.log(`✔ Created user doc for ${u.email} (uid: ${record.uid}, role: ${u.role})`);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // User doesn't exist in Auth yet — create them
        const newUser = await auth.createUser({
          email: u.email,
          displayName: u.displayName,
          password: "ChangeMeNow123!",
        });
        await db.collection("users").doc(newUser.uid).set({
          email: u.email,
          role: u.role,
          displayName: u.displayName,
          photoURL: "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✔ Created NEW Auth user + Firestore doc for ${u.email} (uid: ${newUser.uid}, role: ${u.role})`);
        console.log(`  ⚠ Temporary password: ChangeMeNow123! — please reset via Firebase Console`);
      } else {
        console.error(`✘ Failed for ${u.email}:`, err.message);
      }
    }
  }
}

main().then(() => { console.log("\nDone."); process.exit(0); });
