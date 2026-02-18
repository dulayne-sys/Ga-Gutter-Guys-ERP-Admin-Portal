"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleProvider = new GoogleAuthProvider();

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/web/dashboard");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!auth) {
        throw new Error("Authentication unavailable.");
      }
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/web/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!auth) {
        throw new Error("Authentication unavailable.");
      }
      await signInWithPopup(auth, googleProvider);
      router.replace("/web/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.9)]">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">GA Gutter Guys</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Admin ERP Login</h1>
          <p className="mt-2 text-sm text-slate-400">
            Secure access for authorized administrators only.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-slate-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400/90 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-white/15" />
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">or</span>
            <span className="h-px flex-1 bg-white/15" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full rounded-xl border border-white/20 bg-transparent py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
