"use client";

import { useEffect, useState } from "react";
import { apiGetQboStatus, apiStartQboAuth, apiDisconnectQbo } from "@/lib/api";

type IntegrationStatus = "connected" | "disconnected" | "error" | "loading" | "active" | "unknown";

type Integration = {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  lastSync: string | null;
  details: string | null;
};

const STATUS_COLORS: Record<IntegrationStatus, string> = {
  connected: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  active: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  disconnected: "border-slate-400/40 bg-slate-500/10 text-slate-300",
  error: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  loading: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  unknown: "border-slate-400/40 bg-slate-500/10 text-slate-400",
};

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  connected: "Connected",
  active: "Active",
  disconnected: "Disconnected",
  error: "Error",
  loading: "Checking...",
  unknown: "Unknown",
};

export default function IntegrationsPage() {
  const [qbStatus, setQbStatus] = useState<IntegrationStatus>("loading");
  const [qbLastSync, setQbLastSync] = useState<string | null>(null);
  const [qbDetails, setQbDetails] = useState<string | null>(null);
  const [qbBusy, setQbBusy] = useState(false);

  const refreshQb = async () => {
    setQbStatus("loading");
    try {
      const status = await apiGetQboStatus();
      setQbStatus(status.connected ? "connected" : "disconnected");
      setQbDetails(status.realmId ? `Company ID: ${status.realmId}` : null);
      setQbLastSync(status.updatedAt ?? null);
    } catch {
      setQbStatus("error");
      setQbDetails("Unable to reach QuickBooks service.");
    }
  };

  useEffect(() => {
    void refreshQb();
  }, []);

  const handleQbConnect = async () => {
    setQbBusy(true);
    try {
      const result = await apiStartQboAuth({ returnPath: "/web/integrations" });
      window.location.assign(result.authUrl);
    } catch {
      setQbStatus("error");
    } finally {
      setQbBusy(false);
    }
  };

  const handleQbDisconnect = async () => {
    if (!window.confirm("Disconnect QuickBooks? This will stop data sync.")) return;
    setQbBusy(true);
    try {
      await apiDisconnectQbo();
      await refreshQb();
    } catch {
      setQbStatus("error");
    } finally {
      setQbBusy(false);
    }
  };

  const formatDate = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  };

  const integrations: Integration[] = [
    {
      id: "quickbooks",
      name: "QuickBooks Online",
      description: "Sync customers, invoices, and payment status with QuickBooks.",
      status: qbStatus,
      lastSync: qbLastSync,
      details: qbDetails,
    },
    {
      id: "ai",
      name: "AI Tools (Vertex AI)",
      description: "Satellite measurement, route optimization, and AI-powered estimating.",
      status: "active",
      lastSync: null,
      details: "Vertex AI via Google Cloud — active for estimator and route planning.",
    },
    {
      id: "gcal",
      name: "Google Calendar",
      description: "Sync job schedule events with your Google Calendar.",
      status: "unknown",
      lastSync: null,
      details: "Connect via Calendar settings to enable two-way sync.",
    },
    {
      id: "future1",
      name: "Future Integration",
      description: "Additional integrations will appear here as they are configured.",
      status: "unknown",
      lastSync: null,
      details: null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Integrations</h1>
        <p className="mt-1 text-sm text-slate-400">Manage connected services, sync status, and integration health.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            onRefresh={integration.id === "quickbooks" ? () => void refreshQb() : undefined}
            onConnect={
              integration.id === "quickbooks" && integration.status === "disconnected"
                ? () => void handleQbConnect()
                : undefined
            }
            onDisconnect={
              integration.id === "quickbooks" && integration.status === "connected"
                ? () => void handleQbDisconnect()
                : undefined
            }
            busy={integration.id === "quickbooks" ? qbBusy : false}
            formatDate={formatDate}
          />
        ))}
      </div>

      {/* Legend */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Status Legend</h2>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(STATUS_LABELS) as IntegrationStatus[])
            .filter((s) => s !== "loading")
            .map((s) => (
              <span key={s} className={`inline-flex rounded-full border px-3 py-1 text-xs ${STATUS_COLORS[s]}`}>
                {STATUS_LABELS[s]}
              </span>
            ))}
        </div>
      </section>
    </div>
  );
}

type IntegrationCardProps = {
  integration: Integration;
  onRefresh?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  busy?: boolean;
  formatDate: (iso: string | null) => string;
};

function IntegrationCard({ integration, onRefresh, onConnect, onDisconnect, busy, formatDate }: IntegrationCardProps) {
  const statusColor = STATUS_COLORS[integration.status];
  const statusLabel = STATUS_LABELS[integration.status];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{integration.name}</h2>
          <p className="mt-0.5 text-xs text-slate-400">{integration.description}</p>
        </div>
        <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 space-y-1.5 text-xs text-slate-400">
        <div className="flex justify-between">
          <span>Last Sync</span>
          <span className="text-slate-300">{formatDate(integration.lastSync)}</span>
        </div>
        {integration.details ? (
          <div className="flex justify-between">
            <span>Details</span>
            <span className="max-w-[60%] text-right text-slate-300">{integration.details}</span>
          </div>
        ) : null}
      </div>

      {(onRefresh ?? onConnect ?? onDisconnect) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={busy ?? false}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
            >
              Refresh Status
            </button>
          ) : null}
          {onConnect ? (
            <button
              type="button"
              onClick={onConnect}
              disabled={busy ?? false}
              className="rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {busy ? "Working..." : "Connect"}
            </button>
          ) : null}
          {onDisconnect ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busy ?? false}
              className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {busy ? "Working..." : "Disconnect"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
