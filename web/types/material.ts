export type FirestoreMaterialSchema = {
  name: string;
  sku?: string;
  category?: string;
  unit?: string;
  cost?: number;
  price?: number;
  pricePerFoot?: number;
  active?: boolean;
  taxable?: boolean;
};

export type FirestoreMaterial = FirestoreMaterialSchema & {
  id: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const coerceString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

export const coerceNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const coerceBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === "boolean" ? value : fallback;
};

const normalizeMaterialSchema = (data: Record<string, unknown>): FirestoreMaterialSchema => {
  const price = coerceNumber(data.price, 0);
  const explicitPerFoot = coerceNumber(data.pricePerFoot, NaN);

  return {
    name: coerceString(data.name) ?? "Material",
    sku: coerceString(data.sku),
    category: coerceString(data.category),
    unit: coerceString(data.unit),
    cost: coerceNumber(data.cost, 0),
    price,
    pricePerFoot: Number.isFinite(explicitPerFoot) ? explicitPerFoot : price,
    active: coerceBoolean(data.active, true),
    taxable: coerceBoolean(data.taxable, true),
  };
};

export const toFirestoreMaterial = (id: string, data: unknown): FirestoreMaterial => {
  const normalized = normalizeMaterialSchema(isRecord(data) ? data : {});
  return {
    id,
    ...normalized,
  };
};

export const toFirestoreMaterialWrite = (material: FirestoreMaterialSchema): FirestoreMaterialSchema => {
  return normalizeMaterialSchema(isRecord(material) ? material : {});
};
