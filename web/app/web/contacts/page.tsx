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
type ContactsView = "customers" | "leads" | "vendors";

const customerFields: CrudFieldDefinition[] = [
  { name: "name", label: "Customer Name", type: "text", required: true },
  { name: "contactName", label: "Primary Contact", type: "text", required: true },
  { name: "email", label: "Email", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "street", label: "Street", type: "text", required: true },
  { name: "city", label: "City", type: "text" },
  { name: "state", label: "State", type: "text" },
  { name: "zip", label: "ZIP", type: "text" },
];

const emptyCustomerValues: Record<string, string> = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  zip: "",
};

export default function ContactsPage() {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [view, setView] = useState<ContactsView>("customers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<TableRow[]>([]);
  const [leads, setLeads] = useState<TableRow[]>([]);
  const [vendors, setVendors] = useState<TableRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canCreateCustomer = currentUserRole === "admin" || currentUserRole === "sales";
  const isAdmin = currentUserRole === "admin";

  const stats = useMemo(() => {
    const openLeads = leads.filter((lead) => !["won", "lost"].includes(String(lead.status ?? ""))).length;
    const qbSyncedCustomers = customers.filter((customer) => Boolean(customer.quickBooksCustomerId)).length;
    const activeVendors = vendors.filter((vendor) => String(vendor.status ?? "") === "Active").length;

    return {
      totalContacts: customers.length + leads.length + vendors.length,
      openLeads,
      qbSyncedCustomers,
      activeVendors,
    };
  }, [customers, leads, vendors]);

  const currentRows = useMemo(() => {
    if (view === "customers") return customers;
    if (view === "leads") return leads;
    return vendors;
  }, [view, customers, leads, vendors]);

  const currentColumns = useMemo(() => {
    if (view === "customers") return TABLE_DEFINITIONS.customers;
    if (view === "leads") return TABLE_DEFINITIONS.leads;
    return TABLE_DEFINITIONS.vendors;
  }, [view]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [customerRows, leadRows, vendorRows] = await Promise.all([
        dataLoader.getCustomers(),
        dataLoader.getLeads(),
        dataLoader.getVendors(false),
      ]);

      setCustomers(customerRows);
      setLeads(leadRows);
      setVendors(vendorRows);
      setSelectedRow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedRow(null);
  }, [view]);

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

  const handleCreateCustomer = async (values: Record<string, string>) => {
    if (!canCreateCustomer) return;

    try {
      setSubmitting(true);
      await dataLoader.createDocument("customers", {
        name: values.name,
        primaryContact: {
          name: values.contactName,
          phone: values.phone || "",
          email: values.email || "",
        },
        serviceAddress: {
          street: values.street,
          city: values.city || "",
          state: values.state || "",
          zip: values.zip || "",
        },
        billingAddress: null,
        leadId: null,
        quickBooksCustomerId: null,
        tags: [],
      });

      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!isAdmin || !selectedRow?.id) return;

    const collectionName = view === "customers" ? "customers" : view === "leads" ? "leads" : "vendors";
    if (!window.confirm(`Delete selected ${view.slice(0, -1)}?`)) return;

    try {
      setSubmitting(true);
      await dataLoader.deleteDocument(collectionName, String(selectedRow.id));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-white">Contacts</h1>
          <p className="mt-1 text-sm text-slate-400">Centralized customer, lead, and vendor relationship operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadData()} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            Reload
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!canCreateCustomer}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Customer
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Contacts" value={String(stats.totalContacts)} sublabel="Customers + leads + vendors" />
        <StatCard label="Open Leads" value={String(stats.openLeads)} sublabel="Pipeline still active" />
        <StatCard label="QB Synced" value={String(stats.qbSyncedCustomers)} sublabel="Customers linked to QB" />
        <StatCard label="Active Vendors" value={String(stats.activeVendors)} sublabel="Supplier network ready" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: "customers", label: "Customers" },
          { key: "leads", label: "Leads" },
          { key: "vendors", label: "Vendors" },
        ] as const).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={`rounded-full px-3 py-2 text-xs font-medium transition ${
              view === item.key
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        Role: <span className="font-semibold text-white">{currentUserRole}</span>
        <span className="ml-3">Current View: <span className="font-semibold text-white">{view}</span></span>
        {selectedRow?.id ? <span className="ml-3">Selected: <span className="font-semibold text-white">{String(selectedRow.id)}</span></span> : null}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => void handleDeleteSelected()}
            disabled={!isAdmin || !selectedRow?.id || submitting}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Selected
          </button>
        </div>
      </div>

      <DataTable
        title={view === "customers" ? "Customers" : view === "leads" ? "Leads" : "Vendors"}
        columns={currentColumns}
        rows={currentRows}
        loading={loading}
        onRowClick={setSelectedRow}
        highlightRowId={String(selectedRow?.id ?? "")}
      />

      {modalOpen ? (
        <CrudRecordModal
          mode="create"
          title="Create Customer"
          fields={customerFields}
          initialValues={emptyCustomerValues}
          submitting={submitting}
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreateCustomer}
        />
      ) : null}
    </div>
  );
}
