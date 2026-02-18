"use client";

import { useMemo, useState } from "react";
import { apiVertexMeasurement } from "@/lib/api";

type AISatelliteMeasurementProps = {
  address: string;
  value: number;
  onMeasured: (feet: number) => void;
};

type ParsedAiMeasurement = {
  totalFeet: number;
  confidence?: number;
  reasoning?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const normalizeFeet = (value: number): number | null => {
  if (!Number.isFinite(value) || value <= 0 || value > 100_000) return null;
  return Number(value.toFixed(1));
};

const normalizeConfidence = (value: number): number | null => {
  if (!Number.isFinite(value)) return null;
  const normalized = value > 1 ? value / 100 : value;
  if (normalized < 0 || normalized > 1) return null;
  return Number(normalized.toFixed(3));
};

const findNumericFootage = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const direct = Number(value);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const match = value.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|linear)/i);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumericFootage(item);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    const priorityKeys = [
      "totalFeet",
      "linearFeet",
      "perimeterFeet",
      "gutterFeet",
      "feet",
      "total_feet",
      "linear_feet",
    ];

    for (const key of priorityKeys) {
      if (key in record) {
        const found = findNumericFootage(record[key]);
        if (found) return found;
      }
    }

    for (const [key, nestedValue] of Object.entries(record)) {
      if (/feet|foot|linear|perimeter|gutter/i.test(key)) {
        const found = findNumericFootage(nestedValue);
        if (found) return found;
      }
    }

    for (const nestedValue of Object.values(record)) {
      const found = findNumericFootage(nestedValue);
      if (found) return found;
    }
  }

  return null;
};

const parsePossibleJsonBlocks = (text: string): unknown[] => {
  const results: unknown[] = [];

  try {
    results.push(JSON.parse(text));
  } catch {
    // no-op
  }

  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try {
      results.push(JSON.parse(fencedMatch[1]));
    } catch {
      // no-op
    }
  }

  const objectLikeMatch = text.match(/\{[\s\S]*\}/);
  if (objectLikeMatch?.[0]) {
    try {
      results.push(JSON.parse(objectLikeMatch[0]));
    } catch {
      // no-op
    }
  }

  let depth = 0;
  let start = -1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === "}") {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        const candidate = text.slice(start, index + 1);
        try {
          results.push(JSON.parse(candidate));
        } catch {
          // no-op
        }
        start = -1;
      }
    }
  }

  return results;
};

const parseConfidence = (payload: unknown): number | null => {
  if (typeof payload === "number") {
    return normalizeConfidence(payload);
  }

  if (typeof payload === "string") {
    const direct = Number(payload.trim());
    if (Number.isFinite(direct)) {
      const normalized = normalizeConfidence(direct);
      if (normalized != null) return normalized;
    }

    const labelled = payload.match(/confidence\s*[:=]?\s*(\d+(?:\.\d+)?)(%?)/i);
    if (labelled) {
      const raw = Number(labelled[1]);
      const hasPercent = labelled[2] === "%";
      return normalizeConfidence(hasPercent ? raw / 100 : raw);
    }

    return null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const parsed = parseConfidence(item);
      if (parsed != null) return parsed;
    }
    return null;
  }

  if (isRecord(payload)) {
    const preferredKeys = ["confidence", "confidenceScore", "score", "certainty"];
    for (const key of preferredKeys) {
      if (key in payload) {
        const parsed = parseConfidence(payload[key]);
        if (parsed != null) return parsed;
      }
    }

    for (const [key, value] of Object.entries(payload)) {
      if (/confidence|score|certainty/i.test(key)) {
        const parsed = parseConfidence(value);
        if (parsed != null) return parsed;
      }
    }

    for (const nested of Object.values(payload)) {
      const parsed = parseConfidence(nested);
      if (parsed != null) return parsed;
    }
  }

  return null;
};

const parseMeasurementFromText = (text: string): ParsedAiMeasurement | null => {
  const parsedBlocks = parsePossibleJsonBlocks(text);
  for (const block of parsedBlocks) {
    const feet = findNumericFootage(block);
    if (feet) {
      return {
        totalFeet: Number(feet.toFixed(1)),
        confidence: parseConfidence(block) ?? undefined,
        reasoning: text,
      };
    }
  }

  const inlineFeet = findNumericFootage(text);
  if (inlineFeet) {
    return {
      totalFeet: Number(inlineFeet.toFixed(1)),
      confidence: parseConfidence(text) ?? undefined,
      reasoning: text,
    };
  }

  return null;
};

const parseVertexMeasurement = (payload: unknown): ParsedAiMeasurement | null => {
  const directFeet = findNumericFootage(payload);
  if (directFeet) {
    const normalizedFeet = normalizeFeet(directFeet);
    if (normalizedFeet != null) {
      return {
        totalFeet: normalizedFeet,
        confidence: parseConfidence(payload) ?? undefined,
      };
    }
  }

  if (isRecord(payload)) {
    const record = payload;
    const textCandidates = [
      record.text,
      record.output,
      record.message,
      record.response,
      record.content,
      record.answer,
      record.result,
    ].filter((entry) => typeof entry === "string") as string[];

    for (const text of textCandidates) {
      const parsedFromText = parseMeasurementFromText(text);
      if (parsedFromText) {
        const normalizedFeet = normalizeFeet(parsedFromText.totalFeet);
        if (normalizedFeet != null) {
          return {
            totalFeet: normalizedFeet,
            confidence: parsedFromText.confidence ?? parseConfidence(payload) ?? undefined,
            reasoning: parsedFromText.reasoning,
          };
        }
      }
    }

    const nestedCandidates = [record.data, record.result, record.response, record.candidates, record.parts];
    for (const candidate of nestedCandidates) {
      const nested = parseVertexMeasurement(candidate);
      if (nested) return nested;
    }
  }

  return null;
};

export function AISatelliteMeasurement({ address, value, onMeasured }: AISatelliteMeasurementProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);

  const normalizedAddress = useMemo(() => address.trim(), [address]);

  const runMeasurement = async () => {
    if (!normalizedAddress) {
      setError("Address is required before running AI measurement.");
      return;
    }

    setLoading(true);
    setError(null);
    setReasoning(null);
    setConfidence(null);

    try {
      const payload = await apiVertexMeasurement({
        address: normalizedAddress,
        task: "satellite_measurement",
        responseFormat: "json",
      });

      const parsed = parseVertexMeasurement(payload);
      if (!parsed) {
        throw new Error("Unable to parse measurement from Vertex response.");
      }

      onMeasured(parsed.totalFeet);
      setConfidence(parsed.confidence ?? null);
      setReasoning(parsed.reasoning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI measurement failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">AI Satellite Measurement</h2>
      <p className="mt-1 text-sm text-slate-400">Use AI analysis to estimate total residential roof-edge and gutter linear footage from the homeowner address.</p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Address</p>
        <p className="mt-1">{normalizedAddress || "No address entered yet."}</p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void runMeasurement()}
          disabled={loading || !normalizedAddress}
          className="rounded-xl bg-gradient-to-r from-indigo-400 to-purple-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Run AI Measurement"}
        </button>
        <span className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          Total: {value.toFixed(1)} ft
        </span>
      </div>

      {confidence != null ? (
        <p className="mt-3 text-xs text-slate-300">Confidence: {(confidence * 100).toFixed(0)}%</p>
      ) : null}
      {reasoning ? <p className="mt-2 text-xs text-slate-400">Model Notes: {reasoning}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
