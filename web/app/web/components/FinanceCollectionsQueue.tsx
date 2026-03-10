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

type CollectionRow = {
  invoiceId: string;
  customerId: string;
  amount: number;
  daysOverdue: number;
  status: string;
};

const urgencyClass = (days: number): string => {
  if (days > 60) return "border-rose-400/40 bg-rose-500/10 text-rose-300";
  if (days > 30) return "border-orange-400/40 bg-orange-500/10 text-orange-300";
  return "border-amber-400/40 bg-amber-500/10 text-amber-300";
};

export function FinanceCollectionsQueue() {
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOverdue, setTotalOverdue] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const invoices = await dataLoader.getInvoices();
        if (!active) return;

        const now = Date.now();
        const overdue: CollectionRow[] = [];

        for (const inv of invoices) {
          const status = String(inv.status ?? "");
          if (status === "paid") continue;

          const due = toDate(inv.dueDate);
          if (!due) continue;

          const daysOverdue = Math.floor((now - due.getTime()) / (1000 * 60 * 60 * 24));
          if (daysOverdue <= 0) continue; // not yet overdue

          overdue.push({
            invoiceId: String(inv.id ?? ""),
            customerId: String(inv.customerId ?? "—"),
            amount: Number(inv.amountDue ?? 0),
            daysOverdue,
            status,
          });
        }

        // Sort by most overdue first
        overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

        const total = overdue.reduce((s, r) => s + r.amount, 0);
        setRows(overdue);
        setTotalOverdue(total);
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
      <div className="mb-4 flex items-start justify-between">
        <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">Collections Queue</p>
        {rows.length > 0 && (
          <span className="text-xs font-semibold text-rose-300">{fmt(totalOverdue)} past due</span>
        )}
      </div>

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-400">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6">
          <p className="text-sm font-medium text-emerald-300">All clear</p>
          <p className="text-xs text-slate-500">No overdue invoices</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 10).map((row) => (
            <div
              key={row.invoiceId}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-200">{row.customerId}</p>
                <p className="text-[10px] text-slate-500">Inv {row.invoiceId.slice(0, 8)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs font-medium text-slate-200">{fmt(row.amount)}</span>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${urgencyClass(row.daysOverdue)}`}>
                  {row.daysOverdue}d overdue
                </span>
              </div>
            </div>
          ))}

          {rows.length > 10 && (
            <p className="pt-1 text-center text-[11px] text-slate-500">
              + {rows.length - 10} more overdue invoices
            </p>
          )}
        </div>
      )}
    </div>
  );
}
