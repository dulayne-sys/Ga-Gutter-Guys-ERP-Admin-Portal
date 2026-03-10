"use client";

import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { auth, firestore } from "@/lib/firebase";
import { EnterpriseIcon } from "@/components/EnterpriseIcon";
import { QuickBooksStatus } from "./QuickBooksStatus";

type NavItem = {
  href: string;
  label: string;
  icon:
    | "dashboard"
    | "calendar"
    | "estimator"
    | "sales"
    | "crm"
    | "operations"
    | "contacts"
    | "jobs"
    | "workOrders"
    | "erp"
    | "invoices"
    | "procurements"
    | "users"
    | "profile"
    | "vendors"
    | "settings"
    | "ai"
    | "integrations"
    | "finance";
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Main",
    items: [
      { href: "/web/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/web/calendar", label: "Calendar", icon: "calendar" },
      { href: "/web/estimator", label: "Estimator", icon: "estimator" },
      { href: "/web/profile", label: "Profile", icon: "profile" },
    ],
  },
  {
    title: "CRM",
    items: [
      { href: "/web/crm", label: "Lead Pipeline", icon: "crm" },
      { href: "/web/sales-home", label: "Sales Pipeline", icon: "sales" },
      { href: "/web/sales-ops", label: "Sales Ops", icon: "operations" },
      { href: "/web/contacts", label: "Contacts", icon: "contacts" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/web/active-jobs", label: "Active Jobs", icon: "jobs" },
      { href: "/web/work-orders", label: "Work Orders", icon: "workOrders" },
      { href: "/web/job-erp", label: "Job ERP", icon: "erp" },
      { href: "/web/invoices", label: "Invoices", icon: "invoices" },
      { href: "/web/procurements", label: "Procurements", icon: "procurements" },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/web/ai-assistant", label: "AI Assistant", icon: "ai" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/web/users", label: "Users", icon: "users" },
      { href: "/web/vendors", label: "Vendors", icon: "vendors" },
      { href: "/web/settings", label: "Settings", icon: "settings" },
      { href: "/web/integrations", label: "Integrations", icon: "integrations" },
    ],
  },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("unknown");
  const [signingOut, setSigningOut] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setCurrentUser(nextUser);

      if (!nextUser || !firestore) {
        setUserRole("unknown");
        return;
      }

      try {
        const userDoc = await getDoc(doc(firestore, "users", nextUser.uid));
        setUserRole(String(userDoc.data()?.role ?? "unknown"));
      } catch {
        setUserRole("unknown");
      }
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
    <aside className="hidden w-72 flex-col border-r border-white/10 bg-slate-900/70 lg:flex">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
            GA
          </div>
          <div>
            <p className="text-sm font-semibold text-white">GA Gutter Guys</p>
            <p className="text-xs text-slate-400">Operations Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                      active
                        ? "border-indigo-400/50 bg-indigo-500/15 text-white"
                        : "border-transparent text-slate-300 hover:border-white/20 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <EnterpriseIcon name={item.icon} className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/10 p-4">
        <QuickBooksStatus compact />

        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="User avatar"
                className="h-8 w-8 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{currentUser?.displayName || currentUser?.email || "User"}</p>
              <p className="text-[11px] text-slate-400">{userRole}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </aside>
  );
}
