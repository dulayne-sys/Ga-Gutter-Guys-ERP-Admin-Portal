"use client";

import { useState } from "react";
import CrmPage from "../crm/page";
import SalesHomePage from "../sales-home/page";
import SalesOpsPage from "../sales-ops/page";
import ContactsPage from "../contacts/page";

type CrmTab = "dashboard" | "pipeline" | "sales-ops" | "contacts";
type PipelineSubTab = "leads" | "sales";

const TAB_LABELS: Record<CrmTab, string> = {
  dashboard: "Dashboard",
  pipeline: "Pipeline",
  "sales-ops": "Sales Ops",
  contacts: "Contacts",
};

export default function CrmHubPage() {
  const [activeTab, setActiveTab] = useState<CrmTab>("pipeline");
  const [pipelineTab, setPipelineTab] = useState<PipelineSubTab>("leads");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">CRM Hub</h1>
        <p className="mt-1 text-sm text-slate-400">
          Unified CRM — leads, pipeline, sales ops, and contacts.
        </p>
      </div>

      {/* Primary tab bar */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {(Object.keys(TAB_LABELS) as CrmTab[]).map((tab) => (
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
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HubCard
              title="Lead Pipeline"
              description="Track leads through your sales funnel. View win rates, open opportunities, and conversion metrics."
              action="Open Lead Pipeline"
              onAction={() => {
                setActiveTab("pipeline");
                setPipelineTab("leads");
              }}
            />
            <HubCard
              title="Sales Pipeline"
              description="Manage estimates and leads together. Handle handoffs to operations and track total pipeline value."
              action="Open Sales Pipeline"
              onAction={() => {
                setActiveTab("pipeline");
                setPipelineTab("sales");
              }}
            />
            <HubCard
              title="Sales Ops"
              description="Operations view combining jobs and invoices. Coordinate between sales and field teams efficiently."
              action="Open Sales Ops"
              onAction={() => setActiveTab("sales-ops")}
            />
            <HubCard
              title="Contacts"
              description="Unified directory for customers, leads, and vendors. Full contact management in one place."
              action="Open Contacts"
              onAction={() => setActiveTab("contacts")}
            />
          </div>
        </div>
      )}

      {/* Pipeline tab — secondary tabs for lead and sales pipeline */}
      {activeTab === "pipeline" && (
        <div className="space-y-5">
          <div className="flex w-fit gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            {(["leads", "sales"] as PipelineSubTab[]).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setPipelineTab(sub)}
                className={`rounded-md px-5 py-1.5 text-sm font-medium transition ${
                  pipelineTab === sub
                    ? "border border-indigo-400/30 bg-indigo-500/20 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {sub === "leads" ? "Lead Pipeline" : "Sales Pipeline"}
              </button>
            ))}
          </div>
          {pipelineTab === "leads" && <CrmPage />}
          {pipelineTab === "sales" && <SalesHomePage />}
        </div>
      )}

      {activeTab === "sales-ops" && <SalesOpsPage />}
      {activeTab === "contacts" && <ContactsPage />}
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
