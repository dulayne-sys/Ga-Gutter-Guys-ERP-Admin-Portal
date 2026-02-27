"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clearSessionCookie } from "@/lib/sessionCookie";
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
      clearSessionCookie();
      await signOut(auth);
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[#E5E0DA] bg-[rgba(255,255,255,0.88)] px-6 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="flex w-full max-w-md items-center gap-2.5 rounded-xl border border-[#E5E0DA] bg-[#F8F6F3] px-4 py-2.5">
          <EnterpriseIcon name="search" className="h-4 w-4 text-[#9B9DAB]" />
          <input
            type="text"
            placeholder="Search orders, customers, jobs..."
            className="w-full bg-transparent text-sm text-[#1E1F2E] outline-none placeholder:text-[#B8BAC8]"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E0DA] text-[#7E8099] transition hover:bg-[#F0ECE7] hover:text-[#1E1F2E]"
            aria-label="Refresh"
          >
            <EnterpriseIcon name="refresh" className="h-4 w-4" />
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E0DA] text-[#7E8099] transition hover:bg-[#F0ECE7] hover:text-[#1E1F2E]"
            aria-label="Notifications"
          >
            <EnterpriseIcon name="notifications" className="h-4 w-4" />
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E0DA] text-[#7E8099] transition hover:bg-[#F0ECE7] hover:text-[#1E1F2E]"
            aria-label="Support"
          >
            <EnterpriseIcon name="support" className="h-4 w-4" />
          </button>

          <div className="mx-1 h-6 w-px bg-[#E5E0DA]" />

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E0DA] px-3 py-2 text-xs font-semibold text-[#7E8099] transition hover:bg-[#F0ECE7] hover:text-[#1E1F2E]"
            aria-label="Toggle light and dark mode"
          >
            <EnterpriseIcon name={resolvedTheme === "dark" ? "themeDark" : "themeLight"} className="h-4 w-4" />
            {resolvedTheme === "dark" ? "Dark" : "Light"}
          </button>

          <button
            type="button"
            onClick={() => setPreference("auto")}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              preference === "auto"
                ? "border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.08)] text-[#6366F1]"
                : "border-[#E5E0DA] text-[#7E8099] hover:bg-[#F0ECE7] hover:text-[#1E1F2E]"
            }`}
            aria-label="Use automatic day and night theme"
          >
            <EnterpriseIcon name="themeAuto" className="h-4 w-4" />
            Auto
          </button>

          <div className="mx-1 h-6 w-px bg-[#E5E0DA]" />

          {currentUser?.photoURL ? (
            <Image
              src={currentUser.photoURL}
              alt="User avatar"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full border-2 border-[#E5E0DA] object-cover shadow-sm"
            />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-xs font-semibold text-white shadow-sm">
              {initials}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="rounded-lg border border-[#E5E0DA] px-3 py-2 text-xs font-semibold text-[#7E8099] transition hover:bg-[#F0ECE7] hover:text-[#1E1F2E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
