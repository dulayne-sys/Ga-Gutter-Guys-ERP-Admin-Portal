"use client";

import { useEffect, useState } from "react";
import { dataLoader, type TableRow } from "../lib/dataLoader";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

type BillingRow = {
  jobId: string;
  customerId: string;
  invoiceStatus: "paid" | "sent" | "draft" | "overdue" | "no_invoice";
  amount: number;
};

const STATUS_STYLE: Record<BillingRow["invoiceStatus"], string> = {
  paid: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  sent: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
  draft: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  overdue: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  no_invoice: "border-slate-400/30 bg-slate-500/10 text-slate-400",
};

const STATUS_LABEL: Record<BillingRow["invoiceStatus"], string> = {
  paid: "Paid",
  sent: "Invoice Sent",
  draft: "Invoice Pending",
  overdue: "Overdue",
  no_invoice: "No Invoice",
};

export function FinanceProjectsAwaitingBilling() {
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [jobs, invoices] = await Promise.all([
          dataLoader.getJobs("completed"),
          dataLoader.getInvoices(),
        ]);
        if (!active) return;

        // Index invoices by jobId for O(1) lookup
        const invoiceByJob = new Map<string, TableRow>();
        for (const inv of invoices) {
          if (inv.jobId) {
            invoiceByJob.set(String(inv.jobId), inv);
          }
        }

        const result: BillingRow[] = jobs.slice(0, 20).map((job) => {
          const jobId = String(job.id ?? "");
          const inv = invoiceByJob.get(jobId);
          const rawStatus = String(inv?.status ?? "");
          const invoiceStatus: BillingRow["invoiceStatus"] =
            rawStatus === "paid" ? "paid"
            : rawStatus === "sent" ? "sent"
            : rawStatus === "draft" ? "draft"
            : rawStatus === "overdue" ? "overdue"
            : "no_invoice";

          return {
            jobId,
            customerId: String(job.customerId ?? "—"),
            invoiceStatus,
            amount: Number(inv?.amountDue ?? 0),
          };
        });

        // Sort: no_invoice and overdue first
        result.sort((a, b) => {
          const priority = { no_invoice: 0, overdue: 1, draft: 2, sent: 3, paid: 4 };
          return priority[a.invoiceStatus] - priority[b.invoiceStatus];
        });

        setRows(result);
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
      <p className="mb-4 text-[11px] uppercase tracking-[0.15em] text-slate-500">Projects Awaiting Billing</p>

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-400">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No completed jobs found.</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 8).map((row) => (
            <div
              key={row.jobId}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-200">
                  {row.customerId}
                </p>
                <p className="text-[10px] text-slate-500">Job {row.jobId.slice(0, 8)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.amount > 0 && (
                  <span className="text-xs font-medium text-slate-300">{fmt(row.amount)}</span>
                )}
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[row.invoiceStatus]}`}
                >
                  {STATUS_LABEL[row.invoiceStatus]}
                </span>
              </div>
            </div>
          ))}

          {rows.length > 8 && (
            <p className="pt-1 text-center text-[11px] text-slate-500">
              + {rows.length - 8} more completed jobs
            </p>
          )}
        </div>
      )}
    </div>
  );
}
