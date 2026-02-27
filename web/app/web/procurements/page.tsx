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

const vendorFields: CrudFieldDefinition[] = [
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
];

const toVendorValues = (row: TableRow | null): Record<string, string> => ({
  name: String(row?.name ?? ""),
  category: String(row?.category ?? ""),
  contactPerson: String(row?.contactPerson ?? ""),
  phone: String(row?.phone ?? ""),
  email: String(row?.email ?? ""),
  status: String(row?.status ?? "Active"),
  address: String(row?.address ?? ""),
  notes: String(row?.notes ?? ""),
});

export default function ProcurementsPage() {
  const [vendors, setVendors] = useState<TableRow[]>([]);
  const [materials, setMaterials] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<TableRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = currentUserRole === "admin";

  const filteredVendors = useMemo(() => {
    if (!categoryFilter) return vendors;
    return vendors.filter((vendor) => String(vendor.category ?? "") === categoryFilter);
  }, [vendors, categoryFilter]);

  const uniqueCategories = useMemo(() => {
    const categories = vendors.map((vendor) => String(vendor.category ?? "")).filter(Boolean);
    return Array.from(new Set(categories));
  }, [vendors]);

  const stats = useMemo(() => {
    const activeVendors = vendors.filter((vendor) => String(vendor.status ?? "") === "Active").length;
    const inactiveVendors = vendors.length - activeVendors;
    const activeMaterials = materials.filter((material) => material.active === true).length;
    const avgMaterialPrice = materials.length
      ? materials.reduce((sum, material) => sum + Number(material.price ?? 0), 0) / materials.length
      : 0;

    return {
      activeVendors,
      inactiveVendors,
      activeMaterials,
      avgMaterialPrice,
    };
  }, [vendors, materials]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [vendorRows, materialRows] = await Promise.all([
        dataLoader.getVendors(false),
        dataLoader.getMaterials(false),
      ]);

      setVendors(vendorRows);
      setMaterials(materialRows);
      setSelectedVendor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load procurement data.");
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

  const handleVendorDelete = async () => {
    if (!isAdmin || !selectedVendor?.id) return;
    if (!window.confirm("Delete selected vendor?")) return;

    try {
      setSubmitting(true);
      await dataLoader.deleteDocument("vendors", String(selectedVendor.id));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete vendor.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVendorSubmit = async (values: Record<string, string>) => {
    if (!isAdmin) return;

    const payload = {
      name: values.name,
      category: values.category || "",
      contactPerson: values.contactPerson || "",
      phone: values.phone || "",
      email: values.email || "",
      status: values.status || "Active",
      address: values.address || "",
      notes: values.notes || "",
    };

    try {
      setSubmitting(true);
      if (modalMode === "create") {
        await dataLoader.createDocument("vendors", payload);
      }

      if (modalMode === "edit" && selectedVendor?.id) {
        await dataLoader.updateDocument("vendors", String(selectedVendor.id), payload);
      }

      setModalMode(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vendor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Procurements</h1>
          <p className="mt-1 text-sm text-slate-400">Supplier management and material catalog operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadData()} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            Reload
          </button>
          <button
            type="button"
            onClick={() => setModalMode("create")}
            disabled={!isAdmin}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Vendor
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Vendors" value={String(stats.activeVendors)} sublabel="Ready suppliers" />
        <StatCard label="Inactive Vendors" value={String(stats.inactiveVendors)} sublabel="Paused suppliers" />
        <StatCard label="Active Materials" value={String(stats.activeMaterials)} sublabel="Catalog entries" />
        <StatCard label="Avg Material Price" value={`$${stats.avgMaterialPrice.toFixed(2)}`} sublabel="Unit pricing baseline" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {uniqueCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setCategoryFilter((prev) => (prev === category ? null : category))}
            className={`rounded-full px-3 py-2 text-xs font-medium transition ${
              categoryFilter === category
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        Role: <span className="font-semibold text-white">{currentUserRole}</span>
        {selectedVendor?.id ? <span className="ml-3">Selected Vendor: <span className="font-semibold text-white">{String(selectedVendor.id)}</span></span> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalMode("edit")}
            disabled={!isAdmin || !selectedVendor || submitting}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit Selected Vendor
          </button>
          <button
            type="button"
            onClick={() => void handleVendorDelete()}
            disabled={!isAdmin || !selectedVendor || submitting}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Selected Vendor
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataTable
          title="Vendors"
          columns={TABLE_DEFINITIONS.vendors}
          rows={filteredVendors}
          loading={loading}
          onRowClick={setSelectedVendor}
          highlightRowId={String(selectedVendor?.id ?? "")}
        />

        <DataTable
          title="Materials Catalog"
          columns={TABLE_DEFINITIONS.materials}
          rows={materials}
          loading={loading}
        />
      </div>

      {modalMode ? (
        <CrudRecordModal
          mode={modalMode}
          title={`${modalMode === "create" ? "Create" : "Edit"} Vendor`}
          fields={vendorFields}
          initialValues={toVendorValues(modalMode === "edit" ? selectedVendor : null)}
          submitting={submitting}
          onClose={() => setModalMode(null)}
          onSubmit={handleVendorSubmit}
        />
      ) : null}
    </div>
  );
}
