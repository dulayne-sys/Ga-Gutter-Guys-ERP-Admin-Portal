"use client";

import { useEffect, useState } from "react";

export type CrudFieldType = "text" | "number" | "date" | "textarea" | "select";

export type CrudFieldDefinition = {
  name: string;
  label: string;
  type: CrudFieldType;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

type CrudRecordModalProps = {
  mode: "create" | "edit";
  title: string;
  fields: CrudFieldDefinition[];
  initialValues: Record<string, string>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
};

export default function CrudRecordModal({
  mode,
  title,
  fields,
  initialValues,
  submitting = false,
  onClose,
  onSubmit,
}: CrudRecordModalProps) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-2xl text-slate-400 hover:text-white">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {fields.map((field) => {
              const value = values[field.name] ?? "";
              const baseClassName = "w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-slate-100";

              return (
                <div key={field.name} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                  <label className="mb-1 block text-sm font-medium text-slate-200">
                    {field.label}{field.required ? " *" : ""}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      required={field.required}
                      value={value}
                      placeholder={field.placeholder}
                      rows={3}
                      onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                      className={baseClassName}
                    />
                  ) : null}

                  {field.type === "select" ? (
                    <select
                      required={field.required}
                      value={value}
                      onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                      className={baseClassName}
                    >
                      <option value="">Select...</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {field.type !== "textarea" && field.type !== "select" ? (
                    <input
                      type={field.type}
                      required={field.required}
                      value={value}
                      placeholder={field.placeholder}
                      onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                      className={baseClassName}
                    />
                  ) : null}
                </div>
              );
            })}
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
              {submitting ? "Saving..." : mode === "create" ? "Create" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
