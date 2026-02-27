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

const jobStatusFields: CrudFieldDefinition[] = [
  {
    name: "status",
    label: "Job Status",
    type: "select",
    required: true,
    options: [
      { label: "Scheduled", value: "scheduled" },
      { label: "In Progress", value: "in_progress" },
      { label: "Completed", value: "completed" },
      { label: "On Hold", value: "on_hold" },
    ],
  },
  { name: "arrivalWindow", label: "Arrival Window", type: "text", placeholder: "8am - 12pm" },
  { name: "jobNotes", label: "Ops Notes", type: "textarea" },
];

const invoiceFields: CrudFieldDefinition[] = [
  {
    name: "status",
    label: "Invoice Status",
    type: "select",
    required: true,
    options: [
      { label: "Draft", value: "draft" },
      { label: "Sent", value: "sent" },
      { label: "Paid", value: "paid" },
      { label: "Overdue", value: "overdue" },
    ],
  },
  {
    name: "qbSyncStatus",
    label: "QB Sync",
    type: "select",
    options: [
      { label: "Pending", value: "pending" },
      { label: "Synced", value: "synced" },
    ],
  },
];

const splitCsv = (value: string): string[] =>
  value.split(",").map((part) => part.trim()).filter(Boolean);

export default function SalesOpsPage() {
  const [jobs, setJobs] = useState<TableRow[]>([]);
  const [invoices, setInvoices] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<TableRow | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<TableRow | null>(null);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canEditSelectedJob = useMemo(() => {
    if (!selectedJob) return false;
    if (currentUserRole === "admin") return true;
    if (currentUserRole !== "field" || !currentUserUid) return false;

    const crew = selectedJob.schedule && typeof selectedJob.schedule === "object"
      ? (selectedJob.schedule as { crew?: string[] }).crew
      : undefined;

    return Array.isArray(crew) && crew.includes(currentUserUid);
  }, [selectedJob, currentUserRole, currentUserUid]);

  const canEditSelectedInvoice = currentUserRole === "admin" && Boolean(selectedInvoice);

  const stats = useMemo(() => {
    const activeJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(String(job.status ?? ""))).length;
    const overdueInvoices = invoices.filter((invoice) => String(invoice.status ?? "") === "overdue").length;
    const outstanding = invoices
      .filter((invoice) => ["draft", "sent", "overdue"].includes(String(invoice.status ?? "")))
      .reduce((sum, invoice) => sum + Number(invoice.amountDue ?? 0), 0);
    const completedJobs = jobs.filter((job) => String(job.status ?? "") === "completed").length;

    return { activeJobs, overdueInvoices, outstanding, completedJobs };
  }, [jobs, invoices]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobRows, invoiceRows] = await Promise.all([
        dataLoader.getJobs(),
        dataLoader.getInvoices(),
      ]);
      setJobs(jobRows);
      setInvoices(invoiceRows);
      setSelectedJob(null);
      setSelectedInvoice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales operations data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!auth || !firestore) return;
    const db = firestore;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUserRole("unknown");
        setCurrentUserUid(null);
        return;
      }

      setCurrentUserUid(user.uid);

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

  const handleJobUpdate = async (values: Record<string, string>) => {
    if (!selectedJob?.id || !canEditSelectedJob) return;

    const existingSchedule = selectedJob.schedule && typeof selectedJob.schedule === "object"
      ? (selectedJob.schedule as { installDate?: unknown; arrivalWindow?: string; crew?: string[] })
      : {};

    try {
      setSubmitting(true);
      await dataLoader.updateDocument("jobs", String(selectedJob.id), {
        status: values.status || "scheduled",
        schedule: {
          installDate: existingSchedule.installDate ?? null,
          arrivalWindow: values.arrivalWindow || existingSchedule.arrivalWindow || "",
          crew: existingSchedule.crew ?? splitCsv("")
        },
        jobNotes: values.jobNotes || "",
      });
      setJobModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update job.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvoiceUpdate = async (values: Record<string, string>) => {
    if (!selectedInvoice?.id || !canEditSelectedInvoice) return;

    try {
      setSubmitting(true);
      await dataLoader.updateDocument("invoices", String(selectedInvoice.id), {
        status: values.status,
        qbSyncStatus: values.qbSyncStatus || "pending",
      });
      setInvoiceModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Sales Operations</h1>
          <p className="mt-1 text-sm text-slate-400">Post-close execution across jobs, invoices, and collections.</p>
        </div>
        <button type="button" onClick={() => void loadData()} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
          Reload
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Jobs" value={String(stats.activeJobs)} sublabel="Scheduled + in progress" />
        <StatCard label="Completed Jobs" value={String(stats.completedJobs)} sublabel="Ready for billing" />
        <StatCard label="Overdue Invoices" value={String(stats.overdueInvoices)} sublabel="Collection priority" />
        <StatCard label="Outstanding" value={`$${stats.outstanding.toLocaleString()}`} sublabel="Open receivables" />
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        Role: <span className="font-semibold text-white">{currentUserRole}</span>
        {selectedJob?.id ? <span className="ml-3">Job: <span className="font-semibold text-white">{String(selectedJob.id)}</span></span> : null}
        {selectedInvoice?.id ? <span className="ml-3">Invoice: <span className="font-semibold text-white">{String(selectedInvoice.id)}</span></span> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setJobModalOpen(true)}
            disabled={!canEditSelectedJob || submitting}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Update Selected Job
          </button>
          <button
            type="button"
            onClick={() => setInvoiceModalOpen(true)}
            disabled={!canEditSelectedInvoice || submitting}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Update Selected Invoice
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable
          title="Operations Jobs"
          columns={TABLE_DEFINITIONS.jobs}
          rows={jobs}
          loading={loading}
          onRowClick={setSelectedJob}
          highlightRowId={String(selectedJob?.id ?? "")}
        />
        <DataTable
          title="Collections Invoices"
          columns={TABLE_DEFINITIONS.invoices}
          rows={invoices}
          loading={loading}
          onRowClick={setSelectedInvoice}
          highlightRowId={String(selectedInvoice?.id ?? "")}
        />
      </div>

      {jobModalOpen ? (
        <CrudRecordModal
          mode="edit"
          title="Update Job"
          fields={jobStatusFields}
          initialValues={{
            status: String(selectedJob?.status ?? "scheduled"),
            arrivalWindow: selectedJob?.schedule && typeof selectedJob.schedule === "object"
              ? String((selectedJob.schedule as { arrivalWindow?: string }).arrivalWindow ?? "")
              : "",
            jobNotes: String(selectedJob?.jobNotes ?? ""),
          }}
          submitting={submitting}
          onClose={() => setJobModalOpen(false)}
          onSubmit={handleJobUpdate}
        />
      ) : null}

      {invoiceModalOpen ? (
        <CrudRecordModal
          mode="edit"
          title="Update Invoice"
          fields={invoiceFields}
          initialValues={{
            status: String(selectedInvoice?.status ?? "draft"),
            qbSyncStatus: String(selectedInvoice?.qbSyncStatus ?? "pending"),
          }}
          submitting={submitting}
          onClose={() => setInvoiceModalOpen(false)}
          onSubmit={handleInvoiceUpdate}
        />
      ) : null}
    </div>
  );
}
