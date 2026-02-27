"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, firestore } from "@/lib/firebase";
import { EnterpriseIcon } from "@/components/EnterpriseIcon";

interface ActionButton {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface ProfileHeaderCardProps {
  actions?: ActionButton[];
  /** "compact" = inline header (default). "detail" = full user card for sidebar panels. */
  variant?: "compact" | "detail";
}

export function ProfileHeaderCard({ actions, variant = "compact" }: ProfileHeaderCardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("—");

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u || !firestore) {
        setRole("—");
        return;
      }
      try {
        const snap = await getDoc(doc(firestore, "users", u.uid));
        setRole(String(snap.data()?.role ?? "—"));
      } catch {
        setRole("—");
      }
    });
    return () => unsub();
  }, []);

  const initials = useMemo(() => {
    const name = (user?.displayName ?? "").trim();
    if (name) {
      const parts = name.split(/\s+/);
      return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
    }
    const email = user?.email ?? "";
    return email ? email.slice(0, 2).toUpperCase() : "—";
  }, [user]);

  const nameParts = useMemo(() => {
    const full = (user?.displayName ?? "").trim();
    if (!full) return { first: "—", last: "" };
    const parts = full.split(/\s+/);
    return { first: parts[0] ?? "—", last: parts.slice(1).join(" ") || "" };
  }, [user]);

  if (!user) return null;

  /* ── Detailed Variant ────────────────────────────────────── */
  if (variant === "detail") {
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return "—";
      try {
        return new Date(dateStr).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      } catch {
        return "—";
      }
    };

    const fields: { label: string; value: string }[] = [
      { label: "First Name", value: nameParts.first },
      ...(nameParts.last ? [{ label: "Last Name", value: nameParts.last }] : []),
      { label: "Email", value: user.email ?? "—" },
      { label: "Role", value: role },
      { label: "Last Sign-in", value: formatDate(user.metadata.lastSignInTime) },
      { label: "Account Created", value: formatDate(user.metadata.creationTime) },
    ];

    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        {/* Top centered avatar + name */}
        <div className="flex flex-col items-center text-center">
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt="Profile"
              width={80}
              height={80}
              className="h-20 w-20 rounded-full border-[3px] border-white/20 object-cover shadow-md"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full border-[3px] border-white/20 bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-bold text-white shadow-md">
              {initials}
            </div>
          )}
          <p className="mt-3 text-lg font-semibold text-white">
            {user.displayName || "User"}
          </p>
          <p className="text-sm capitalize text-slate-400">{role}</p>
          {user.email ? (
            <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
          ) : null}
        </div>

        {/* Quick action icons */}
        <div className="mt-5 flex justify-center gap-2">
          {[
            { icon: "profile" as const, label: "Edit Profile", href: "/web/profile" },
            { icon: "invoices" as const, label: "Email" },
            { icon: "calendar" as const, label: "Calendar", href: "/web/calendar" },
            { icon: "settings" as const, label: "Settings", href: "/web/settings" },
          ].map((action) => (
            action.href ? (
              <Link
                key={action.label}
                href={action.href}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                title={action.label}
              >
                <EnterpriseIcon name={action.icon} className="h-4 w-4" />
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                title={action.label}
              >
                <EnterpriseIcon name={action.icon} className="h-4 w-4" />
              </button>
            )
          ))}
        </div>

        {/* Divider */}
        <div className="my-5 border-t border-white/10" />

        {/* Detailed info */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Detailed Information
            </p>
          </div>

          {fields.map((field) => (
            <div key={field.label}>
              <p className="text-[11px] text-slate-500">{field.label}</p>
              <p className="mt-0.5 text-sm font-medium text-white">{field.value}</p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        {actions && actions.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {actions.map((action) =>
              action.href ? (
                <a
                  key={action.label}
                  href={action.href}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  {action.label}
                </a>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  {action.label}
                </button>
              ),
            )}
          </div>
        ) : null}
      </div>
    );
  }

  /* ── Compact Variant (default) ──────────────────────────── */
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-4">
        {user.photoURL ? (
          <Image
            src={user.photoURL}
            alt="Profile"
            width={56}
            height={56}
            className="h-14 w-14 rounded-full border border-white/20 object-cover"
          />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-white">
            {user.displayName || user.email || "User"}
          </p>
          <p className="text-xs capitalize text-slate-400">{role}</p>
          {user.email && user.displayName ? (
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          ) : null}
        </div>
      </div>

      {actions && actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) =>
            action.href ? (
              <a
                key={action.label}
                href={action.href}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
              >
                {action.label}
              </a>
            ) : (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
