"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { ShieldAiWidget } from "@/components/ShieldAiWidget";

const navItems = [
  { href: "/web/dashboard", label: "Dashboard" },
  { href: "/web/estimator", label: "Estimator" },
  { href: "/web/active-jobs", label: "Jobs" },
];

type AuthGateProps = {
  title: string;
  children: React.ReactNode;
};

export const AuthGate = ({ title, children }: AuthGateProps) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (!nextUser) {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const email = useMemo(() => user?.email ?? "", [user]);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="animate-pulse rounded-full border border-white/20 px-6 py-3 text-sm tracking-[0.3em]">
          Loading
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">GA Gutter Guys</p>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-xs font-medium text-emerald-200">
              {email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/20 px-4 py-1 text-xs text-white transition hover:border-white/60"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-[200px_1fr]">
        <nav className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-xl border border-transparent px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <main className="space-y-6">{children}</main>
      </div>
      <ShieldAiWidget />
    </div>
  );
};
