"use client";

import type { CustomerIntakeData } from "./CustomerIntakeForm";
import type { MeasurementMethod } from "./MeasurementMethodSelector";
import type { PricingResult } from "./PricingConfiguration";

type EstimateReviewProps = {
  customer: CustomerIntakeData;
  method: MeasurementMethod;
  totalFeet: number;
  pricing: PricingResult;
  saving: boolean;
  saveMessage: string | null;
  onSave: () => void;
};

const buildPrintHtml = (props: EstimateReviewProps) => {
  return `
    <html>
      <head>
        <title>Estimate Summary</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h1 { margin: 0 0 8px; }
          h2 { margin-top: 18px; margin-bottom: 6px; }
          p { margin: 4px 0; }
          .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <h1>GA Gutter Guys Estimate</h1>
        <p>Prepared for ${props.customer.firstName} ${props.customer.lastName}</p>
        <p>Address: ${props.customer.addressLine1}, ${props.customer.city}, ${props.customer.state} ${props.customer.zip}</p>

        <h2>Measurement</h2>
        <div class="card">
          <p>Method: ${props.method}</p>
          <p>Total Linear Feet: ${props.totalFeet.toFixed(1)} ft</p>
        </div>

        <h2>Pricing</h2>
        <div class="card">
          <p>Material: ${props.pricing.materialName}</p>
          <p>Material Subtotal: $${props.pricing.materialSubtotal.toFixed(2)}</p>
          <p>Labor Subtotal: $${props.pricing.laborSubtotal.toFixed(2)}</p>
          <p>Tax: $${props.pricing.tax.toFixed(2)}</p>
          <p><strong>Total: $${props.pricing.total.toFixed(2)}</strong></p>
        </div>
      </body>
    </html>
  `;
};

export function EstimateReview(props: EstimateReviewProps) {
  const printEstimate = () => {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.write(buildPrintHtml(props));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">Estimate Review</h2>
      <p className="mt-1 text-sm text-slate-400">Verify all values before saving and generating customer output.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Customer</p>
          <p className="mt-2 font-semibold text-white">
            {props.customer.firstName} {props.customer.lastName}
          </p>
          <p>{props.customer.email}</p>
          <p>{props.customer.phone}</p>
          <p className="mt-2">{props.customer.addressLine1}</p>
          <p>
            {props.customer.city}, {props.customer.state} {props.customer.zip}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Estimate Summary</p>
          <p className="mt-2">
            Measurement Method: <span className="font-semibold text-white">{props.method}</span>
          </p>
          <p>
            Total Feet: <span className="font-semibold text-white">{props.totalFeet.toFixed(1)} ft</span>
          </p>
          <p>
            Material: <span className="font-semibold text-white">{props.pricing.materialName}</span>
          </p>
          <p>
            Subtotal: <span className="font-semibold text-white">${props.pricing.subtotal.toFixed(2)}</span>
          </p>
          <p>
            Tax: <span className="font-semibold text-white">${props.pricing.tax.toFixed(2)}</span>
          </p>
          <p className="mt-1 text-base font-semibold text-emerald-200">Total: ${props.pricing.total.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={printEstimate}
          className="rounded-xl border border-white/15 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200"
        >
          Generate PDF
        </button>

        <button
          type="button"
          onClick={props.onSave}
          disabled={props.saving}
          className="rounded-xl bg-gradient-to-r from-indigo-400 to-purple-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {props.saving ? "Saving..." : "Save Estimate"}
        </button>
      </div>

      {props.saveMessage ? <p className="mt-3 text-sm text-cyan-200">{props.saveMessage}</p> : null}
    </section>
  );
}
