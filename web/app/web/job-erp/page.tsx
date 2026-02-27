"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase";
import { DataTable } from "../components/DataTable";
import { StatCard } from "../components/StatCard";
import CrudRecordModal, { type CrudFieldDefinition } from "../components/modals/CrudRecordModal";
import { dataLoader, type TableRow } from "../lib/dataLoader";
import { TABLE_DEFINITIONS } from "../lib/tableDefinitions";

type UserRole = "admin" | "sales" | "field" | "unknown";

const invoiceFields: CrudFieldDefinition[] = [
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { label: "Draft", value: "draft" },
      { label: "Sent", value: "sent" },
      { label: "Paid", value: "paid" },
      { label: "Overdue", value: "overdue" },
    ],
  },
  { name: "amountDue", label: "Amount Due", type: "number", required: true },
  {
    name: "qbSyncStatus",
    label: "QB Sync Status",
    type: "select",
    options: [
      { label: "Pending", value: "pending" },
      { label: "Synced", value: "synced" },
    ],
  },
];

const toInvoiceValues = (row: TableRow | null): Record<string, string> => ({
  status: String(row?.status ?? "draft"),
  amountDue: String(row?.amountDue ?? "0"),
  qbSyncStatus: String(row?.qbSyncStatus ?? "pending"),
});

export default function JobErpPage() {
  const [jobs, setJobs] = useState<TableRow[]>([]);
  const [invoices, setInvoices] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [selectedInvoice, setSelectedInvoice] = useState<TableRow | null>(null);
  const [modalMode, setModalMode] = useState<"edit" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [estimateFilter, setEstimateFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");

  const isAdmin = currentUserRole === "admin";

  const stats = useMemo(() => {
    const activeJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(String(job.status ?? ""))).length;
    const completedJobs = jobs.filter((job) => String(job.status ?? "") === "completed").length;
    const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.amountDue ?? 0), 0);
    const paidRevenue = invoices
      .filter((invoice) => String(invoice.status ?? "") === "paid")
      .reduce((sum, invoice) => sum + Number(invoice.amountDue ?? 0), 0);
    const outstanding = invoices
      .filter((invoice) => ["sent", "overdue", "draft"].includes(String(invoice.status ?? "")))
      .reduce((sum, invoice) => sum + Number(invoice.amountDue ?? 0), 0);

    const completionRate = jobs.length > 0 ? Math.round((completedJobs / jobs.length) * 100) : 0;

    return {
      activeJobs,
      completedJobs,
      totalInvoiced,
      paidRevenue,
      outstanding,
      completionRate,
    };
  }, [jobs, invoices]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (jobFilter && String(job.id ?? "") !== jobFilter) return false;
      if (estimateFilter && String(job.estimateId ?? "") !== estimateFilter) return false;
      return true;
    });
  }, [jobs, jobFilter, estimateFilter]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (invoiceFilter && String(invoice.id ?? "") !== invoiceFilter) return false;
      if (estimateFilter && String(invoice.estimateId ?? "") !== estimateFilter) return false;
      if (jobFilter && String(invoice.jobId ?? "") !== jobFilter) return false;
      return true;
    });
  }, [invoices, estimateFilter, jobFilter, invoiceFilter]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [jobsRows, invoiceRows] = await Promise.all([
        dataLoader.getJobs(),
        dataLoader.getInvoices(),
      ]);

      setJobs(jobsRows);
      setInvoices(invoiceRows);
      setSelectedInvoice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ERP data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEstimateFilter(params.get("estimateId") ?? "");
    setJobFilter(params.get("jobId") ?? "");
    setInvoiceFilter(params.get("invoiceId") ?? "");
  }, []);

  useEffect(() => {
    if (!invoices.length) return;

    if (invoiceFilter) {
      const found = invoices.find((invoice) => String(invoice.id ?? "") === invoiceFilter) ?? null;
      setSelectedInvoice(found);
      return;
    }

    if (estimateFilter || jobFilter) {
      const found = invoices.find((invoice) => {
        if (jobFilter && String(invoice.jobId ?? "") !== jobFilter) return false;
        if (estimateFilter && String(invoice.estimateId ?? "") !== estimateFilter) return false;
        return true;
      }) ?? null;
      setSelectedInvoice(found);
    }
  }, [invoices, estimateFilter, jobFilter, invoiceFilter]);

  useEffect(() => {
    if (!auth || !firestore) return;
    const db = firestore;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUserRole("unknown");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = String(userDoc.data()?.role ?? "unknown") as UserRole;
        if (role === "admin" || role === "sales" || role === "field") {
          setCurrentUserRole(role);
        } else {
          setCurrentUserRole("unknown");
        }
      } catch {
        setCurrentUserRole("unknown");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleInvoiceUpdate = async (values: Record<string, string>) => {
    if (!isAdmin || !selectedInvoice?.id) return;

    try {
      setSubmitting(true);
      await dataLoader.updateDocument("invoices", String(selectedInvoice.id), {
        status: values.status,
        amountDue: Number(values.amountDue || 0),
        qbSyncStatus: values.qbSyncStatus || "pending",
      });

      setModalMode(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!isAdmin || !selectedInvoice?.id) return;

    try {
      setSubmitting(true);
      await dataLoader.updateDocument("invoices", String(selectedInvoice.id), {
        status: "paid",
        payment: {
          paidAt: new Date(),
          method: "manual",
          txnId: null,
        },
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark invoice paid.");
    } finally {
      setSubmitting(false);
    }
  };

  const clearContext = () => {
    setEstimateFilter("");
    setJobFilter("");
    setInvoiceFilter("");
    const nextUrl = `${window.location.pathname}`;
    window.history.replaceState({}, "", nextUrl);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Job ERP</h1>
          <p className="mt-1 text-sm text-slate-400">Financial tracking, reconciliation, and collection workflow.</p>
        </div>
        <button type="button" onClick={() => void loadData()} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
          Reload
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active Jobs" value={String(stats.activeJobs)} sublabel="Scheduled + in progress" />
        <StatCard label="Completion" value={`${stats.completionRate}%`} sublabel="Jobs completed" />
        <StatCard label="Invoiced" value={`$${stats.totalInvoiced.toLocaleString()}`} sublabel="Gross billed" />
        <StatCard label="Paid" value={`$${stats.paidRevenue.toLocaleString()}`} sublabel="Collected revenue" />
        <StatCard label="Outstanding" value={`$${stats.outstanding.toLocaleString()}`} sublabel="Receivables" />
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      {(estimateFilter || jobFilter || invoiceFilter) ? (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
          Context filter active
          {estimateFilter ? <span className="ml-2">estimateId: {estimateFilter}</span> : null}
          {jobFilter ? <span className="ml-2">jobId: {jobFilter}</span> : null}
          {invoiceFilter ? <span className="ml-2">invoiceId: {invoiceFilter}</span> : null}
          {selectedInvoice?.id ? <span className="ml-2">matched invoice selected</span> : null}
          <button
            type="button"
            onClick={clearContext}
            className="ml-3 rounded-md bg-cyan-400/20 px-2 py-1 text-[11px] font-semibold text-cyan-50 hover:bg-cyan-400/30"
          >
            Clear Context
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <DataTable
          title="Invoice Ledger"
          columns={TABLE_DEFINITIONS.invoices}
          rows={filteredInvoices}
          loading={loading}
          onRowClick={setSelectedInvoice}
          highlightRowId={String(selectedInvoice?.id ?? "")}
        />

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white">ERP Actions</h2>
          <p className="mt-1 text-xs text-slate-400">Select an invoice row to run finance actions.</p>

          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div>
              <p className="text-xs text-slate-500">Role</p>
              <p className="font-semibold text-white">{currentUserRole}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Selected Invoice</p>
              <p className="font-semibold text-white">{String(selectedInvoice?.id ?? "None")}</p>
              <p className="text-xs text-slate-400">Status: {String(selectedInvoice?.status ?? "")}</p>
            </div>

            <button
              type="button"
              onClick={() => setModalMode("edit")}
              disabled={!isAdmin || !selectedInvoice || submitting}
              className="w-full rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Edit Invoice Financials
            </button>

            <button
              type="button"
              onClick={() => void handleMarkPaid()}
              disabled={!isAdmin || !selectedInvoice || submitting}
              className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark Invoice Paid
            </button>
          </div>
        </section>
      </div>

      <DataTable
        title="Operational Jobs Snapshot"
        columns={TABLE_DEFINITIONS.jobs}
        rows={filteredJobs.slice(0, 12)}
        loading={loading}
        searchable={false}
      />

      {modalMode ? (
        <CrudRecordModal
          mode="edit"
          title="Edit Invoice Financials"
          fields={invoiceFields}
          initialValues={toInvoiceValues(selectedInvoice)}
          submitting={submitting}
          onClose={() => setModalMode(null)}
          onSubmit={handleInvoiceUpdate}
        />
      ) : null}
    </div>
  );
}
