"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase";
import { DataTable } from "../components/DataTable";
import { StatCard } from "../components/StatCard";
import AddLeadModal from "../components/modals/AddLeadModal";
import CrudRecordModal, { type CrudFieldDefinition } from "../components/modals/CrudRecordModal";
import { dataLoader, type TableRow } from "../lib/dataLoader";
import { TABLE_DEFINITIONS } from "../lib/tableDefinitions";

type UserRole = "admin" | "sales" | "field" | "unknown";

type HandoffState = {
  loading: boolean;
  customer: TableRow | null;
  jobs: TableRow[];
  invoices: TableRow[];
};

const estimateFields: CrudFieldDefinition[] = [
  { name: "leadId", label: "Lead ID", type: "text", required: true },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { label: "Draft", value: "draft" },
      { label: "Sent", value: "sent" },
      { label: "Approved", value: "approved" },
      { label: "Rejected", value: "rejected" },
    ],
  },
  { name: "street", label: "Street", type: "text", required: true },
  { name: "city", label: "City", type: "text" },
  { name: "state", label: "State", type: "text" },
  { name: "zip", label: "ZIP", type: "text" },
  { name: "linearFeet", label: "Linear Feet", type: "number", required: true },
  { name: "grandTotal", label: "Grand Total", type: "number", required: true },
];

const estimateStatusFields: CrudFieldDefinition[] = [
  {
    name: "status",
    label: "Estimate Status",
    type: "select",
    required: true,
    options: [
      { label: "Draft", value: "draft" },
      { label: "Sent", value: "sent" },
      { label: "Approved", value: "approved" },
      { label: "Rejected", value: "rejected" },
    ],
  },
];

const estimateEditFields: CrudFieldDefinition[] = [
  { name: "leadId", label: "Lead ID", type: "text", required: true },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { label: "Draft", value: "draft" },
      { label: "Sent", value: "sent" },
      { label: "Approved", value: "approved" },
      { label: "Rejected", value: "rejected" },
    ],
  },
  { name: "street", label: "Street", type: "text", required: true },
  { name: "city", label: "City", type: "text" },
  { name: "state", label: "State", type: "text" },
  { name: "zip", label: "ZIP", type: "text" },
  { name: "linearFeet", label: "Linear Feet", type: "number", required: true },
  { name: "grandTotal", label: "Grand Total", type: "number", required: true },
];

const leadStatusFields: CrudFieldDefinition[] = [
  {
    name: "status",
    label: "Lead Status",
    type: "select",
    required: true,
    options: [
      { label: "New", value: "new" },
      { label: "Contacted", value: "contacted" },
      { label: "Scheduled", value: "scheduled" },
      { label: "Estimating", value: "estimating" },
      { label: "Won", value: "won" },
      { label: "Lost", value: "lost" },
    ],
  },
];

export default function SalesHomePage() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<TableRow[]>([]);
  const [estimates, setEstimates] = useState<TableRow[]>([]);
  const [selectedLead, setSelectedLead] = useState<TableRow | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<TableRow | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [showLeadStatusModal, setShowLeadStatusModal] = useState(false);
  const [showEstimateStatusModal, setShowEstimateStatusModal] = useState(false);
  const [showEstimateEditModal, setShowEstimateEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [handoff, setHandoff] = useState<HandoffState>({
    loading: false,
    customer: null,
    jobs: [],
    invoices: [],
  });

  const canCreateLead = currentUserRole === "admin" || currentUserRole === "sales";
  const canCreateEstimate = currentUserRole === "admin" || currentUserRole === "sales";
  const isAdmin = currentUserRole === "admin";

  const canUpdateLead = useMemo(() => {
    if (!selectedLead) return false;
    if (currentUserRole === "admin") return true;
    if (currentUserRole !== "sales" || !currentUserUid) return false;
    return String(selectedLead.assignedTo ?? "") === currentUserUid;
  }, [selectedLead, currentUserRole, currentUserUid]);

  const canUpdateEstimate = useMemo(() => {
    if (!selectedEstimate) return false;
    if (currentUserRole === "admin") return true;
    if (currentUserRole !== "sales" || !currentUserUid) return false;
    return String(selectedEstimate.createdBy ?? "") === currentUserUid;
  }, [selectedEstimate, currentUserRole, currentUserUid]);

  const stats = useMemo(() => {
    const openLeads = leads.filter((lead) => !["won", "lost"].includes(String(lead.status ?? ""))).length;
    const sentEstimates = estimates.filter((estimate) => String(estimate.status ?? "") === "sent").length;
    const approvedEstimates = estimates.filter((estimate) => String(estimate.status ?? "") === "approved").length;
    const pipelineValue = estimates
      .filter((estimate) => ["sent", "approved"].includes(String(estimate.status ?? "")))
      .reduce((sum, estimate) => {
        const pricing = estimate.pricing as { grandTotal?: number } | undefined;
        return sum + Number(pricing?.grandTotal ?? 0);
      }, 0);

    return {
      openLeads,
      sentEstimates,
      approvedEstimates,
      pipelineValue,
    };
  }, [leads, estimates]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [leadRows, estimateRows] = await Promise.all([
        dataLoader.getLeads(),
        dataLoader.getEstimates(),
      ]);
      setLeads(leadRows);
      setEstimates(estimateRows);
      setSelectedLead(null);
      setSelectedEstimate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales pipeline data.");
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

  useEffect(() => {
    const estimateId = String(selectedEstimate?.id ?? "");
    if (!estimateId) {
      setHandoff({ loading: false, customer: null, jobs: [], invoices: [] });
      return;
    }

    let active = true;
    setHandoff((prev) => ({ ...prev, loading: true }));

    Promise.all([
      dataLoader.loadCollection("jobs", [{ field: "estimateId", operator: "==", value: estimateId }], "updatedAt", 5),
      dataLoader.loadCollection("invoices", [{ field: "estimateId", operator: "==", value: estimateId }], "updatedAt", 5),
      selectedEstimate?.customerId
        ? dataLoader.loadDocument("customers", String(selectedEstimate.customerId))
        : Promise.resolve(null),
    ])
      .then(([jobs, invoices, customer]) => {
        if (!active) return;
        setHandoff({
          loading: false,
          customer: customer ?? null,
          jobs,
          invoices,
        });
      })
      .catch(() => {
        if (!active) return;
        setHandoff({ loading: false, customer: null, jobs: [], invoices: [] });
      });

    return () => {
      active = false;
    };
  }, [selectedEstimate]);

  const handleAddLead = async (leadData: Record<string, unknown>) => {
    if (!canCreateLead) return;
    try {
      setSubmitting(true);
      await dataLoader.createLead({
        ...leadData,
        createdBy: currentUserUid,
      });
      setShowLeadModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEstimate = async (values: Record<string, string>) => {
    if (!canCreateEstimate) return;

    try {
      setSubmitting(true);
      await dataLoader.createDocument("estimates", {
        leadId: values.leadId,
        customerId: null,
        status: values.status || "draft",
        createdBy: currentUserUid,
        address: {
          street: values.street,
          city: values.city || "",
          state: values.state || "",
          zip: values.zip || "",
        },
        measurements: {
          linearFeet: Number(values.linearFeet || 0),
        },
        pricing: {
          grandTotal: Number(values.grandTotal || 0),
        },
      });

      setShowEstimateModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create estimate.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeadStatusUpdate = async (values: Record<string, string>) => {
    if (!selectedLead?.id || !canUpdateLead) return;

    try {
      setSubmitting(true);
      await dataLoader.updateLead(String(selectedLead.id), {
        status: values.status,
      });
      setShowLeadStatusModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lead status.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEstimateStatusUpdate = async (values: Record<string, string>) => {
    if (!selectedEstimate?.id || !canUpdateEstimate) return;

    const nextStatus = values.status;
    if (nextStatus === "approved") {
      const leadId = String(selectedEstimate.leadId ?? "").trim();
      const street = String((selectedEstimate.address as { street?: string } | undefined)?.street ?? "").trim();
      const total = Number((selectedEstimate.pricing as { grandTotal?: number } | undefined)?.grandTotal ?? 0);

      if (!leadId || !street || total <= 0) {
        setError("Approval blocked: estimate requires leadId, service address, and grand total > 0.");
        return;
      }
    }

    try {
      setSubmitting(true);
      await dataLoader.updateDocument("estimates", String(selectedEstimate.id), {
        status: nextStatus,
      });
      setShowEstimateStatusModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update estimate status.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEstimateEdit = async (values: Record<string, string>) => {
    if (!selectedEstimate?.id || !canUpdateEstimate) return;

    const payload = {
      leadId: values.leadId,
      status: values.status || "draft",
      address: {
        street: values.street,
        city: values.city || "",
        state: values.state || "",
        zip: values.zip || "",
      },
      measurements: {
        linearFeet: Number(values.linearFeet || 0),
      },
      pricing: {
        grandTotal: Number(values.grandTotal || 0),
      },
    };

    if (payload.status === "approved") {
      if (!payload.leadId.trim() || !payload.address.street.trim() || payload.pricing.grandTotal <= 0) {
        setError("Approval blocked: estimate requires leadId, service address, and grand total > 0.");
        return;
      }
    }

    try {
      setSubmitting(true);
      await dataLoader.updateDocument("estimates", String(selectedEstimate.id), payload);
      setShowEstimateEditModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update estimate details.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEstimateQuickStatus = async (nextStatus: "sent" | "approved" | "rejected") => {
    if (!selectedEstimate?.id || !canUpdateEstimate) return;

    if (nextStatus === "approved") {
      const leadId = String(selectedEstimate.leadId ?? "").trim();
      const street = String((selectedEstimate.address as { street?: string } | undefined)?.street ?? "").trim();
      const total = Number((selectedEstimate.pricing as { grandTotal?: number } | undefined)?.grandTotal ?? 0);

      if (!leadId || !street || total <= 0) {
        setError("Approval blocked: estimate requires leadId, service address, and grand total > 0.");
        return;
      }
    }

    try {
      setSubmitting(true);
      await dataLoader.updateDocument("estimates", String(selectedEstimate.id), {
        status: nextStatus,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update estimate status.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSelectedLead = async () => {
    if (!isAdmin || !selectedLead?.id) return;
    if (!window.confirm("Delete selected lead?")) return;

    try {
      setSubmitting(true);
      await dataLoader.deleteDocument("leads", String(selectedLead.id));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete lead.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSelectedEstimate = async () => {
    if (!isAdmin || !selectedEstimate?.id) return;
    if (!window.confirm("Delete selected estimate?")) return;

    try {
      setSubmitting(true);
      await dataLoader.deleteDocument("estimates", String(selectedEstimate.id));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete estimate.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Sales Home</h1>
          <p className="mt-1 text-sm text-slate-400">Live pipeline control center for leads and estimates.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadData()} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            Reload
          </button>
          <button
            type="button"
            onClick={() => setShowLeadModal(true)}
            disabled={!canCreateLead}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Lead
          </button>
          <button
            type="button"
            onClick={() => setShowEstimateModal(true)}
            disabled={!canCreateEstimate}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Estimate
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open Leads" value={String(stats.openLeads)} sublabel="Still in pipeline" />
        <StatCard label="Sent Estimates" value={String(stats.sentEstimates)} sublabel="Awaiting customer decision" />
        <StatCard label="Approved" value={String(stats.approvedEstimates)} sublabel="Ready for operations handoff" />
        <StatCard label="Pipeline Value" value={`$${stats.pipelineValue.toLocaleString()}`} sublabel="Sent + approved value" />
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        Role: <span className="font-semibold text-white">{currentUserRole}</span>
        {selectedLead?.id ? <span className="ml-3">Lead: <span className="font-semibold text-white">{String(selectedLead.id)}</span></span> : null}
        {selectedEstimate?.id ? <span className="ml-3">Estimate: <span className="font-semibold text-white">{String(selectedEstimate.id)}</span></span> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowLeadStatusModal(true)}
            disabled={!canUpdateLead || submitting}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Update Lead Status
          </button>
          <button
            type="button"
            onClick={() => setShowEstimateStatusModal(true)}
            disabled={!canUpdateEstimate || submitting}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Update Estimate Status
          </button>
          <button
            type="button"
            onClick={() => setShowEstimateEditModal(true)}
            disabled={!canUpdateEstimate || submitting}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit Estimate Details
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteSelectedLead()}
            disabled={!isAdmin || !selectedLead?.id || submitting}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Lead
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteSelectedEstimate()}
            disabled={!isAdmin || !selectedEstimate?.id || submitting}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Estimate
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_2fr_1.5fr]">
        <DataTable
          title="Lead Pipeline"
          columns={TABLE_DEFINITIONS.leads}
          rows={leads}
          loading={loading}
          onRowClick={setSelectedLead}
          highlightRowId={String(selectedLead?.id ?? "")}
        />
        <DataTable
          title="Estimate Pipeline"
          columns={TABLE_DEFINITIONS.estimates}
          rows={estimates}
          loading={loading}
          onRowClick={setSelectedEstimate}
          highlightRowId={String(selectedEstimate?.id ?? "")}
        />

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-semibold text-white">Estimate Handoff</h3>
          <p className="mt-1 text-xs text-slate-400">Customer, job, and invoice linkage for selected estimate.</p>

          {handoff.loading ? <p className="mt-4 text-sm text-slate-400">Loading handoff...</p> : null}

          {!handoff.loading ? (
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <div>
                <p className="text-xs text-slate-500">Customer</p>
                <p className="font-semibold text-white">{String(handoff.customer?.name ?? "Not linked")}</p>
                <p className="text-xs text-slate-400">{String((handoff.customer?.primaryContact as { email?: string } | undefined)?.email ?? "")}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Jobs Linked</p>
                <p className="font-semibold text-white">{handoff.jobs.length}</p>
                {handoff.jobs.slice(0, 2).map((job) => (
                  <p key={String(job.id)} className="text-xs text-slate-400">{String(job.id)} · {String(job.status ?? "")}</p>
                ))}
              </div>

              <div>
                <p className="text-xs text-slate-500">Invoices Linked</p>
                <p className="font-semibold text-white">{handoff.invoices.length}</p>
                {handoff.invoices.slice(0, 2).map((invoice) => (
                  <p key={String(invoice.id)} className="text-xs text-slate-400">{String(invoice.id)} · {String(invoice.status ?? "")}</p>
                ))}
              </div>

              <div>
                <p className="text-xs text-slate-500">Quick Actions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleEstimateQuickStatus("sent")}
                    disabled={!canUpdateEstimate || submitting || String(selectedEstimate?.status ?? "") === "sent"}
                    className="rounded-md bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark Sent
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleEstimateQuickStatus("approved")}
                    disabled={!canUpdateEstimate || submitting || String(selectedEstimate?.status ?? "") === "approved"}
                    className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleEstimateQuickStatus("rejected")}
                    disabled={!canUpdateEstimate || submitting || String(selectedEstimate?.status ?? "") === "rejected"}
                    className="rounded-md bg-rose-500/20 px-2.5 py-1 text-xs text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href={{
                      pathname: "/web/work-orders",
                      query: {
                        estimateId: String(selectedEstimate?.id ?? ""),
                        jobId: String(handoff.jobs[0]?.id ?? ""),
                      },
                    }}
                    className="rounded-md bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-white/20"
                  >
                    Open Work Orders
                  </Link>
                  <Link
                    href={{
                      pathname: "/web/invoices",
                      query: {
                        estimateId: String(selectedEstimate?.id ?? ""),
                        invoiceId: String(handoff.invoices[0]?.id ?? ""),
                      },
                    }}
                    className="rounded-md bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-white/20"
                  >
                    Open Invoices
                  </Link>
                  <Link
                    href={{
                      pathname: "/web/job-erp",
                      query: {
                        estimateId: String(selectedEstimate?.id ?? ""),
                        jobId: String(handoff.jobs[0]?.id ?? ""),
                        invoiceId: String(handoff.invoices[0]?.id ?? ""),
                      },
                    }}
                    className="rounded-md bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-white/20"
                  >
                    Open Job ERP
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {showLeadModal ? (
        <AddLeadModal onClose={() => setShowLeadModal(false)} onSubmit={handleAddLead} />
      ) : null}

      {showEstimateModal ? (
        <CrudRecordModal
          mode="create"
          title="Create Estimate"
          fields={estimateFields}
          initialValues={{
            leadId: String(selectedLead?.id ?? ""),
            status: "draft",
            street: "",
            city: "",
            state: "",
            zip: "",
            linearFeet: "0",
            grandTotal: "0",
          }}
          submitting={submitting}
          onClose={() => setShowEstimateModal(false)}
          onSubmit={handleCreateEstimate}
        />
      ) : null}

      {showLeadStatusModal ? (
        <CrudRecordModal
          mode="edit"
          title="Update Lead Status"
          fields={leadStatusFields}
          initialValues={{ status: String(selectedLead?.status ?? "new") }}
          submitting={submitting}
          onClose={() => setShowLeadStatusModal(false)}
          onSubmit={handleLeadStatusUpdate}
        />
      ) : null}

      {showEstimateStatusModal ? (
        <CrudRecordModal
          mode="edit"
          title="Update Estimate Status"
          fields={estimateStatusFields}
          initialValues={{ status: String(selectedEstimate?.status ?? "draft") }}
          submitting={submitting}
          onClose={() => setShowEstimateStatusModal(false)}
          onSubmit={handleEstimateStatusUpdate}
        />
      ) : null}

      {showEstimateEditModal ? (
        <CrudRecordModal
          mode="edit"
          title="Edit Estimate Details"
          fields={estimateEditFields}
          initialValues={{
            leadId: String(selectedEstimate?.leadId ?? ""),
            status: String(selectedEstimate?.status ?? "draft"),
            street: String((selectedEstimate?.address as { street?: string } | undefined)?.street ?? ""),
            city: String((selectedEstimate?.address as { city?: string } | undefined)?.city ?? ""),
            state: String((selectedEstimate?.address as { state?: string } | undefined)?.state ?? ""),
            zip: String((selectedEstimate?.address as { zip?: string } | undefined)?.zip ?? ""),
            linearFeet: String((selectedEstimate?.measurements as { linearFeet?: number } | undefined)?.linearFeet ?? 0),
            grandTotal: String((selectedEstimate?.pricing as { grandTotal?: number } | undefined)?.grandTotal ?? 0),
          }}
          submitting={submitting}
          onClose={() => setShowEstimateEditModal(false)}
          onSubmit={handleEstimateEdit}
        />
      ) : null}
    </div>
  );
}
