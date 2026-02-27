"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase";
import { DataTable } from "./DataTable";
import CrudRecordModal, { type CrudFieldDefinition } from "./modals/CrudRecordModal";
import { dataLoader, loadTableData, type TableRow } from "../lib/dataLoader";
import { VIEW_TO_COLLECTION, type TableColumn, type TableViewKey } from "../lib/tableDefinitions";

type LoadedTableData = {
  columns: TableColumn[];
  rows: TableRow[];
};

type TableViewProps = {
  title: string;
  subtitle: string;
  viewKey: TableViewKey;
};

type UserRole = "admin" | "sales" | "field" | "unknown";

type CrudConfig = {
  fields: CrudFieldDefinition[];
  toFormValues: (row: TableRow | null) => Record<string, string>;
  toDocument: (values: Record<string, string>) => Record<string, unknown>;
};

const splitCsv = (value: string): string[] =>
  value.split(",").map((part) => part.trim()).filter(Boolean);

const crudConfigs: Record<string, CrudConfig> = {
  jobs: {
    fields: [
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
    ],
    toFormValues: (row) => ({
      customerId: String(row?.customerId ?? ""),
      estimateId: String(row?.estimateId ?? ""),
      status: String(row?.status ?? "scheduled"),
      installDate: row?.schedule && typeof row.schedule === "object"
        ? String((row.schedule as { installDate?: string }).installDate ?? "").slice(0, 10)
        : "",
      arrivalWindow: row?.schedule && typeof row.schedule === "object"
        ? String((row.schedule as { arrivalWindow?: string }).arrivalWindow ?? "")
        : "",
      crew: row?.schedule && typeof row.schedule === "object"
        ? ((row.schedule as { crew?: string[] }).crew ?? []).join(", ")
        : "",
      jobNotes: String(row?.jobNotes ?? ""),
    }),
    toDocument: (values) => ({
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
    }),
  },
  invoices: {
    fields: [
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
    ],
    toFormValues: (row) => ({
      customerId: String(row?.customerId ?? ""),
      jobId: String(row?.jobId ?? ""),
      estimateId: String(row?.estimateId ?? ""),
      status: String(row?.status ?? "draft"),
      amountDue: String(row?.amountDue ?? "0"),
      dueDate: String(row?.dueDate ?? "").slice(0, 10),
      qbSyncStatus: String(row?.qbSyncStatus ?? "pending"),
    }),
    toDocument: (values) => ({
      customerId: values.customerId,
      jobId: values.jobId || null,
      estimateId: values.estimateId || null,
      status: values.status || "draft",
      amountDue: Number(values.amountDue || 0),
      dueDate: values.dueDate ? new Date(values.dueDate) : null,
      qbSyncStatus: values.qbSyncStatus || "pending",
    }),
  },
  vendors: {
    fields: [
      { name: "name", label: "Vendor Name", type: "text", required: true },
      { name: "category", label: "Category", type: "text" },
      { name: "contactPerson", label: "Contact Person", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "email", label: "Email", type: "text" },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { label: "Active", value: "Active" },
          { label: "Inactive", value: "Inactive" },
        ],
      },
      { name: "address", label: "Address", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    toFormValues: (row) => ({
      name: String(row?.name ?? ""),
      category: String(row?.category ?? ""),
      contactPerson: String(row?.contactPerson ?? ""),
      phone: String(row?.phone ?? ""),
      email: String(row?.email ?? ""),
      status: String(row?.status ?? "Active"),
      address: String(row?.address ?? ""),
      notes: String(row?.notes ?? ""),
    }),
    toDocument: (values) => ({
      name: values.name,
      category: values.category || "",
      contactPerson: values.contactPerson || "",
      phone: values.phone || "",
      email: values.email || "",
      status: values.status || "Active",
      address: values.address || "",
      notes: values.notes || "",
    }),
  },
  users: {
    fields: [
      { name: "displayName", label: "Display Name", type: "text", required: true },
      { name: "email", label: "Email", type: "text", required: true },
      { name: "phone", label: "Phone", type: "text" },
      {
        name: "role",
        label: "Role",
        type: "select",
        required: true,
        options: [
          { label: "Admin", value: "admin" },
          { label: "Sales", value: "sales" },
          { label: "Field", value: "field" },
        ],
      },
      {
        name: "active",
        label: "Active",
        type: "select",
        required: true,
        options: [
          { label: "True", value: "true" },
          { label: "False", value: "false" },
        ],
      },
    ],
    toFormValues: (row) => ({
      displayName: String(row?.displayName ?? ""),
      email: String(row?.email ?? ""),
      phone: String(row?.phone ?? ""),
      role: String(row?.role ?? "sales"),
      active: String(row?.active ?? true),
    }),
    toDocument: (values) => ({
      displayName: values.displayName,
      email: values.email,
      phone: values.phone || "",
      role: values.role || "sales",
      active: values.active === "true",
    }),
  },
};

const editableCollections = new Set<string>(["jobs", "invoices", "vendors", "users"]);

export function TableView({ title, subtitle, viewKey }: TableViewProps) {
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const collectionName = VIEW_TO_COLLECTION[viewKey];
  const crudConfig = crudConfigs[collectionName];
  const canUseCrud = editableCollections.has(collectionName) && Boolean(crudConfig);

  const reload = async () => {
    setLoading(true);
    setError(null);
    setSelectedRow(null);

    try {
      const result: LoadedTableData = await loadTableData(viewKey);
      setColumns(result.columns);
      setRows(result.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load table data.");
    } finally {
      setLoading(false);
    }
  };

  const canEditJobRow = (row: TableRow) => {
    if (currentUserRole === "admin") return true;
    if (currentUserRole !== "field" || !currentUserUid) return false;

    const crew = row.schedule && typeof row.schedule === "object"
      ? (row.schedule as { crew?: string[] }).crew
      : undefined;

    return Array.isArray(crew) && crew.includes(currentUserUid);
  };

  const canCreate = canUseCrud && currentUserRole === "admin";
  const canDelete = canUseCrud && currentUserRole === "admin";
  const canEdit = canUseCrud && Boolean(selectedRow) && (
    collectionName === "jobs"
      ? selectedRow
        ? canEditJobRow(selectedRow)
        : false
      : currentUserRole === "admin"
  );

  const getModalInitialValues = () => {
    if (!crudConfig) return {};
    return crudConfig.toFormValues(modalMode === "edit" ? selectedRow : null);
  };

  const handleOpenCreate = () => {
    if (!canCreate) return;
    setModalMode("create");
  };

  const handleOpenEdit = () => {
    if (!canEdit) return;
    setModalMode("edit");
  };

  const handleDelete = async () => {
    if (!canDelete || !selectedRow?.id) return;
    if (!window.confirm("Delete selected record? This cannot be undone.")) return;

    try {
      setSubmitting(true);
      await dataLoader.deleteDocument(collectionName, String(selectedRow.id));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete record.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitModal = async (values: Record<string, string>) => {
    if (!crudConfig) return;

    try {
      setSubmitting(true);
      const payload = crudConfig.toDocument(values);

      if (modalMode === "create") {
        await dataLoader.createDocument(collectionName, payload);
      }

      if (modalMode === "edit" && selectedRow?.id) {
        await dataLoader.updateDocument(collectionName, String(selectedRow.id), payload);
      }

      setModalMode(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save record.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [viewKey]);

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
  }, [viewKey]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Reload
          </button>
          {canUseCrud ? (
            <button
              type="button"
              onClick={handleOpenCreate}
              disabled={!canCreate}
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {canUseCrud ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          Role: <span className="font-semibold text-white">{currentUserRole}</span>
          {selectedRow?.id ? <span className="ml-3">Selected ID: <span className="font-semibold text-white">{String(selectedRow.id)}</span></span> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenEdit}
              disabled={!canEdit || submitting}
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
      ) : null}

      <DataTable
        title={title}
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={setSelectedRow}
        highlightRowId={String(selectedRow?.id ?? "")}
      />

      {canUseCrud && modalMode && crudConfig ? (
        <CrudRecordModal
          mode={modalMode}
          title={`${modalMode === "create" ? "Create" : "Edit"} ${title}`}
          fields={crudConfig.fields}
          initialValues={getModalInitialValues()}
          submitting={submitting}
          onClose={() => setModalMode(null)}
          onSubmit={handleSubmitModal}
        />
      ) : null}
    </div>
  );
}
