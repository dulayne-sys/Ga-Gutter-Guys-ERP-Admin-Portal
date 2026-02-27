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

const jobFields: CrudFieldDefinition[] = [
  { name: "customerId", label: "Customer ID", type: "text", required: true },
  { name: "estimateId", label: "Estimate ID", type: "text" },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { label: "Scheduled", value: "scheduled" },
      { label: "In Progress", value: "in_progress" },
      { label: "Completed", value: "completed" },
      { label: "On Hold", value: "on_hold" },
    ],
  },
  { name: "installDate", label: "Install Date", type: "date" },
  { name: "arrivalWindow", label: "Arrival Window", type: "text", placeholder: "8am - 12pm" },
  { name: "crew", label: "Crew UIDs (comma separated)", type: "text", placeholder: "uid1, uid2" },
  { name: "jobNotes", label: "Job Notes", type: "textarea" },
];

const splitCsv = (value: string): string[] =>
  value.split(",").map((part) => part.trim()).filter(Boolean);

const dateInputValue = (value: unknown) => {
  if (!value) return "";
  const source = typeof value === "object" && value && "toDate" in value
    ? (value as { toDate: () => Date }).toDate()
    : value;
  const date = new Date(String(source));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const toJobValues = (row: TableRow | null): Record<string, string> => ({
  customerId: String(row?.customerId ?? ""),
  estimateId: String(row?.estimateId ?? ""),
  status: String(row?.status ?? "scheduled"),
  installDate: row?.schedule && typeof row.schedule === "object"
    ? dateInputValue((row.schedule as { installDate?: unknown }).installDate)
    : "",
  arrivalWindow: row?.schedule && typeof row.schedule === "object"
    ? String((row.schedule as { arrivalWindow?: string }).arrivalWindow ?? "")
    : "",
  crew: row?.schedule && typeof row.schedule === "object"
    ? ((row.schedule as { crew?: string[] }).crew ?? []).join(", ")
    : "",
  jobNotes: String(row?.jobNotes ?? ""),
});

export default function ActiveJobsPage() {
  const [jobs, setJobs] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = currentUserRole === "admin";
  const canDelete = currentUserRole === "admin";

  const canEditSelected = useMemo(() => {
    if (!selectedRow) return false;
    if (currentUserRole === "admin") return true;
    if (currentUserRole !== "field" || !currentUserUid) return false;

    const crew = selectedRow.schedule && typeof selectedRow.schedule === "object"
      ? (selectedRow.schedule as { crew?: string[] }).crew
      : undefined;

    return Array.isArray(crew) && crew.includes(currentUserUid);
  }, [selectedRow, currentUserRole, currentUserUid]);

  const filteredRows = useMemo(() => {
    if (!statusFilter) return jobs;
    return jobs.filter((job) => String(job.status ?? "") === statusFilter);
  }, [jobs, statusFilter]);

  const stats = useMemo(() => {
    const scheduled = jobs.filter((job) => String(job.status ?? "") === "scheduled").length;
    const inProgress = jobs.filter((job) => String(job.status ?? "") === "in_progress").length;
    const completed = jobs.filter((job) => String(job.status ?? "") === "completed").length;
    const onHold = jobs.filter((job) => String(job.status ?? "") === "on_hold").length;

    return {
      scheduled,
      inProgress,
      completed,
      onHold,
    };
  }, [jobs]);

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await dataLoader.getJobs();
      setJobs(rows);
      setSelectedRow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
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

  const handleDelete = async () => {
    if (!canDelete || !selectedRow?.id) return;
    if (!window.confirm("Delete selected job?")) return;

    try {
      setSubmitting(true);
      await dataLoader.deleteDocument("jobs", String(selectedRow.id));
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (values: Record<string, string>) => {
    if (modalMode === "create" && !canCreate) return;
    if (modalMode === "edit" && !canEditSelected) return;

    const payload = {
      customerId: values.customerId,
      estimateId: values.estimateId || null,
      status: values.status || "scheduled",
      schedule: {
        installDate: values.installDate ? new Date(values.installDate) : null,
        arrivalWindow: values.arrivalWindow || "",
        crew: splitCsv(values.crew || ""),
      },
      jobNotes: values.jobNotes || "",
      photos: [],
      completion: {
        completedAt: null,
        completedBy: null,
      },
    };

    try {
      setSubmitting(true);

      if (modalMode === "create") {
        await dataLoader.createDocument("jobs", payload);
      }

      if (modalMode === "edit" && selectedRow?.id) {
        await dataLoader.updateDocument("jobs", String(selectedRow.id), payload);
      }

      setModalMode(null);
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save job.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Active Jobs</h1>
          <p className="mt-1 text-sm text-slate-400">Live job tracker and project management.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadJobs()} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            Reload
          </button>
          <button
            type="button"
            onClick={() => setModalMode("create")}
            disabled={!canCreate}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Job
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scheduled" value={String(stats.scheduled)} sublabel="Ready to start" />
        <StatCard label="In Progress" value={String(stats.inProgress)} sublabel="Active installs" />
        <StatCard label="Completed" value={String(stats.completed)} sublabel="Finished jobs" />
        <StatCard label="On Hold" value={String(stats.onHold)} sublabel="Awaiting action" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["scheduled", "in_progress", "completed", "on_hold"].map((status) => (
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
            {status.replace("_", " ").toUpperCase()}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        Role: <span className="font-semibold text-white">{currentUserRole}</span>
        {selectedRow?.id ? <span className="ml-3">Selected ID: <span className="font-semibold text-white">{String(selectedRow.id)}</span></span> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalMode("edit")}
            disabled={!canEditSelected || submitting}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit Selected
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!canDelete || !selectedRow?.id || submitting}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Selected
          </button>
        </div>
      </div>

      <DataTable
        title="Active Jobs"
        columns={TABLE_DEFINITIONS.jobs}
        rows={filteredRows}
        loading={loading}
        onRowClick={setSelectedRow}
        highlightRowId={String(selectedRow?.id ?? "")}
      />

      {modalMode ? (
        <CrudRecordModal
          mode={modalMode}
          title={`${modalMode === "create" ? "Create" : "Edit"} Job`}
          fields={jobFields}
          initialValues={toJobValues(modalMode === "edit" ? selectedRow : null)}
          submitting={submitting}
          onClose={() => setModalMode(null)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
