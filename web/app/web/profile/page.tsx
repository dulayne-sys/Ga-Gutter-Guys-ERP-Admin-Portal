"use client";

import { onAuthStateChanged, updateProfile, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { auth, firestore } from "@/lib/firebase";
import { ProfileHeaderCard } from "../components/ProfileHeaderCard";
import { StatCard } from "../components/StatCard";

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [role, setRole] = useState("unknown");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setDisplayName(String(user?.displayName ?? ""));
      setPhotoUrl(String(user?.photoURL ?? ""));

      if (!user || !firestore) {
        setRole("unknown");
        return;
      }

      try {
        const userDoc = await getDoc(doc(firestore, "users", user.uid));
        setRole(String(userDoc.data()?.role ?? "unknown"));
      } catch {
        setRole("unknown");
      }
    });

    return () => unsubscribe();
  }, []);

  const initials = useMemo(() => {
    const value = displayName.trim();
    if (value) {
      const parts = value.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] ?? "";
      const second = parts[1]?.[0] ?? "";
      const assembled = `${first}${second}`.toUpperCase();
      if (assembled) return assembled;
    }

    const email = String(currentUser?.email ?? "");
    return email ? email.slice(0, 2).toUpperCase() : "--";
  }, [displayName, currentUser]);

  const handleSave = async () => {
    if (!auth || !currentUser) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updateProfile(currentUser, {
        displayName: displayName.trim() || null,
        photoURL: photoUrl.trim() || null,
      });

      if (firestore) {
        await setDoc(
          doc(firestore, "users", currentUser.uid),
          {
            displayName: displayName.trim(),
            photoURL: photoUrl.trim(),
            email: currentUser.email || "",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Profile</h1>
        <p className="mt-1 text-xs text-slate-400">Manage your account display name and avatar.</p>
      </div>

      <ProfileHeaderCard actions={[{ label: "Dashboard", href: "/web/dashboard" }]} />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Email" value={String(currentUser?.email ?? "Not signed in")} sublabel="Authentication identity" />
        <StatCard label="Role" value={role} sublabel="User permissions" />
        <StatCard label="Provider" value={String(currentUser?.providerData?.[0]?.providerId ?? "unknown")} sublabel="Sign-in method" />
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Avatar Preview</p>
          <div className="mt-3 flex items-center gap-3">
            {photoUrl.trim() ? (
              <Image
                src={photoUrl.trim()}
                alt="Profile avatar"
                width={56}
                height={56}
                className="h-14 w-14 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-white/5 text-sm font-semibold text-white">
                {initials}
              </div>
            )}
            <div className="text-xs text-slate-400">
              <p>Changes update the web app shell immediately after save.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-200">
              Display Name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
                placeholder="Your name"
              />
            </label>

            <label className="text-sm text-slate-200">
              Avatar URL
              <input
                value={photoUrl}
                onChange={(event) => setPhotoUrl(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
                placeholder="https://..."
              />
            </label>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !currentUser}
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
