"use client";

import { useEffect, useState } from "react";
import { disconnectQuickBooks, getQuickBooksStatus, startQuickBooksAuth } from "../lib/quickbooks";

type QuickBooksStatusProps = {
  compact?: boolean;
};

export function QuickBooksStatus({ compact = false }: QuickBooksStatusProps) {
  const [connected, setConnected] = useState(false);
  const [realmId, setRealmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const status = await getQuickBooksStatus();
      setConnected(status.connected);
      setRealmId(status.realmId);
    } catch {
      setConnected(false);
      setRealmId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    setConnectError(null);
    try {
      const authUrl = await startQuickBooksAuth();
      window.location.assign(authUrl);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to start QuickBooks authorization.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectQuickBooks();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">QuickBooks</p>
      <p className="mt-1 text-sm font-medium text-white">
        {loading ? "Checking..." : connected ? "Connected" : "Not Connected"}
      </p>
      {!compact ? <p className="mt-1 text-xs text-slate-400">{realmId ? `Company ID: ${realmId}` : "Connect your QuickBooks company account."}</p> : null}
      {connectError ? (
        <p className="mt-1 text-xs text-rose-300">{connectError}</p>
      ) : null}
      <button
        type="button"
        onClick={connected ? handleDisconnect : handleConnect}
        disabled={loading || busy}
        className="mt-3 w-full rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Working..." : connected ? "Disconnect" : "Connect"}
      </button>
    </div>
  );
}
