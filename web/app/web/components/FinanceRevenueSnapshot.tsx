"use client";

import { useEffect, useState } from "react";
import { dataLoader } from "../lib/dataLoader";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

type Snapshot = {
  monthlyRevenue: number;
  outstanding: number;
  avgInvoiceValue: number;
  totalInvoices: number;
};

function SnapshotRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-white/5 last:border-b-0">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

export function FinanceRevenueSnapshot() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const invoices = await dataLoader.getInvoices();
        if (!active) return;

        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        let monthlyRevenue = 0;
        let outstanding = 0;
        let totalAmount = 0;

        for (const inv of invoices) {
          const amount = Number(inv.amountDue ?? 0);
          totalAmount += amount;

          if (String(inv.status ?? "") === "paid") {
            const paidDate = toDate(inv.updatedAt) ?? toDate(inv.createdAt);
            if (
              paidDate &&
              paidDate.getMonth() === thisMonth &&
              paidDate.getFullYear() === thisYear
            ) {
              monthlyRevenue += amount;
            }
          } else {
            outstanding += amount;
          }
        }

        const avg = invoices.length > 0 ? totalAmount / invoices.length : 0;

        setSnap({
          monthlyRevenue,
          outstanding,
          avgInvoiceValue: avg,
          totalInvoices: invoices.length,
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="mb-1 text-[11px] uppercase tracking-[0.15em] text-slate-500">Revenue Snapshot</p>

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading...</p>
      ) : snap ? (
        <div className="mt-3">
          <SnapshotRow
            label="Revenue this month"
            value={fmt(snap.monthlyRevenue)}
            accent="text-emerald-300"
          />
          <SnapshotRow
            label="Outstanding"
            value={fmt(snap.outstanding)}
            accent={snap.outstanding > 0 ? "text-amber-300" : "text-white"}
          />
          <SnapshotRow
            label="Avg invoice value"
            value={fmt(snap.avgInvoiceValue)}
          />
          <SnapshotRow
            label="Total invoices"
            value={String(snap.totalInvoices)}
          />
        </div>
      ) : null}
    </div>
  );
}
