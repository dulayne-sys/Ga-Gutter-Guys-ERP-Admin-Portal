"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase";
import { TableView } from "../components/TableView";

export default function UsersPage() {
  const [ready, setReady] = useState(false);
  const [noAuth, setNoAuth] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);

  useEffect(() => {
    if (!auth || !firestore) {
      setNoAuth(true);
      return;
    }

    const db = firestore;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setNoAuth(true);
        setReady(true);
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // No user doc — check if this is the very first user in the system
          const usersSnap = await getDocs(query(collection(db, "users"), limit(1)));
          if (usersSnap.empty) {
            // First authenticated user: provision as admin
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email ?? "",
              displayName: user.displayName ?? user.email ?? "",
              role: "admin",
              active: true,
              createdAt: serverTimestamp(),
            });
            setBootstrapMessage(
              "First-run setup complete: admin access has been provisioned for your account."
            );
            // Force TableView to remount so it re-fetches with the new role doc in place
            setTableKey((k) => k + 1);
          }
        }
      } catch {
        // Firestore may deny reads if user has no role doc — TableView will show its own error
      }

      setReady(true);
    });

    return () => unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-slate-400">Initializing access...</p>
      </div>
    );
  }

  if (noAuth) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">Users</h1>
          <p className="mt-1 text-sm text-slate-400">Team member access and role management.</p>
        </div>
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          Authentication required. Please sign in to access user management.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-400">Team member access and role management.</p>
      </div>

      {bootstrapMessage ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {bootstrapMessage}
        </div>
      ) : null}

      <TableView
        key={tableKey}
        title="Users"
        subtitle="Team member access and permissions."
        viewKey="users"
      />
    </div>
  );
}
