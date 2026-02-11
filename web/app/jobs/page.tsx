"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { RouteMap } from "@/components/RouteMap";
import {
  apiAiPrioritizeRoute,
  apiGetDailyRoute,
  apiOptimizeDailyRoute,
  apiReorderStops,
  apiUpdateJobPriority,
} from "@/lib/api";
import type { RouteDoc, RouteStop } from "@/types/route";

const getToday = (): string => new Date().toISOString().split("T")[0];

export default function JobsPage() {
  const [date, setDate] = useState(getToday());
  const [route, setRoute] = useState<RouteDoc | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stops = useMemo(() => route?.stops ?? [], [route]);

  const loadRoute = async () => {
    setError(null);
    const response = await apiGetDailyRoute(date);
    setRoute(response.route as RouteDoc);
  };

  useEffect(() => {
    loadRoute().catch((err) => {
      const message = err instanceof Error ? err.message : "Failed to load route.";
      setError(message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const handleDrop = (index: number) => {
    if (dragIndex == null || dragIndex === index || !route) return;
    const updated = [...route.stops];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setRoute({ ...route, stops: updated });
    setDragIndex(null);
  };

  const handleSaveOrder = async () => {
    if (!route) return;
    setBusy(true);
    try {
      const orderedJobIds = route.stops.map((stop) => stop.jobId);
      const response = await apiReorderStops({ date, orderedJobIds });
      setRoute(response.route as RouteDoc);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reorder stops.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleOptimize = async () => {
    setBusy(true);
    try {
      const response = await apiOptimizeDailyRoute({ date, mode: "optimizeOrder" });
      setRoute(response.route as RouteDoc);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Optimize failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleAiPrioritize = async () => {
    setBusy(true);
    try {
      await apiAiPrioritizeRoute({ date });
      await loadRoute();
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI prioritize failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const updatePriority = async (stop: RouteStop, priorityRank: number) => {
    setBusy(true);
    try {
      await apiUpdateJobPriority({ jobId: stop.jobId, priorityRank });
      await loadRoute();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Priority update failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthGate title="Jobs">
      <section className="fade-in rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Route Operations</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Stop Manager</h2>
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
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleOptimize}
            disabled={busy}
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white transition hover:border-white/60 disabled:opacity-60"
          >
            Optimize Route
          </button>
          <button
            type="button"
            onClick={handleAiPrioritize}
            disabled={busy}
            className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs text-amber-100 transition hover:border-amber-300 disabled:opacity-60"
          >
            AI Prioritize
          </button>
          <button
            type="button"
            onClick={handleSaveOrder}
            disabled={busy}
            className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-xs text-cyan-100 transition hover:border-cyan-300 disabled:opacity-60"
          >
            Save Order
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <h3 className="text-sm uppercase tracking-[0.3em] text-slate-400">Stops</h3>
          <div className="space-y-3">
            {stops.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                No stops available for this date.
              </div>
            ) : (
              stops.map((stop, index) => (
                <div
                  key={stop.jobId}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="text-xs text-slate-500">Stop {index + 1}</p>
                    <p className="text-slate-200">{stop.customerName ?? stop.address}</p>
                    <p className="text-xs text-slate-500">{stop.address}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={stop.rank}
                      onChange={(event) => updatePriority(stop, Number(event.target.value))}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white"
                    >
                      {Array.from({ length: 10 }, (_, item) => item + 1).map((value) => (
                        <option key={value} value={value}>
                          Priority {value}
                        </option>
                      ))}
                    </select>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                      {stop.status ?? "Pending"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-sm uppercase tracking-[0.3em] text-slate-400">Route Map</h3>
          <RouteMap route={route} />
        </div>
      </section>
    </AuthGate>
  );
}
