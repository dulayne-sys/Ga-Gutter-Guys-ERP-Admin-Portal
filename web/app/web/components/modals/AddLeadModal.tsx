"use client";

import { useState } from "react";

type AddLeadModalProps = {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
};

export default function AddLeadModal({ onClose, onSubmit }: AddLeadModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      zip: "",
    },
    propertyType: "residential",
    leadSource: "web",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await onSubmit({
        ...formData,
        status: "new",
        assignedTo: null,
        nextFollowUpAt: null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Add New Lead</h2>
          <button type="button" onClick={onClose} className="text-2xl text-slate-400 hover:text-white">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(event) => setFormData({ ...formData, firstName: event.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Last Name *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(event) => setFormData({ ...formData, lastName: event.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Phone *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">Street Address *</label>
            <input
              type="text"
              required
              value={formData.address.street}
              onChange={(event) => setFormData({ ...formData, address: { ...formData.address, street: event.target.value } })}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">City *</label>
              <input
                type="text"
                required
                value={formData.address.city}
                onChange={(event) => setFormData({ ...formData, address: { ...formData.address, city: event.target.value } })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">State *</label>
              <input
                type="text"
                required
                maxLength={2}
                value={formData.address.state}
                onChange={(event) => setFormData({ ...formData, address: { ...formData.address, state: event.target.value.toUpperCase() } })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">ZIP *</label>
              <input
                type="text"
                required
                value={formData.address.zip}
                onChange={(event) => setFormData({ ...formData, address: { ...formData.address, zip: event.target.value } })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Property Type</label>
              <select
                value={formData.propertyType}
                onChange={(event) => setFormData({ ...formData, propertyType: event.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">Lead Source</label>
              <select
                value={formData.leadSource}
                onChange={(event) => setFormData({ ...formData, leadSource: event.target.value })}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
              >
                <option value="web">Website</option>
                <option value="call">Phone Call</option>
                <option value="referral">Referral</option>
                <option value="ads">Advertisement</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg bg-white/5 px-4 py-2 text-slate-200 hover:bg-white/10">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
