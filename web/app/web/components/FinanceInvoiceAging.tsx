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

type AgingBuckets = {
  current: number;   // not yet overdue
  days30: number;    // 1–30 days overdue
  days60: number;    // 31–60 days overdue
  days90: number;    // 61+ days overdue
  total: number;
};

type BandConfig = {
  key: keyof Omit<AgingBuckets, "total">;
  label: string;
  barColor: string;
  textColor: string;
  bgClass: string;
  borderClass: string;
};

const BANDS: BandConfig[] = [
  {
    key: "current",
    label: "Current",
    barColor: "rgb(52,211,153)",
    textColor: "text-emerald-300",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-400/30",
  },
  {
    key: "days30",
    label: "1–30 Days",
    barColor: "rgb(251,191,36)",
    textColor: "text-amber-300",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-400/30",
  },
  {
    key: "days60",
    label: "31–60 Days",
    barColor: "rgb(251,146,60)",
    textColor: "text-orange-300",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-400/30",
  },
  {
    key: "days90",
    label: "61+ Days",
    barColor: "rgb(248,113,113)",
    textColor: "text-rose-300",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-400/30",
  },
];

function SegmentedBar({ buckets }: { buckets: AgingBuckets }) {
  if (buckets.total === 0) return null;

  const segments = BANDS.map((b) => ({
    ...b,
    amount: buckets[b.key],
    pct: (buckets[b.key] / buckets.total) * 100,
  })).filter((s) => s.amount > 0);

  return (
    <div className="mt-4 space-y-1">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
        {segments.map((seg) => (
          <div
            key={seg.key}
            style={{
              width: `${seg.pct}%`,
              backgroundColor: seg.barColor,
              opacity: 0.75,
            }}
          />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: seg.barColor, opacity: 0.8 }}
            />
            <span className="text-[10px] text-slate-400">{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinanceInvoiceAging() {
  const [buckets, setBuckets] = useState<AgingBuckets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const invoices = await dataLoader.getInvoices();
        if (!active) return;

        const result: AgingBuckets = { current: 0, days30: 0, days60: 0, days90: 0, total: 0 };
        const now = Date.now();

        for (const inv of invoices) {
          if (String(inv.status ?? "") === "paid") continue;

          const amount = Number(inv.amountDue ?? 0);
          if (amount <= 0) continue;

          result.total += amount;

          const due = toDate(inv.dueDate);
          if (!due) {
            result.current += amount;
            continue;
          }

          const daysOverdue = Math.floor((now - due.getTime()) / (1000 * 60 * 60 * 24));

          if (daysOverdue <= 0) {
            result.current += amount;
          } else if (daysOverdue <= 30) {
            result.days30 += amount;
          } else if (daysOverdue <= 60) {
            result.days60 += amount;
          } else {
            result.days90 += amount;
          }
        }

        setBuckets(result);
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
      <p className="mb-4 text-[11px] uppercase tracking-[0.15em] text-slate-500">Invoice Aging</p>

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-400">Loading...</p>
      ) : !buckets || buckets.total === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No outstanding invoices.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {BANDS.map((band) => {
              const amount = buckets[band.key];
              return (
                <div
                  key={band.key}
                  className={`rounded-xl border p-3 ${band.bgClass} ${band.borderClass}`}
                >
                  <p className="text-[10px] text-slate-400">{band.label}</p>
                  <p className={`mt-1 text-base font-bold ${band.textColor}`}>
                    {fmt(amount)}
                  </p>
                </div>
              );
            })}
          </div>

          <SegmentedBar buckets={buckets} />

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <p className="text-xs text-slate-400">Total outstanding</p>
            <p className="text-sm font-semibold text-white">{fmt(buckets.total)}</p>
          </div>
        </>
      )}
    </div>
  );
}
