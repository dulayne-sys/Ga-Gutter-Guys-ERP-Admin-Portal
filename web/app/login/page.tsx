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
import { setSessionCookie } from "@/lib/sessionCookie";

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
        setSessionCookie();
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
      setSessionCookie();
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
      setSessionCookie();
      router.replace("/web/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EFEAE4] px-6">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-[#E5E0DA] bg-white p-8 shadow-[0_20px_60px_-20px_rgba(30,31,46,0.18)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#64667A]">GA Gutter Guys</p>
          <h1 className="mt-3 text-3xl font-semibold text-[#1E1F2E]">Admin ERP Login</h1>
          <p className="mt-2 text-sm text-[#64667A]">
            Secure access for authorized administrators only.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-[#4A4C60]">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#E5E0DA] bg-[#F8F6F3] px-4 py-3 text-[#1E1F2E] placeholder:text-[#9B9DAB] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20"
              placeholder="you@company.com"
            />
          </label>
          <label className="block text-sm font-medium text-[#4A4C60]">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#E5E0DA] bg-[#F8F6F3] px-4 py-3 text-[#1E1F2E] placeholder:text-[#9B9DAB] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20"
              placeholder="••••••••"
            />
          </label>
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-600 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-[#E5E0DA]" />
            <span className="text-xs uppercase tracking-[0.2em] text-[#9B9DAB]">or</span>
            <span className="h-px flex-1 bg-[#E5E0DA]" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full rounded-xl border border-[#E5E0DA] bg-white py-3 text-sm font-semibold text-[#1E1F2E] transition hover:border-[#D4CFC8] hover:bg-[#F8F6F3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
