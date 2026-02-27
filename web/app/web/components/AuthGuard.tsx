"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { auth } from "@/lib/firebase";
import { clearSessionCookie } from "@/lib/sessionCookie";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Client-side auth guard for all /web/* routes.
 * Redirects to /login when the user is not authenticated.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      clearSessionCookie();
      router.replace("/login");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        clearSessionCookie();
        router.replace("/login");
      } else {
        setReady(true);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="animate-pulse rounded-full border border-white/20 px-6 py-3 text-sm tracking-[0.3em] text-white">
          Authenticating
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
