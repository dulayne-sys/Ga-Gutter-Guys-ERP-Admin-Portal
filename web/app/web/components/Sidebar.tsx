"use client";

import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { clearSessionCookie } from "@/lib/sessionCookie";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { auth, firestore } from "@/lib/firebase";
import { EnterpriseIcon } from "@/components/EnterpriseIcon";

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
    | "settings";
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
    title: "Sales & CRM",
    items: [
      { href: "/web/sales-home", label: "Sales Home", icon: "sales" },
      { href: "/web/crm", label: "CRM", icon: "crm" },
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
    title: "Admin",
    items: [
      { href: "/web/users", label: "Users", icon: "users" },
      { href: "/web/vendors", label: "Vendors", icon: "vendors" },
      { href: "/web/settings", label: "Settings", icon: "settings" },
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
      clearSessionCookie();
      await signOut(auth);
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <aside className="hidden w-[272px] flex-col bg-[#1E1F2E] lg:flex">
      {/* Brand */}
      <div className="border-b border-[#2E3048] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
            GA
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#F8FAFC] tracking-[-0.01em]">GA Gutter Guys</p>
            <p className="text-[11px] font-medium text-[#6B7194]">Operations Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#555772]">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                      active
                        ? "bg-[rgba(99,102,241,0.14)] text-[#F8FAFC] shadow-sm shadow-indigo-500/10"
                        : "text-[#9CA3C0] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#E2E8F0]"
                    }`}
                  >
                    <EnterpriseIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-[#2E3048] p-3">
        <div className="space-y-3 rounded-xl border border-[#2E3048] bg-[rgba(255,255,255,0.03)] p-3">
          <div className="flex items-center gap-3">
            {currentUser?.photoURL ? (
              <Image
                src={currentUser.photoURL}
                alt="User avatar"
                width={36}
                height={36}
                className="h-9 w-9 rounded-full border-2 border-[#3B3D56] object-cover"
              />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-xs font-semibold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#F8FAFC]">
                {currentUser?.displayName || currentUser?.email || "User"}
              </p>
              <p className="text-[11px] font-medium capitalize text-[#6B7194]">{userRole}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="w-full rounded-lg border border-[#2E3048] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-semibold text-[#9CA3C0] transition hover:bg-[rgba(255,255,255,0.08)] hover:text-[#E2E8F0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </aside>
  );
}
