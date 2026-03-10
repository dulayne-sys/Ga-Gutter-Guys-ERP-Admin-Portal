"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase";
import { DataTable } from "../components/DataTable";
import { StatCard } from "../components/StatCard";
import { LeadProfilePanel } from "../components/LeadProfilePanel";
import AddLeadModal from "../components/modals/AddLeadModal";
import { dataLoader } from "../lib/dataLoader";
import { TABLE_DEFINITIONS } from "../lib/tableDefinitions";

type LeadRow = Record<string, unknown>;
type UserRole = "admin" | "sales" | "field" | "unknown";

export default function CrmPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const isAdmin = currentUserRole === "admin";

  useEffect(() => {
    void loadLeads();
  }, []);

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

  const stats = useMemo(() => {
    const wins = leads.filter((lead) => lead.status === "won").length;
    const losses = leads.filter((lead) => lead.status === "lost").length;
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
    const openCount = leads.filter((lead) => !["won", "lost"].includes(String(lead.status || ""))).length;

    const now = new Date();
    const closedThisMonth = leads.filter((lead) => {
      if (lead.status !== "won") return false;
      const updatedAt = lead.updatedAt;
      const date = typeof updatedAt === "object" && updatedAt && "toDate" in updatedAt
        ? (updatedAt as { toDate: () => Date }).toDate()
        : new Date(String(updatedAt));

      return !Number.isNaN(date.getTime())
        && date.getMonth() === now.getMonth()
        && date.getFullYear() === now.getFullYear();
    }).length;

    return {
      winRate: Number(winRate.toFixed(1)),
      openCount,
      closedThisMonth,
      avgDealSize: 2450,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let next = [...leads];

    if (searchTerm.trim()) {
      const needle = searchTerm.toLowerCase();
      next = next.filter((lead) => {
        const firstName = String(lead.firstName ?? "").toLowerCase();
        const lastName = String(lead.lastName ?? "").toLowerCase();
        const email = String(lead.email ?? "").toLowerCase();
        const phone = String(lead.phone ?? "").toLowerCase();
        const street = String((lead.address as { street?: string } | undefined)?.street ?? "").toLowerCase();
        return [firstName, lastName, email, phone, street].some((value) => value.includes(needle));
      });
    }

    if (statusFilter) {
      next = next.filter((lead) => String(lead.status || "") === statusFilter);
    }

    return next;
  }, [leads, searchTerm, statusFilter]);

  async function loadLeads() {
    try {
      setLoading(true);
      setError(null);
      const data = await dataLoader.getLeads();
      setLeads(data);
      setSelectedLead(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddLead(leadData: Record<string, unknown>) {
    try {
      setSubmitting(true);
      await dataLoader.createLead(leadData);
      await loadLeads();
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteLead() {
    if (!isAdmin || !selectedLead?.id) return;
    if (!window.confirm("Delete selected lead?")) return;

    try {
      setSubmitting(true);
      await dataLoader.deleteDocument("leads", String(selectedLead.id));
      await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Lead Pipeline</h1>
          <p className="mt-1 text-sm text-slate-400">CRM — Lead management and sales opportunities</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Lead
          </button>
          <button
            type="button"
            onClick={() => void loadLeads()}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            Reload
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Win Rate" value={`${stats.winRate}%`} sublabel="Wins vs losses" />
        <StatCard label="Open Opportunities" value={String(stats.openCount)} sublabel="Active leads" />
        <StatCard label="Closed This Month" value={String(stats.closedThisMonth)} sublabel="Won deals" />
        <StatCard label="Avg Deal Size" value={`$${stats.avgDealSize}`} sublabel="Last 30 days" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, email, phone, address..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="min-w-[260px] flex-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
        />

        {["new", "contacted", "scheduled", "estimating", "won", "lost", "completed", "on hold"].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === status ? null : status))}
            className={`rounded-full px-3 py-2 text-xs font-medium transition ${
              statusFilter === status
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {error ? <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        Role: <span className="font-semibold text-white">{currentUserRole}</span>
        {selectedLead?.id ? <span className="ml-3">Selected Lead: <span className="font-semibold text-white">{String(selectedLead.id)}</span></span> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleDeleteLead()}
            disabled={!isAdmin || !selectedLead?.id || submitting}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Selected Lead
          </button>
        </div>
      </div>

      <div className="table-container">
        <DataTable
          title="Leads — click a row to open profile"
          loading={loading}
          rows={filteredLeads}
          columns={TABLE_DEFINITIONS.leads}
          onRowClick={(row) => { setSelectedLead(row); setShowProfile(true); }}
          highlightRowId={String(selectedLead?.id ?? "")}
        />
      </div>

      {showAddModal ? (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddLead}
        />
      ) : null}

      {showProfile && selectedLead ? (
        <LeadProfilePanel
          lead={selectedLead}
          onClose={() => setShowProfile(false)}
          onStatusChange={async (leadId, newStatus) => {
            await dataLoader.updateLead(leadId, { status: newStatus });
            await loadLeads();
          }}
        />
      ) : null}
    </div>
  );
}
