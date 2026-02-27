"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { apiCreateEstimate } from "@/lib/api";
import { firestore } from "@/lib/firebase";
import type { Estimate } from "@/types/estimate";
import { CustomerIntakeForm, type CustomerIntakeData } from "./components/CustomerIntakeForm";
import { MeasurementMethodSelector, type MeasurementMethod } from "./components/MeasurementMethodSelector";
import { ManualDrawingTool } from "./components/ManualDrawingTool";
import { AISatelliteMeasurement } from "./components/AISatelliteMeasurement";
import { PricingConfiguration, type PricingResult } from "./components/PricingConfiguration";
import { EstimateReview } from "./components/EstimateReview";

type StepKey = "intake" | "method" | "measure" | "pricing" | "review";

const steps: Array<{ key: StepKey; label: string }> = [
  { key: "intake", label: "Customer Intake" },
  { key: "method", label: "Measurement Method" },
  { key: "measure", label: "Measurement" },
  { key: "pricing", label: "Pricing" },
  { key: "review", label: "Review" },
];

const initialCustomer: CustomerIntakeData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
};

const combineAddress = (customer: CustomerIntakeData) => {
  return [customer.addressLine1, customer.addressLine2, `${customer.city}, ${customer.state} ${customer.zip}`]
    .filter(Boolean)
    .join(", ");
};

export default function WebEstimatorPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [customer, setCustomer] = useState<CustomerIntakeData>(initialCustomer);
  const [method, setMethod] = useState<MeasurementMethod | null>(null);
  const [measuredFeet, setMeasuredFeet] = useState<number>(0);
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const activeStep = steps[stepIndex];
  const normalizedAddress = useMemo(() => combineAddress(customer), [customer]);

  const customerValid = useMemo(() => {
    return Boolean(
      customer.firstName.trim() &&
        customer.lastName.trim() &&
        customer.email.trim() &&
        customer.phone.trim() &&
        customer.addressLine1.trim() &&
        customer.city.trim() &&
        customer.state.trim() &&
        customer.zip.trim()
    );
  }, [customer]);

  const canContinue = useMemo(() => {
    switch (activeStep.key) {
      case "intake":
        return customerValid;
      case "method":
        return Boolean(method);
      case "measure":
        return measuredFeet > 0;
      case "pricing":
        return Boolean(pricing);
      case "review":
        return false;
      default:
        return false;
    }
  }, [activeStep.key, customerValid, measuredFeet, method, pricing]);

  const next = () => {
    if (!canContinue) return;
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const back = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const saveEstimate = async () => {
    if (!method || !pricing) return;

    setSaving(true);
    setSaveMessage(null);

    const payload: Estimate = {
      customer,
      measurementMethod: method,
      address: normalizedAddress,
      totalFeet: measuredFeet,
      pricing,
      totalPrice: pricing.total,
      createdAt: new Date().toISOString(),
    };

    try {
      await apiCreateEstimate(payload as Record<string, unknown>);

      if (firestore) {
        await addDoc(collection(firestore, "estimates"), {
          ...payload,
          createdAtServer: serverTimestamp(),
        });
      }

      setSaveMessage("Estimate saved successfully.");
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Failed to save estimate.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Professional Estimation Workflow</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Estimator</h1>
          </div>
          <div className="rounded-2xl border border-indigo-300/30 bg-indigo-500/10 px-4 py-2 text-xs text-indigo-100">
            Step {stepIndex + 1} of {steps.length}
          </div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-5">
          {steps.map((step, index) => {
            const isDone = index < stepIndex;
            const isActive = index === stepIndex;

            return (
              <div
                key={step.key}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  isActive
                    ? "border-indigo-300/50 bg-indigo-500/15 text-indigo-100"
                    : isDone
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-slate-950/40 text-slate-400"
                }`}
              >
                <span className="font-semibold">{index + 1}.</span> {step.label}
              </div>
            );
          })}
        </div>
      </section>

      {activeStep.key === "intake" ? <CustomerIntakeForm value={customer} onChange={setCustomer} /> : null}

      {activeStep.key === "method" ? <MeasurementMethodSelector value={method} onChange={setMethod} /> : null}

      {activeStep.key === "measure" && method === "manual" ? (
        <ManualDrawingTool address={normalizedAddress} value={measuredFeet} onMeasured={setMeasuredFeet} />
      ) : null}

      {activeStep.key === "measure" && method === "ai" ? (
        <AISatelliteMeasurement address={normalizedAddress} value={measuredFeet} onMeasured={setMeasuredFeet} />
      ) : null}

      {activeStep.key === "pricing" ? (
        <PricingConfiguration totalFeet={measuredFeet} value={pricing} onChange={setPricing} />
      ) : null}

      {activeStep.key === "review" && method && pricing ? (
        <EstimateReview
          customer={customer}
          method={method}
          totalFeet={measuredFeet}
          pricing={pricing}
          saving={saving}
          saveMessage={saveMessage}
          onSave={saveEstimate}
        />
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={stepIndex === 0 || saving}
          className="rounded-xl border border-white/15 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
        >
          Back
        </button>

        {activeStep.key !== "review" ? (
          <button
            type="button"
            onClick={next}
            disabled={!canContinue || saving}
            className="rounded-xl bg-gradient-to-r from-indigo-400 to-purple-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={saveEstimate}
            disabled={saving || !method || !pricing}
            className="rounded-xl bg-gradient-to-r from-indigo-400 to-purple-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Estimate"}
          </button>
        )}
      </div>
    </div>
  );
}
