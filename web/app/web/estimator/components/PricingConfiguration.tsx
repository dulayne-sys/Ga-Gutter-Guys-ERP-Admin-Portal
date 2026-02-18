"use client";

import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { firestore } from "@/lib/firebase";
import { toFirestoreMaterial, type FirestoreMaterial } from "@/types/material";

export type PricingResult = {
  materialId: string;
  materialName: string;
  material: Pick<FirestoreMaterial, "id" | "name" | "sku" | "category" | "unit" | "pricePerFoot" | "taxable">;
  feet: number;
  materialRate: number;
  laborRate: number;
  taxRatePct: number;
  materialSubtotal: number;
  laborSubtotal: number;
  subtotal: number;
  tax: number;
  total: number;
};

type PricingConfigurationProps = {
  totalFeet: number;
  value: PricingResult | null;
  onChange: (next: PricingResult | null) => void;
};

const fallbackMaterial: FirestoreMaterial = {
  id: "fallback",
  name: "6in Seamless Aluminum",
  pricePerFoot: 8.5,
  active: true,
  taxable: true,
};

export function PricingConfiguration({ totalFeet, value, onChange }: PricingConfigurationProps) {
  const [materials, setMaterials] = useState<FirestoreMaterial[]>([]);
  const [materialId, setMaterialId] = useState<string>("");
  const [laborRate, setLaborRate] = useState<number>(3.5);
  const [taxRatePct, setTaxRatePct] = useState<number>(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadMaterials = async () => {
      setLoading(true);
      try {
        if (!firestore) {
          if (active) {
            setMaterials([fallbackMaterial]);
          }
          return;
        }

        const snapshot = await getDocs(collection(firestore, "materials"));
        const rows = snapshot.docs
          .map((docSnap) => toFirestoreMaterial(docSnap.id, docSnap.data() as Record<string, unknown>))
          .filter((material) => material.active !== false);

        if (active) {
          setMaterials(rows.length ? rows : [fallbackMaterial]);
        }
      } catch {
        if (active) {
          setMaterials([fallbackMaterial]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadMaterials();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!materialId && materials[0]) {
      setMaterialId(materials[0].id);
    }
  }, [materialId, materials]);

  useEffect(() => {
    if (value) {
      setLaborRate(value.laborRate);
      setTaxRatePct(value.taxRatePct);
      if (value.materialId) {
        setMaterialId(value.materialId);
      }
    }
  }, [value]);

  const pricing = useMemo<PricingResult | null>(() => {
    if (!totalFeet || totalFeet <= 0 || !materials.length) {
      return null;
    }

    const selectedMaterial = materials.find((material) => material.id === materialId) ?? materials[0];
    const materialRate = Number(selectedMaterial.pricePerFoot ?? selectedMaterial.price ?? 0);
    const materialSubtotal = Number((totalFeet * materialRate).toFixed(2));
    const laborSubtotal = Number((totalFeet * laborRate).toFixed(2));
    const subtotal = Number((materialSubtotal + laborSubtotal).toFixed(2));
    const tax = Number((subtotal * (taxRatePct / 100)).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    return {
      materialId: selectedMaterial.id,
      materialName: selectedMaterial.name,
      material: {
        id: selectedMaterial.id,
        name: selectedMaterial.name,
        sku: selectedMaterial.sku,
        category: selectedMaterial.category,
        unit: selectedMaterial.unit,
        pricePerFoot: selectedMaterial.pricePerFoot,
        taxable: selectedMaterial.taxable,
      },
      feet: Number(totalFeet.toFixed(1)),
      materialRate,
      laborRate,
      taxRatePct,
      materialSubtotal,
      laborSubtotal,
      subtotal,
      tax,
      total,
    };
  }, [laborRate, materialId, materials, taxRatePct, totalFeet]);

  useEffect(() => {
    onChange(pricing);
  }, [pricing, onChange]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">Pricing Configuration</h2>
      <p className="mt-1 text-sm text-slate-400">Pull active material rates from Firestore and calculate full estimate totals.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm text-slate-200">
          Material
          <select
            value={materialId}
            onChange={(event) => setMaterialId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
            disabled={loading || !materials.length}
          >
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} (${Number(material.pricePerFoot ?? material.price ?? 0).toFixed(2)}/ft)
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-200">
          Labor ($/ft)
          <input
            type="number"
            min={0}
            step={0.1}
            value={laborRate}
            onChange={(event) => setLaborRate(Number(event.target.value || 0))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
          />
        </label>

        <label className="text-sm text-slate-200">
          Tax Rate (%)
          <input
            type="number"
            min={0}
            step={0.1}
            value={taxRatePct}
            onChange={(event) => setTaxRatePct(Number(event.target.value || 0))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
          />
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-indigo-300/20 bg-indigo-500/10 p-4 text-sm text-slate-200">
        {!pricing ? (
          <p>Total footage is required before pricing can be calculated.</p>
        ) : (
          <div className="grid gap-1">
            <p>Footage: {pricing.feet.toFixed(1)} ft</p>
            <p>Material Subtotal: ${pricing.materialSubtotal.toFixed(2)}</p>
            <p>Labor Subtotal: ${pricing.laborSubtotal.toFixed(2)}</p>
            <p>Subtotal: ${pricing.subtotal.toFixed(2)}</p>
            <p>Tax: ${pricing.tax.toFixed(2)}</p>
            <p className="mt-1 text-base font-semibold text-white">Total: ${pricing.total.toFixed(2)}</p>
          </div>
        )}
      </div>
    </section>
  );
}
