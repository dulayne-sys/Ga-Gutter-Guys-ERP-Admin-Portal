"use client";

import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { ProfileHeaderCard } from "../components/ProfileHeaderCard";
import { QuickBooksStatus } from "../components/QuickBooksStatus";
import { StatCard } from "../components/StatCard";
import { loadDashboardKpis, loadDashboardSnapshots } from "../lib/dataLoader";

type KpiState = {
  activeJobs: number;
  openPipeline: number;
  revenueYtd: number;
  winRate: number;
};

const emptyKpis: KpiState = {
  activeJobs: 0,
  openPipeline: 0,
  revenueYtd: 0,
  winRate: 0,
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);

export default function WebDashboardPage() {
  const [kpis, setKpis] = useState<KpiState>(emptyKpis);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<{
    workOrders: Record<string, unknown>[];
    activeJobs: Record<string, unknown>[];
    invoices: Record<string, unknown>[];
  }>({
    workOrders: [],
    activeJobs: [],
    invoices: [],
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([loadDashboardKpis(), loadDashboardSnapshots()])
      .then(([nextKpis, nextSnapshots]) => {
        if (!active) return;
        setKpis(nextKpis);
        setSnapshots(nextSnapshots);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Welcome back</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Here is your live operations snapshot.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {/* KPI stat cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Jobs" value={String(kpis.activeJobs)} sublabel="From Active Jobs sheet" />
        <StatCard label="Open Pipeline" value={currency(kpis.openPipeline)} sublabel="Estimated value" />
        <StatCard label="Revenue YTD" value={currency(kpis.revenueYtd)} sublabel="Current year" />
        <StatCard label="Win Rate" value={`${Math.round((kpis.winRate || 0) * 100)}%`} sublabel="Wins vs losses" />
      </section>

      {/* Main content + User detail card */}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Left: Tables */}
        <div className="space-y-6">
          <DataTable
            title="Recent Work Orders"
            loading={loading}
            columns={[
              { field: "id", label: "WO #", type: "text" },
              { field: "customerId", label: "Customer", type: "text" },
              { field: "status", label: "Status", type: "status" },
            ]}
            rows={snapshots.workOrders}
            searchable={false}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <DataTable
              title="Active Jobs Snapshot"
              loading={loading}
              columns={[
                { field: "customerId", label: "Customer", type: "text" },
                { field: "status", label: "Status", type: "status" },
                { field: "priority", label: "Priority", type: "status" },
              ]}
              rows={snapshots.activeJobs}
              searchable={false}
            />
            <DataTable
              title="Invoices Snapshot"
              loading={loading}
              columns={[
                { field: "id", label: "Invoice #", type: "text" },
                { field: "customerId", label: "Customer", type: "text" },
                { field: "status", label: "Status", type: "status" },
                { field: "amountDue", label: "Amount", type: "currency" },
              ]}
              rows={snapshots.invoices}
              searchable={false}
            />
          </div>
        </div>

        {/* Right: User card + QuickBooks */}
        <div className="space-y-6">
          <ProfileHeaderCard
            variant="detail"
            actions={[
              { label: "Edit Profile", href: "/web/profile" },
              { label: "Settings", href: "/web/settings" },
            ]}
          />
          <QuickBooksStatus />
        </div>
      </div>
    </div>
  );
}
