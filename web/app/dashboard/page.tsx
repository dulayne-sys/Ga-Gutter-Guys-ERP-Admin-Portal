"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { KpiCard } from "@/components/KpiCard";
import { RouteMap } from "@/components/RouteMap";
import { apiGetDailyRoute, apiGetDashboardKPIs } from "@/lib/api";
import type { DashboardKpis } from "@/types/kpi";
import type { RouteDoc } from "@/types/route";

const getToday = (): string => new Date().toISOString().split("T")[0];

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

const fallbackKpis = (route: RouteDoc | null): DashboardKpis => {
  if (!route) {
    return { revenueTotal: 0, stopCount: 0, miles: 0, minutes: 0, efficiencyScore: 0 };
  }

  return {
    revenueTotal: route.revenueTotal ?? 0,
    stopCount: route.stopCount ?? route.stops.length,
    miles: route.totals?.miles ?? 0,
    minutes: route.totals?.minutes ?? 0,
    efficiencyScore: route.efficiencyScore ?? 0,
    fuelCost: route.fuelCost,
    laborDriveCost: route.laborDriveCost,
    routeCost: route.routeCost,
    profitEstimate: route.profitEstimate,
  };
};

export default function DashboardPage() {
  const [date, setDate] = useState(getToday());
  const [route, setRoute] = useState<RouteDoc | null>(null);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [routeResponse, kpiResponse] = await Promise.all([
          apiGetDailyRoute(date),
          apiGetDashboardKPIs().catch(() => null),
        ]);

        if (!active) return;

        const nextRoute = (routeResponse.route ?? null) as RouteDoc | null;
        setRoute(nextRoute);
        setKpis(kpiResponse ? (kpiResponse as DashboardKpis) : fallbackKpis(nextRoute));
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load dashboard.";
        setError(message);
        setRoute(null);
        setKpis(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [date]);

  const displayKpis = useMemo(() => kpis ?? fallbackKpis(route), [kpis, route]);

  return (
    <AuthGate title="Dashboard">
      <section className="fade-in rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Daily Route Snapshot</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Route Intelligence</h2>
          </div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Route Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 block rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white"
            />
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-5">
        <KpiCard label="Revenue" value={formatCurrency(displayKpis.revenueTotal)} />
        <KpiCard label="Stops" value={String(displayKpis.stopCount)} accent="text-cyan-200" />
        <KpiCard label="Miles" value={`${displayKpis.miles.toFixed(1)} mi`} accent="text-sky-200" />
        <KpiCard label="Time" value={`${displayKpis.minutes.toFixed(0)} min`} accent="text-slate-100" />
        <KpiCard label="Efficiency" value={`${displayKpis.efficiencyScore.toFixed(0)}`} accent="text-amber-200" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <h3 className="text-sm uppercase tracking-[0.3em] text-slate-400">Route Map</h3>
          <RouteMap route={route} />
        </div>
        <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-sm uppercase tracking-[0.3em] text-slate-400">Financial Breakdown</h3>
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>Fuel Cost</span>
              <span>{formatCurrency(displayKpis.fuelCost ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Labor Drive Cost</span>
              <span>{formatCurrency(displayKpis.laborDriveCost ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total Route Cost</span>
              <span>{formatCurrency(displayKpis.routeCost ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-200">
              <span>Profit Estimate</span>
              <span>{formatCurrency(displayKpis.profitEstimate ?? 0)}</span>
            </div>
          </div>
          {loading ? <p className="text-xs text-slate-500">Updating KPI feed...</p> : null}
        </div>
      </section>
    </AuthGate>
  );
}
