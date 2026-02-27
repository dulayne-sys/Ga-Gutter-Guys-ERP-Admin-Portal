"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { auth, firestore } from "@/lib/firebase";
import { DataTable } from "../components/DataTable";
import { StatCard } from "../components/StatCard";
import { dataLoader, type TableRow } from "../lib/dataLoader";
import { TABLE_DEFINITIONS } from "../lib/tableDefinitions";

type UserRole = "admin" | "sales" | "field" | "unknown";

export default function SettingsPage() {
  const [users, setUsers] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [editRole, setEditRole] = useState("sales");
  const [editActive, setEditActive] = useState("true");
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUserRole === "admin";

  const stats = useMemo(() => {
    const admins = users.filter((user) => String(user.role ?? "") === "admin").length;
    const sales = users.filter((user) => String(user.role ?? "") === "sales").length;
    const field = users.filter((user) => String(user.role ?? "") === "field").length;
    const active = users.filter((user) => user.active === true).length;

    return { admins, sales, field, active };
  }, [users]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await dataLoader.getUsers();
      setUsers(rows);
      setSelectedRow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (!selectedRow) return;
    setEditRole(String(selectedRow.role ?? "sales"));
    setEditActive(String(selectedRow.active ?? true));
  }, [selectedRow]);

  useEffect(() => {
    if (!auth || !firestore) return;
    const db = firestore;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUserRole("unknown");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = String(userDoc.data()?.role ?? "unknown") as UserRole;
        if (role === "admin" || role === "sales" || role === "field") {
          setCurrentUserRole(role);
        } else {
          setCurrentUserRole("unknown");
        }
      } catch {
        setCurrentUserRole("unknown");
      }
    });

    return () => unsubscribe();
  }, []);

  const saveRoleUpdate = async () => {
    if (!isAdmin || !selectedRow?.id) return;

    try {
      setSaving(true);
      await dataLoader.updateDocument("users", String(selectedRow.id), {
        role: editRole,
        active: editActive === "true",
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user role.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">Role-based access control and governance.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/web/dashboard" className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            QuickBooks Status
          </Link>
          <button type="button" onClick={() => void loadUsers()} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            Reload
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Admins" value={String(stats.admins)} sublabel="Full access" />
        <StatCard label="Sales" value={String(stats.sales)} sublabel="CRM + estimates" />
        <StatCard label="Field" value={String(stats.field)} sublabel="Crew operations" />
        <StatCard label="Active Users" value={String(stats.active)} sublabel="Enabled accounts" />
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <DataTable
          title="Users"
          columns={TABLE_DEFINITIONS.users}
          rows={users}
          loading={loading}
          onRowClick={setSelectedRow}
          highlightRowId={String(selectedRow?.id ?? "")}
        />

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white">Role Manager</h2>
          <p className="mt-1 text-xs text-slate-400">Select a user row, then update role and status.</p>

          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div>
              <p className="text-xs text-slate-500">Current User Role</p>
              <p className="font-semibold text-white">{currentUserRole}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Selected User</p>
              <p className="font-semibold text-white">{String(selectedRow?.displayName ?? "None")}</p>
              <p className="text-xs text-slate-400">{String(selectedRow?.email ?? "")}</p>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Role</span>
              <select
                value={editRole}
                onChange={(event) => setEditRole(event.target.value)}
                disabled={!isAdmin || !selectedRow}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 disabled:opacity-50"
              >
                <option value="admin">Admin</option>
                <option value="sales">Sales</option>
                <option value="field">Field</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Active</span>
              <select
                value={editActive}
                onChange={(event) => setEditActive(event.target.value)}
                disabled={!isAdmin || !selectedRow}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 disabled:opacity-50"
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => void saveRoleUpdate()}
              disabled={!isAdmin || !selectedRow || saving}
              className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Role Changes"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
