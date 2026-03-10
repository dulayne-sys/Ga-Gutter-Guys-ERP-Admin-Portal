"use client";

/**
 * WorkOrderModal — Enhanced work order create/edit form.
 *
 * Changes from legacy CrudRecordModal approach:
 * - Customer name dropdown (loaded from Firestore customers collection)
 * - Vendor dropdown (loaded from Firestore vendors collection) instead of crew UIDs
 * - Preserves backward compat: if legacy customerId / crew fields exist, they still display
 */

import { useEffect, useState } from "react";
import { dataLoader, type TableRow } from "../lib/dataLoader";

type WorkOrderModalProps = {
  mode: "create" | "edit";
  initialValues?: Partial<WorkOrderFormValues>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: WorkOrderFormValues) => Promise<void>;
};

export type WorkOrderFormValues = {
  customerId: string;
  customerName: string;
  workOrderId: string;
  vendorId: string;
  vendorName: string;
  status: string;
  installDate: string;
  arrivalWindow: string;
  jobNotes: string;
};

const emptyValues: WorkOrderFormValues = {
  customerId: "",
  customerName: "",
  workOrderId: "",
  vendorId: "",
  vendorName: "",
  status: "scheduled",
  installDate: "",
  arrivalWindow: "",
  jobNotes: "",
};

const STATUS_OPTIONS = [
  { label: "Scheduled", value: "scheduled" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "On Hold", value: "on_hold" },
];

export function WorkOrderModal({ mode, initialValues, submitting = false, onClose, onSubmit }: WorkOrderModalProps) {
  const [values, setValues] = useState<WorkOrderFormValues>({ ...emptyValues, ...initialValues });
  const [customers, setCustomers] = useState<TableRow[]>([]);
  const [vendors, setVendors] = useState<TableRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      dataLoader.getCustomers(),
      dataLoader.getVendors(false), // include inactive vendors for edit mode
    ])
      .then(([customerRows, vendorRows]) => {
        if (cancelled) return;
        setCustomers(customerRows);
        setVendors(vendorRows);
      })
      .catch(() => {
        // silent — fallback to manual text entry
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const set = (field: keyof WorkOrderFormValues, value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find((c) => String(c.id) === customerId);
    set("customerId", customerId);
    set("customerName", String(customer?.name ?? ""));
  };

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find((v) => String(v.id) === vendorId);
    set("vendorId", vendorId);
    set("vendorName", String(vendor?.name ?? ""));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(values);
  };

  const inputClass = "w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100";
  const labelClass = "mb-1 block text-sm font-medium text-slate-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {mode === "create" ? "Create" : "Edit"} Work Order
          </h2>
          <button type="button" onClick={onClose} className="text-2xl text-slate-400 hover:text-white">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Customer dropdown */}
            <div>
              <label className={labelClass}>Customer *</label>
              {loadingOptions ? (
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Loading customers..."
                  disabled
                />
              ) : (
                <select
                  value={values.customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {String(c.name ?? c.id)}
                    </option>
                  ))}
                  {/* Legacy: if customerId was set manually, preserve it */}
                  {values.customerId && !customers.find((c) => String(c.id) === values.customerId) ? (
                    <option value={values.customerId}>{values.customerName || values.customerId} (legacy)</option>
                  ) : null}
                </select>
              )}
            </div>

            {/* Work Order ID (was estimateId) */}
            <div>
              <label className={labelClass}>Work Order / Estimate ID</label>
              <input
                type="text"
                value={values.workOrderId}
                onChange={(e) => set("workOrderId", e.target.value)}
                placeholder="Linked estimate or WO reference"
                className={inputClass}
              />
            </div>

            {/* Vendor dropdown (replaces crew UIDs) */}
            <div>
              <label className={labelClass}>Assigned Vendor</label>
              {loadingOptions ? (
                <input type="text" className={inputClass} placeholder="Loading vendors..." disabled />
              ) : (
                <select
                  value={values.vendorId}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select vendor / crew...</option>
                  {vendors.map((v) => (
                    <option key={String(v.id)} value={String(v.id)}>
                      {String(v.name ?? v.id)}
                    </option>
                  ))}
                  {/* Legacy crew value fallback */}
                  {values.vendorId && !vendors.find((v) => String(v.id) === values.vendorId) ? (
                    <option value={values.vendorId}>{values.vendorName || values.vendorId} (legacy)</option>
                  ) : null}
                </select>
              )}
            </div>

            {/* Status */}
            <div>
              <label className={labelClass}>Status *</label>
              <select
                value={values.status}
                onChange={(e) => set("status", e.target.value)}
                className={inputClass}
                required
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Install Date */}
            <div>
              <label className={labelClass}>Install Date</label>
              <input
                type="date"
                value={values.installDate}
                onChange={(e) => set("installDate", e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Arrival Window */}
            <div>
              <label className={labelClass}>Arrival Window</label>
              <input
                type="text"
                value={values.arrivalWindow}
                onChange={(e) => set("arrivalWindow", e.target.value)}
                placeholder="8am - 12pm"
                className={inputClass}
              />
            </div>
          </div>

          {/* Job Notes */}
          <div>
            <label className={labelClass}>Work Notes</label>
            <textarea
              value={values.jobNotes}
              onChange={(e) => set("jobNotes", e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/5 px-4 py-2 text-slate-200 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Saving..." : mode === "create" ? "Create" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
