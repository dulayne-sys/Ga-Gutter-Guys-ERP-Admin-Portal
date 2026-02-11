"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { EstimatorMap } from "@/components/EstimatorMap";
import { apiCreateEstimate, apiGetEstimates } from "@/lib/api";
import type { Estimate } from "@/types/estimate";

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

export default function EstimatorPage() {
  const [feet, setFeet] = useState(0);
  const [pricePerFoot, setPricePerFoot] = useState(12);
  const [multiplier, setMultiplier] = useState(1.1);
  const [jobId, setJobId] = useState("");
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPrice = useMemo(() => feet * pricePerFoot * multiplier, [feet, pricePerFoot, multiplier]);

  const loadEstimates = async () => {
    const data = await apiGetEstimates(jobId.trim() || undefined);
    if (Array.isArray(data)) {
      setEstimates(data as Estimate[]);
    }
  };

  useEffect(() => {
    loadEstimates().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await apiCreateEstimate({
        totalFeet: feet,
        pricePerFoot,
        multiplier,
        totalPrice,
        jobId: jobId.trim() || undefined,
      });
      await loadEstimates();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save estimate.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGate title="Estimator">
      <section className="fade-in rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">AI Assisted Estimation</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Linear Footage Capture</h2>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs text-cyan-200">
            Total Feet: {feet.toFixed(1)}
          </div>
        </div>
      </section>

      <EstimatorMap onFeetChange={setFeet} />

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-sm uppercase tracking-[0.3em] text-slate-400">Pricing Inputs</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm text-slate-200">
              Price / Foot
              <input
                type="number"
                min={0}
                step={0.1}
                value={pricePerFoot}
                onChange={(event) => setPricePerFoot(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              Multiplier
              <input
                type="number"
                min={0}
                step={0.05}
                value={multiplier}
                onChange={(event) => setMultiplier(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
              />
            </label>
            <label className="text-sm text-slate-200">
              Job ID (optional)
              <input
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
              />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total Estimate</p>
              <p className="text-2xl font-semibold text-emerald-200">{formatCurrency(totalPrice)}</p>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full bg-emerald-300/90 px-6 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-200 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Estimate"}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-sm uppercase tracking-[0.3em] text-slate-400">Recent Estimates</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            {estimates.length === 0 ? (
              <p className="text-slate-500">No estimates yet.</p>
            ) : (
              estimates.map((estimate, index) => (
                <div key={`${estimate.id ?? "estimate"}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span>#{estimate.jobId ?? "N/A"}</span>
                    <span className="text-emerald-200">
                      {formatCurrency(estimate.totalPrice ?? estimate.amount ?? 0)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {estimate.createdAt
                      ? new Date(estimate.createdAt).toLocaleDateString()
                      : "Pending"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
