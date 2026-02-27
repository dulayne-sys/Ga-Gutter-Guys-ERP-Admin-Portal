"use client";

import { useState } from "react";
import { EnterpriseIcon } from "@/components/EnterpriseIcon";

export function ShieldAiWidget() {
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);

  return (
    <>
      {showHint && !open ? (
        <div className="fixed bottom-24 right-5 z-[10001] max-w-64 rounded-xl border border-cyan-400/40 bg-slate-800/95 p-3 text-xs text-slate-100 shadow-lg">
          <div className="flex items-start gap-2">
            <p className="flex-1">
              Use Shield AI for daily assistance, route optimization, and operational insights.
            </p>
            <button
              type="button"
              aria-label="Dismiss hint"
              onClick={() => setShowHint(false)}
              className="text-slate-400 transition hover:text-slate-200"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Toggle Shield AI"
        onClick={() => {
          setOpen((value) => !value);
          setShowHint(false);
        }}
        className="fixed bottom-5 right-5 z-[10000] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-sky-500 text-2xl text-slate-950 shadow-lg transition hover:scale-105"
      >
        <EnterpriseIcon name="shield" className="h-6 w-6" />
      </button>

      <aside
        className={`fixed right-0 top-0 z-[10000] flex h-screen w-[360px] flex-col border-l border-white/15 bg-slate-900/95 shadow-2xl backdrop-blur transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="border-b border-white/10 bg-cyan-400/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-cyan-400 to-sky-500 text-base text-slate-950">
                <EnterpriseIcon name="shield" className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Shield AI</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Intelligent Assistant</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-white/20 px-2 py-1 text-xs text-slate-300 transition hover:bg-white/5"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-slate-400">Your AI-powered operations assistant</p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-slate-100">
            <p className="font-semibold text-cyan-300">Welcome to Shield AI!</p>
            <p className="mt-1">I can help optimize routes, analyze job performance, and surface operational insights.</p>
          </div>

          <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-slate-100">
            <p className="font-semibold">Today&apos;s Territory Analysis</p>
            <p className="mt-1">
              Your optimized route saves <span className="text-cyan-300">15 minutes</span> of travel time versus sequential scheduling.
            </p>
          </div>

          <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-slate-100">
            <p className="font-semibold text-amber-300">Smart Insight</p>
            <p className="mt-1">Two Thursday appointments overlap. Consider moving the 2:00 PM slot.</p>
          </div>

          <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-slate-100">
            <p className="font-semibold text-cyan-300">Coming Soon</p>
            <p className="mt-1">Real-time traffic integration, predictive job duration, and automated crew assignment.</p>
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              disabled
              placeholder="Ask Shield AI…"
              className="w-full cursor-not-allowed rounded-lg border border-white/20 bg-slate-950/70 px-3 py-2 text-xs text-slate-500"
            />
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg bg-cyan-400/30 px-3 py-2 text-xs font-semibold text-slate-900"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-500">Demo Mode - Interactive AI features coming in Phase 7</p>
        </div>
      </aside>
    </>
  );
}
