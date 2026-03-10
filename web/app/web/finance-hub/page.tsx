"use client";

import { useState } from "react";
import JobErpPage from "../job-erp/page";
import InvoicesPage from "../invoices/page";
import { FinanceIncomeTracker } from "../components/FinanceIncomeTracker";
import { FinanceProjectsAwaitingBilling } from "../components/FinanceProjectsAwaitingBilling";
import { FinanceCollectionsQueue } from "../components/FinanceCollectionsQueue";
import { FinanceRevenueSnapshot } from "../components/FinanceRevenueSnapshot";
import { FinanceInvoiceAging } from "../components/FinanceInvoiceAging";

type FinanceTab = "dashboard" | "job-erp" | "invoices";

const TAB_LABELS: Record<FinanceTab, string> = {
  dashboard: "Dashboard",
  "job-erp": "Job ERP",
  invoices: "Invoices",
};

export default function FinanceHubPage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Finance Hub</h1>
        <p className="mt-1 text-sm text-slate-400">
          Financial command center — income tracking, billing, collections, and invoice aging.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {(Object.keys(TAB_LABELS) as FinanceTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? "border border-indigo-400/30 bg-indigo-500/20 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ── */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {/* Row 1: Income Tracker (large, 2/3 width) + Projects Awaiting Billing (1/3) */}
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <FinanceIncomeTracker />
            <FinanceProjectsAwaitingBilling />
          </div>

          {/* Row 2: Collections Queue + Revenue Snapshot + Aging Invoices */}
          <div className="grid gap-4 md:grid-cols-3">
            <FinanceCollectionsQueue />
            <FinanceRevenueSnapshot />
            <FinanceInvoiceAging />
          </div>
        </div>
      )}

      {/* ── JOB ERP TAB ── */}
      {activeTab === "job-erp" && <JobErpPage />}

      {/* ── INVOICES TAB ── */}
      {activeTab === "invoices" && <InvoicesPage />}
    </div>
  );
}
