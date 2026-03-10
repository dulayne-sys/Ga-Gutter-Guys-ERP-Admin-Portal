"use client";

import { useState } from "react";
import JobErpPage from "../job-erp/page";
import InvoicesPage from "../invoices/page";

type FinanceTab = "dashboard" | "job-erp" | "invoices";

const TAB_LABELS: Record<FinanceTab, string> = {
  dashboard: "Dashboard",
  "job-erp": "Job ERP",
  invoices: "Invoices",
};

export default function FinanceHubPage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>("job-erp");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Finance Hub</h1>
        <p className="mt-1 text-sm text-slate-400">
          Financial operations — job costing, invoicing, and revenue tracking.
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

      {/* Dashboard tab — overview and navigation */}
      {activeTab === "dashboard" && (
        <div className="grid gap-4 md:grid-cols-2">
          <HubCard
            title="Job ERP"
            description="Comprehensive job and invoice management. Track job status, link invoices, manage QuickBooks sync, and monitor completion milestones."
            action="Open Job ERP"
            onAction={() => setActiveTab("job-erp")}
          />
          <HubCard
            title="Invoices"
            description="Full invoice lifecycle management. Create, track, and sync invoices with QuickBooks. Monitor payment status and aging reports."
            action="Open Invoices"
            onAction={() => setActiveTab("invoices")}
          />
        </div>
      )}

      {activeTab === "job-erp" && <JobErpPage />}
      {activeTab === "invoices" && <InvoicesPage />}
    </div>
  );
}

function HubCard({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="mt-auto rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20"
      >
        {action}
      </button>
    </div>
  );
}
