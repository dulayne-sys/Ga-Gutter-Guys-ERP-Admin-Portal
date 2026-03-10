"use client";

import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { QuickBooksStatus } from "../components/QuickBooksStatus";
import { StatCard } from "../components/StatCard";
import { loadDashboardKpis, loadDashboardSnapshots, dataLoader } from "../lib/dataLoader";

type KpiState = {
  activeJobs: number;
  openPipeline: number;
  revenueYtd: number;
  winRate: number;
};

type InvoiceAging = {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  totalOutstanding: number;
};

const emptyKpis: KpiState = {
  activeJobs: 0,
  openPipeline: 0,
  revenueYtd: 0,
  winRate: 0,
};

const emptyAging: InvoiceAging = {
  current: 0,
  days30: 0,
  days60: 0,
  days90: 0,
  totalOutstanding: 0,
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);

const agingBucket = (dueDate: unknown): "current" | "30" | "60" | "90+" => {
  if (!dueDate) return "current";
  const source = typeof dueDate === "object" && dueDate && "toDate" in dueDate
    ? (dueDate as { toDate: () => Date }).toDate()
    : new Date(String(dueDate));

  if (Number.isNaN(source.getTime())) return "current";

  const daysOverdue = Math.floor((Date.now() - source.getTime()) / (1000 * 60 * 60 * 24));
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "30";
  if (daysOverdue <= 60) return "60";
  return "90+";
};

export default function WebDashboardPage() {
  const [kpis, setKpis] = useState<KpiState>(emptyKpis);
  const [aging, setAging] = useState<InvoiceAging>(emptyAging);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [totalInvoiced, setTotalInvoiced] = useState(0);
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

    const loadAll = async () => {
      const [nextKpis, nextSnapshots, allInvoices] = await Promise.all([
        loadDashboardKpis(),
        loadDashboardSnapshots(),
        dataLoader.getInvoices(),
      ]);

      if (!active) return;

      setKpis(nextKpis);
      setSnapshots(nextSnapshots);

      // Compute invoice aging
      const now = new Date();
      const outstanding = allInvoices.filter((inv) =>
        ["draft", "sent", "overdue"].includes(String(inv.status ?? ""))
      );

      const nextAging: InvoiceAging = { current: 0, days30: 0, days60: 0, days90: 0, totalOutstanding: 0 };
      for (const inv of outstanding) {
        const amount = Number(inv.amountDue ?? 0);
        nextAging.totalOutstanding += amount;
        const bucket = agingBucket(inv.dueDate);
        if (bucket === "current") nextAging.current += amount;
        else if (bucket === "30") nextAging.days30 += amount;
        else if (bucket === "60") nextAging.days60 += amount;
        else nextAging.days90 += amount;
      }
      setAging(nextAging);

      // Monthly revenue (paid invoices this month)
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const monthlyPaid = allInvoices
        .filter((inv) => {
          if (String(inv.status ?? "") !== "paid") return false;
          const source = typeof inv.updatedAt === "object" && inv.updatedAt && "toDate" in inv.updatedAt
            ? (inv.updatedAt as { toDate: () => Date }).toDate()
            : new Date(String(inv.updatedAt));
          return !Number.isNaN(source.getTime())
            && source.getMonth() === thisMonth
            && source.getFullYear() === thisYear;
        })
        .reduce((sum, inv) => sum + Number(inv.amountDue ?? 0), 0);
      setMonthlyRevenue(monthlyPaid);

      // Total invoiced (all statuses)
      const total = allInvoices.reduce((sum, inv) => sum + Number(inv.amountDue ?? 0), 0);
      setTotalInvoiced(total);
    };

    loadAll()
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
      <div>
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Operations snapshot — KPIs, alerts, and financial overview.</p>
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      {/* Primary KPIs */}
      <section>
        <p className="mb-3 text-[11px] uppercase tracking-[0.15em] text-slate-500">Operations</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active Jobs" value={String(kpis.activeJobs)} sublabel="Scheduled + In Progress" />
          <StatCard label="Open Pipeline" value={currency(kpis.openPipeline)} sublabel="Sent + approved estimates" />
          <StatCard label="Revenue YTD" value={currency(kpis.revenueYtd)} sublabel="Paid invoices this year" />
          <StatCard label="Win Rate" value={`${Math.round((kpis.winRate || 0) * 100)}%`} sublabel="Wins vs losses" />
        </div>
      </section>

      {/* Financial KPIs */}
      <section>
        <p className="mb-3 text-[11px] uppercase tracking-[0.15em] text-slate-500">Financials</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Monthly Revenue" value={currency(monthlyRevenue)} sublabel="Paid invoices this month" />
          <StatCard label="Total Invoiced" value={currency(totalInvoiced)} sublabel="All invoices combined" />
          <StatCard label="Outstanding" value={currency(aging.totalOutstanding)} sublabel="Unpaid invoices" />
          <StatCard label="Past Due 90+" value={currency(aging.days90)} sublabel="Needs immediate attention" />
        </div>
      </section>

      {/* Invoice Aging */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-4 text-base font-semibold text-white">Invoice Aging</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            <AgingBand label="Current" amount={aging.current} colorClass="border-emerald-400/40 bg-emerald-500/10 text-emerald-200" />
            <AgingBand label="1–30 Days" amount={aging.days30} colorClass="border-amber-400/40 bg-amber-500/10 text-amber-200" />
            <AgingBand label="31–60 Days" amount={aging.days60} colorClass="border-orange-400/40 bg-orange-500/10 text-orange-200" />
            <AgingBand label="61+ Days" amount={aging.days90} colorClass="border-rose-400/40 bg-rose-500/10 text-rose-200" />
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
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
        <QuickBooksStatus />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
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
      </section>
    </div>
  );
}

function AgingBand({ label, amount, colorClass }: { label: string; amount: number; colorClass: string }) {
  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <p className="text-xs opacity-75">{label}</p>
      <p className="mt-1 text-xl font-bold">
        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)}
      </p>
    </div>
  );
}
