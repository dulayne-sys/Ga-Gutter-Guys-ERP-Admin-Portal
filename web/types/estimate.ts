import type { FirestoreMaterial } from "./material";

export type EstimatePricing = {
  materialId?: string;
  materialName?: string;
  materialRate?: number;
  laborRate?: number;
  taxRatePct?: number;
  feet?: number;
  materialSubtotal?: number;
  laborSubtotal?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  material?: Pick<FirestoreMaterial, "id" | "name" | "sku" | "category" | "unit" | "pricePerFoot" | "taxable">;
};

export type Estimate = {
  id?: string;
  jobId?: string;
  address?: string;
  totalFeet?: number;
  pricePerFoot?: number;
  multiplier?: number;
  totalPrice?: number;
  amount?: number;
  createdAtServer?: unknown;
  createdAt?: string | number;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  measurementMethod?: "manual" | "ai";
  pricing?: EstimatePricing;
};
