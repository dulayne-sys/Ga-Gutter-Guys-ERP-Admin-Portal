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
  { name: "customerId", label: "Customer ID", type: "text", required: true },
  { name: "jobId", label: "Job ID", type: "text" },
  { name: "estimateId", label: "Estimate ID", type: "text" },
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
  { name: "dueDate", label: "Due Date", type: "date" },
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

const dateInputValue = (value: unknown) => {
  if (!value) return "";
  const source = typeof value === "object" && value && "toDate" in value
    ? (value as { toDate: () => Date }).toDate()
    : value;
  const date = new Date(String(source));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const toInvoiceValues = (row: TableRow | null): Record<string, string> => ({
  customerId: String(row?.customerId ?? ""),
  jobId: String(row?.jobId ?? ""),
  estimateId: String(row?.estimateId ?? ""),
  status: String(row?.status ?? "draft"),
  amountDue: String(row?.amountDue ?? "0"),
  dueDate: dateInputValue(row?.dueDate),
  qbSyncStatus: String(row?.qbSyncStatus ?? "pending"),
});

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [estimateFilter, setEstimateFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("");

  const isAdmin = currentUserRole === "admin";

  const filteredRows = useMemo(() => {
    const contextRows = invoices.filter((invoice) => {
      if (invoiceFilter && String(invoice.id ?? "") !== invoiceFilter) return false;
      if (estimateFilter && String(invoice.estimateId ?? "") !== estimateFilter) return false;
      return true;
    });

    if (!statusFilter) return contextRows;
    return contextRows.filter((invoice) => String(invoice.status ?? "") === statusFilter);
  }, [invoices, statusFilter, estimateFilter, invoiceFilter]);

  const stats = useMemo(() => {
    const outstanding = invoices
      .filter((invoice) => ["draft", "sent", "overdue"].includes(String(invoice.status ?? "")))
      .reduce((sum, invoice) => sum + Number(invoice.amountDue ?? 0), 0);

    const paid = invoices.filter((invoice) => String(invoice.status ?? "") === "paid").length;
    const overdue = invoices.filter((invoice) => String(invoice.status ?? "") === "overdue").length;
    const synced = invoices.filter((invoice) => String(invoice.qbSyncStatus ?? "") === "synced").length;

    return {
      outstanding,
      paid,
      overdue,
      synced,
    };
  }, [invoices]);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await dataLoader.getInvoices();
      setInvoices(rows);
      setSelectedRow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvoices();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEstimateFilter(params.get("estimateId") ?? "");
    setInvoiceFilter(params.get("invoiceId") ?? "");
  }, []);

  useEffect(() => {
    if (!invoices.length) return;

    if (invoiceFilter) {
      const found = invoices.find((invoice) => String(invoice.id ?? "") === invoiceFilter) ?? null;
      setSelectedRow(found);
      return;
    }

    if (estimateFilter) {
      const found = invoices.find((invoice) => String(invoice.estimateId ?? "") === estimateFilter) ?? null;
      setSelectedRow(found);
    }
  }, [invoices, estimateFilter, invoiceFilter]);

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

  const handleDelete = async () => {
    if (!isAdmin || !selectedRow?.id) return;
    if (!window.confirm("Delete selected invoice?")) return;

    try {
      setSubmitting(true);
      await dataLoader.deleteDocument("invoices", String(selectedRow.id));
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (values: Record<string, string>) => {
    if (!isAdmin) return;

    const payload = {
      customerId: values.customerId,
      jobId: values.jobId || null,
      estimateId: values.estimateId || null,
      status: values.status || "draft",
      amountDue: Number(values.amountDue || 0),
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      qbSyncStatus: values.qbSyncStatus || "pending",
      quickBooksInvoiceId: null,
      payment: null,
    };

    try {
      setSubmitting(true);

      if (modalMode === "create") {
        await dataLoader.createDocument("invoices", payload);
      }

      if (modalMode === "edit" && selectedRow?.id) {
        await dataLoader.updateDocument("invoices", String(selectedRow.id), payload);
      }

      setModalMode(null);
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  const clearContext = () => {
    setEstimateFilter("");
    setInvoiceFilter("");
    const nextUrl = `${window.location.pathname}`;
    window.history.replaceState({}, "", nextUrl);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Invoices</h1>
          <p className="mt-1 text-sm text-slate-400">Invoice management with QuickBooks sync.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadInvoices()} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            Reload
          </button>
          <button
            type="button"
            onClick={() => setModalMode("create")}
            disabled={!isAdmin}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Invoice
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding" value={`$${stats.outstanding.toLocaleString()}`} sublabel="Draft + sent + overdue" />
        <StatCard label="Paid" value={String(stats.paid)} sublabel="Completed invoices" />
        <StatCard label="Overdue" value={String(stats.overdue)} sublabel="Needs follow-up" />
        <StatCard label="QB Synced" value={String(stats.synced)} sublabel="QuickBooks connected" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["draft", "sent", "paid", "overdue"].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === status ? null : status))}
            className={`rounded-full px-3 py-2 text-xs font-medium transition ${
              statusFilter === status
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      {(estimateFilter || invoiceFilter) ? (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
          Context filter active
          {estimateFilter ? <span className="ml-2">estimateId: {estimateFilter}</span> : null}
          {invoiceFilter ? <span className="ml-2">invoiceId: {invoiceFilter}</span> : null}
          {selectedRow?.id ? <span className="ml-2">matched row selected</span> : null}
          <button
            type="button"
            onClick={clearContext}
            className="ml-3 rounded-md bg-cyan-400/20 px-2 py-1 text-[11px] font-semibold text-cyan-50 hover:bg-cyan-400/30"
          >
            Clear Context
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        Role: <span className="font-semibold text-white">{currentUserRole}</span>
        {selectedRow?.id ? <span className="ml-3">Selected ID: <span className="font-semibold text-white">{String(selectedRow.id)}</span></span> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalMode("edit")}
            disabled={!isAdmin || !selectedRow?.id || submitting}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit Selected
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!isAdmin || !selectedRow?.id || submitting}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Selected
          </button>
        </div>
      </div>

      <DataTable
        title="Invoices"
        columns={TABLE_DEFINITIONS.invoices}
        rows={filteredRows}
        loading={loading}
        onRowClick={setSelectedRow}
        highlightRowId={String(selectedRow?.id ?? "")}
      />

      {modalMode ? (
        <CrudRecordModal
          mode={modalMode}
          title={`${modalMode === "create" ? "Create" : "Edit"} Invoice`}
          fields={invoiceFields}
          initialValues={toInvoiceValues(modalMode === "edit" ? selectedRow : null)}
          submitting={submitting}
          onClose={() => setModalMode(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
