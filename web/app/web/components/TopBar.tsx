"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { EnterpriseIcon } from "@/components/EnterpriseIcon";
import { useTheme } from "@/components/ThemeProvider";

export function TopBar() {
  const router = useRouter();
  const { preference, resolvedTheme, toggleTheme, setPreference } = useTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const initials = useMemo(() => {
    const displayName = String(currentUser?.displayName ?? "").trim();
    if (displayName) {
      const parts = displayName.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] ?? "";
      const second = parts[1]?.[0] ?? "";
      const value = `${first}${second}`.toUpperCase();
      if (value) return value;
    }

    const email = String(currentUser?.email ?? "").trim();
    return email ? email.slice(0, 2).toUpperCase() : "--";
  }, [currentUser]);

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      setSigningOut(true);
      await signOut(auth);
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 px-6 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-400">
          <EnterpriseIcon name="search" className="h-4 w-4" />
          <input
            type="text"
            placeholder="Search orders, customers, jobs..."
            className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300" aria-label="Refresh">
            <EnterpriseIcon name="refresh" className="h-4 w-4" />
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300" aria-label="Notifications">
            <EnterpriseIcon name="notifications" className="h-4 w-4" />
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300" aria-label="Support">
            <EnterpriseIcon name="support" className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            aria-label="Toggle light and dark mode"
          >
            <EnterpriseIcon name={resolvedTheme === "dark" ? "themeDark" : "themeLight"} className="h-4 w-4" />
            {resolvedTheme === "dark" ? "Dark" : "Light"}
          </button>

          <button
            type="button"
            onClick={() => setPreference("auto")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              preference === "auto"
                ? "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"
                : "border-white/15 bg-slate-900/70 text-slate-200 hover:bg-slate-800"
            }`}
            aria-label="Use automatic day and night theme"
          >
            <EnterpriseIcon name="themeAuto" className="h-4 w-4" />
            Auto
          </button>

          {currentUser?.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt="User avatar"
              className="h-9 w-9 rounded-full border border-white/20 object-cover"
            />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/5 text-xs font-semibold text-white">
              {initials}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
