"use client";

export type CustomerIntakeData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
};

type CustomerIntakeFormProps = {
  value: CustomerIntakeData;
  onChange: (next: CustomerIntakeData) => void;
};

const fields: Array<{ key: keyof CustomerIntakeData; label: string; required?: boolean }> = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "addressLine1", label: "Address Line 1", required: true },
  { key: "addressLine2", label: "Address Line 2" },
  { key: "city", label: "City", required: true },
  { key: "state", label: "State", required: true },
  { key: "zip", label: "ZIP", required: true },
];

export function CustomerIntakeForm({ value, onChange }: CustomerIntakeFormProps) {
  const update = (key: keyof CustomerIntakeData, next: string) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">Customer Intake</h2>
      <p className="mt-1 text-sm text-slate-400">Capture homeowner contact and property details before measurement.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="text-sm text-slate-200">
            {field.label}
            {field.required ? " *" : ""}
            <input
              value={value[field.key]}
              onChange={(event) => update(field.key, event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
