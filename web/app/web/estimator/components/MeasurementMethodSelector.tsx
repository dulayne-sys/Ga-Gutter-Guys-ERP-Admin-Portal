"use client";

export type MeasurementMethod = "manual" | "ai";

type MeasurementMethodSelectorProps = {
  value: MeasurementMethod | null;
  onChange: (value: MeasurementMethod) => void;
};

export function MeasurementMethodSelector({ value, onChange }: MeasurementMethodSelectorProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">Measurement Method</h2>
      <p className="mt-1 text-sm text-slate-400">Select manual map drawing or AI satellite auto-measurement.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange("manual")}
          className={`rounded-2xl border p-5 text-left transition ${
            value === "manual"
              ? "border-indigo-300/50 bg-indigo-500/15"
              : "border-white/10 bg-slate-950/40 hover:border-white/20"
          }`}
        >
          <h3 className="text-sm font-semibold text-white">Manual Drawing</h3>
          <p className="mt-2 text-xs text-slate-300">
            Draw gutter runs on satellite map, adjust line segments, and calculate linear feet in real time.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChange("ai")}
          className={`rounded-2xl border p-5 text-left transition ${
            value === "ai"
              ? "border-purple-300/50 bg-purple-500/15"
              : "border-white/10 bg-slate-950/40 hover:border-white/20"
          }`}
        >
          <h3 className="text-sm font-semibold text-white">AI Satellite Measurement</h3>
          <p className="mt-2 text-xs text-slate-300">
            Send address and context to Vertex-powered analysis to infer perimeter and return estimated footage.
          </p>
        </button>
      </div>
    </section>
  );
}
