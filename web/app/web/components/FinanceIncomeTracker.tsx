"use client";

import { useEffect, useState } from "react";
import { dataLoader } from "../lib/dataLoader";

type WeekBucket = {
  label: string; // "Mon Nov 4"
  weekKey: string; // "2024-11-04" — Monday of that week
  amount: number;
};

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

/** Convert Firestore Timestamp or ISO string to Date. */
const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Return the ISO date string of the Monday starting that week. */
const weekMonday = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

/** Short label for the Monday date: "Nov 4" */
const weekLabel = (mondayKey: string): string => {
  const d = new Date(mondayKey + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** Last N Monday keys (oldest → newest). */
const lastNMondayKeys = (n: number): string[] => {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    keys.push(weekMonday(d));
  }
  return keys;
};

function WeeklyBarChart({ weeks }: { weeks: WeekBucket[] }) {
  const max = Math.max(...weeks.map((w) => w.amount), 1);
  const CHART_H = 90;
  const BAR_W = 46;
  const GAP = 10;
  const START_X = 4;
  const START_Y = 12;
  const totalW = weeks.length * BAR_W + (weeks.length - 1) * GAP;

  return (
    <svg
      viewBox={`0 0 ${totalW + START_X * 2} ${CHART_H + 38}`}
      className="w-full"
      aria-label="Weekly revenue bar chart"
    >
      {/* Grid lines */}
      {[0, 0.5, 1].map((pct) => {
        const y = START_Y + CHART_H * (1 - pct);
        return (
          <line
            key={pct}
            x1={START_X}
            x2={START_X + totalW}
            y1={y}
            y2={y}
            stroke="rgba(148,163,184,0.12)"
            strokeDasharray="3 3"
          />
        );
      })}

      {weeks.map((week, i) => {
        const x = START_X + i * (BAR_W + GAP);
        const barH = Math.max(week.amount > 0 ? (week.amount / max) * CHART_H : 0, week.amount > 0 ? 3 : 0);
        const y = START_Y + CHART_H - barH;
        const isCurrent = i === weeks.length - 1;

        return (
          <g key={week.weekKey}>
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={BAR_W}
              height={barH}
              rx={4}
              fill={isCurrent ? "rgba(99,102,241,0.75)" : "rgba(99,102,241,0.3)"}
            />
            {/* Amount on top */}
            {week.amount > 0 && (
              <text
                x={x + BAR_W / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="9"
                fill={isCurrent ? "rgba(199,210,254,0.9)" : "rgba(148,163,184,0.6)"}
              >
                {week.amount >= 1000 ? `$${Math.round(week.amount / 1000)}k` : fmt(week.amount)}
              </text>
            )}
            {/* Week label */}
            <text
              x={x + BAR_W / 2}
              y={START_Y + CHART_H + 18}
              textAnchor="middle"
              fontSize="9"
              fill="rgba(100,116,139,0.9)"
            >
              {week.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function FinanceIncomeTracker() {
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [trendPct, setTrendPct] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const invoices = await dataLoader.getInvoices("paid");
        if (!active) return;

        const mondayKeys = lastNMondayKeys(8);
        const buckets: Record<string, number> = {};
        for (const key of mondayKeys) buckets[key] = 0;

        // Use oldest relevant week to filter
        const cutoff = new Date(mondayKeys[0] + "T00:00:00");

        for (const inv of invoices) {
          const date = toDate(inv.updatedAt) ?? toDate(inv.createdAt);
          if (!date || date < cutoff) continue;
          const key = weekMonday(date);
          if (key in buckets) {
            buckets[key] += Number(inv.amountDue ?? 0);
          }
        }

        const bucketList: WeekBucket[] = mondayKeys.map((key) => ({
          weekKey: key,
          label: weekLabel(key),
          amount: buckets[key] ?? 0,
        }));

        // Trend: last 4 weeks vs previous 4 weeks
        const recent = bucketList.slice(4).reduce((s, b) => s + b.amount, 0);
        const prior = bucketList.slice(0, 4).reduce((s, b) => s + b.amount, 0);
        const trend = prior > 0 ? ((recent - prior) / prior) * 100 : null;

        const total = bucketList.reduce((s, b) => s + b.amount, 0);

        setWeeks(bucketList);
        setTotalRevenue(total);
        setTrendPct(trend !== null ? Math.round(trend) : null);
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
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">Income Tracker</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {loading ? "—" : fmt(totalRevenue)}
          </p>
          <p className="text-xs text-slate-400">Total revenue · last 8 weeks</p>
        </div>

        {trendPct !== null && (
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
              trendPct >= 0
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-400/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {trendPct >= 0 ? "▲" : "▼"} {Math.abs(trendPct)}%
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-slate-400">Loading chart...</p>
        </div>
      ) : (
        <WeeklyBarChart weeks={weeks} />
      )}

      <p className="mt-2 text-[11px] text-slate-500">
        Source: paid invoices · darker bar = current week
      </p>
    </div>
  );
}
