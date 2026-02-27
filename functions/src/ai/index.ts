import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/* -------------------------------------------------------------------------- */
/* SECRETS                                                                    */
/* -------------------------------------------------------------------------- */

const vertexApiKeySecret = defineSecret("VERTEX_API_KEY");

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Role = "admin" | "staff" | "viewer";

interface EnrichmentResult {
  totalLinearFeet: number;
  gutterSections: number;
  downspouts: number;
  difficulty: "standard" | "moderate" | "complex";
  confidence: number;
  reasoning: string;
  materialRecommendations: MaterialRecommendation[];
  estimatedLaborHours: number;
}

interface MaterialRecommendation {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

interface EnrichmentDoc {
  estimateId: string;
  status: "success" | "fallback" | "error";
  enrichment: EnrichmentResult;
  source: "vertex_ai" | "deterministic_fallback";
  createdAt: admin.firestore.FieldValue;
  createdBy: string;
}

/* -------------------------------------------------------------------------- */
/* ERROR CLASS                                                                */
/* -------------------------------------------------------------------------- */

class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const ROLE_SET: ReadonlySet<Role> = new Set(["admin", "staff", "viewer"]);
const isRole = (value: string): value is Role => ROLE_SET.has(value as Role);

const resolveRole = async (decoded: admin.auth.DecodedIdToken): Promise<Role> => {
  const roleFromClaim = readString(decoded.role as string | undefined);
  if (roleFromClaim && isRole(roleFromClaim)) return roleFromClaim;

  const userSnapshot = await db.collection("users").doc(decoded.uid).get();
  const roleFromDoc = readString(userSnapshot.data()?.role);
  if (roleFromDoc && isRole(roleFromDoc)) return roleFromDoc;

  throw new HttpError(403, "forbidden", "User role missing or invalid.");
};

const requireAuth = async (req: { headers: { authorization?: string } }): Promise<{
  uid: string;
  role: Role;
}> => {
  const header = req.headers.authorization;
  if (!header) throw new HttpError(401, "unauthenticated", "Missing Authorization header.");

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "unauthenticated", "Invalid Authorization header.");
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    throw new HttpError(401, "unauthenticated", "Invalid or expired token.");
  }

  const role = await resolveRole(decoded);
  return { uid: decoded.uid, role };
};

const requireRole = (role: Role, allowed: ReadonlyArray<Role>): void => {
  if (role === "admin") return;
  if (!allowed.includes(role)) {
    throw new HttpError(403, "forbidden", "Insufficient role.");
  }
};

const requireActiveLicense = async (): Promise<void> => {
  const snapshot = await db.collection("license").doc("current").get();
  if (!snapshot.exists || snapshot.data()?.active !== true) {
    throw new HttpError(403, "license_inactive", "License inactive.");
  }
};

const handleHttpError = (
  res: { status: (code: number) => { json: (body: unknown) => void } },
  error: unknown,
): void => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  logger.error("Unhandled error", { error });
  res.status(500).json({ error: "Internal server error", code: "internal" });
};

const setCorsHeaders = (
  req: { headers: { origin?: string }; method: string },
  res: { set: (key: string, value: string) => void; status: (code: number) => { send: (body: string) => void } },
): boolean => {
  const origin = readString(req.headers.origin) ?? "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Max-Age", "3600");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
};

/* -------------------------------------------------------------------------- */
/* VERTEX AI INTEGRATION                                                      */
/* -------------------------------------------------------------------------- */

const getProjectId = (): string => {
  const fromEnv = readString(process.env.GCLOUD_PROJECT);
  if (fromEnv) return fromEnv;

  const fromAdmin = readString(admin.app().options.projectId as string | undefined);
  if (fromAdmin) return fromAdmin;

  throw new HttpError(500, "project_id_missing", "Unable to resolve Firebase project ID.");
};

const buildEnrichmentPrompt = (address: string, rooflineFeet: number | null): string => {
  const lines = [
    "You are a gutter installation estimator. Analyze the following property and return enrichment data.",
    `Address: ${address}`,
  ];
  if (rooflineFeet) {
    lines.push(`Measured roofline: ${rooflineFeet} linear feet`);
  }
  lines.push(
    "",
    "Return ONLY valid JSON (no markdown fences) with these keys:",
    "- totalLinearFeet: number (estimated total gutter linear feet)",
    "- gutterSections: number (estimated number of separate gutter runs)",
    "- downspouts: number (estimated number of downspouts needed)",
    "- difficulty: \"standard\" | \"moderate\" | \"complex\"",
    "- confidence: number 0-1",
    "- reasoning: string (brief explanation)",
    "- materialRecommendations: array of { name: string, quantity: number, unit: string, unitCost: number }",
    "- estimatedLaborHours: number",
  );
  return lines.join("\n");
};

const callVertexAI = async (prompt: string): Promise<unknown> => {
  const apiKey = vertexApiKeySecret.value();
  if (!apiKey) {
    throw new HttpError(500, "vertex_api_key_missing", "Vertex API key missing.");
  }

  const projectId = getProjectId();
  const model = readString(process.env.VERTEX_MODEL) ?? "gemini-2.0-flash";
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = payload && typeof payload === "object" && "error" in payload
      ? JSON.stringify((payload as { error?: unknown }).error)
      : "Unknown Vertex error";
    throw new HttpError(502, "vertex_failed", `Vertex request failed: ${details}`);
  }

  return payload;
};

const extractVertexText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const parts = record.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
};

const parseEnrichmentJson = (text: string): EnrichmentResult | null => {
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    return {
      totalLinearFeet: typeof parsed.totalLinearFeet === "number" ? parsed.totalLinearFeet : 0,
      gutterSections: typeof parsed.gutterSections === "number" ? parsed.gutterSections : 0,
      downspouts: typeof parsed.downspouts === "number" ? parsed.downspouts : 0,
      difficulty: ["standard", "moderate", "complex"].includes(parsed.difficulty as string)
        ? parsed.difficulty as "standard" | "moderate" | "complex"
        : "standard",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      materialRecommendations: Array.isArray(parsed.materialRecommendations)
        ? (parsed.materialRecommendations as Array<Record<string, unknown>>).map((m) => ({
          name: typeof m.name === "string" ? m.name : "Unknown",
          quantity: typeof m.quantity === "number" ? m.quantity : 0,
          unit: typeof m.unit === "string" ? m.unit : "unit",
          unitCost: typeof m.unitCost === "number" ? m.unitCost : 0,
        }))
        : [],
      estimatedLaborHours: typeof parsed.estimatedLaborHours === "number" ? parsed.estimatedLaborHours : 0,
    };
  } catch {
    return null;
  }
};

/* -------------------------------------------------------------------------- */
/* DETERMINISTIC FALLBACK                                                     */
/* -------------------------------------------------------------------------- */

const deterministicFallback = (rooflineFeet: number | null): EnrichmentResult => {
  const totalFeet = rooflineFeet ?? 150;
  const sections = Math.max(1, Math.ceil(totalFeet / 25));
  const downspouts = Math.max(2, Math.ceil(totalFeet / 40));
  const laborHours = Math.ceil(totalFeet / 20);

  return {
    totalLinearFeet: totalFeet,
    gutterSections: sections,
    downspouts,
    difficulty: totalFeet > 300 ? "complex" : totalFeet > 150 ? "moderate" : "standard",
    confidence: 0.3,
    reasoning: "Deterministic fallback: AI enrichment was unavailable. Estimates are based on standard residential ratios.",
    materialRecommendations: [
      { name: "5\" K-Style Aluminum Gutter", quantity: totalFeet, unit: "ft", unitCost: 6.5 },
      { name: "2x3 Downspout", quantity: downspouts * 10, unit: "ft", unitCost: 4.0 },
      { name: "Gutter Hanger", quantity: Math.ceil(totalFeet / 2), unit: "ea", unitCost: 1.5 },
      { name: "End Cap", quantity: sections * 2, unit: "ea", unitCost: 3.0 },
      { name: "Outlet Drop", quantity: downspouts, unit: "ea", unitCost: 5.0 },
    ],
    estimatedLaborHours: laborHours,
  };
};

/* -------------------------------------------------------------------------- */
/* HTTP ENDPOINT                                                              */
/* -------------------------------------------------------------------------- */

/**
 * POST — Enrich an estimate with AI-backed analysis.
 * Body: { estimateId: string, address: string, rooflineFeet?: number }
 * Persists enrichment to Firestore under estimates/{estimateId}.
 */
export const enrichEstimate = onRequest(
  { secrets: [vertexApiKeySecret] },
  async (req, res) => {
    if (setCorsHeaders(req, res)) return;
    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
      }

      const auth = await requireAuth(req);
      requireRole(auth.role, ["staff"]);
      await requireActiveLicense();

      const body = (req.body ?? {}) as {
        estimateId?: unknown;
        address?: unknown;
        rooflineFeet?: unknown;
      };

      const estimateId = readString(body.estimateId);
      const address = readString(body.address);
      const rooflineFeet = typeof body.rooflineFeet === "number" ? body.rooflineFeet : null;

      if (!estimateId) {
        throw new HttpError(400, "invalid_argument", "estimateId is required.");
      }
      if (!address) {
        throw new HttpError(400, "invalid_argument", "address is required.");
      }

      const estimateDoc = await db.collection("estimates").doc(estimateId).get();
      if (!estimateDoc.exists) {
        throw new HttpError(404, "not_found", "Estimate not found.");
      }

      let enrichment: EnrichmentResult;
      let source: "vertex_ai" | "deterministic_fallback";

      try {
        const prompt = buildEnrichmentPrompt(address, rooflineFeet);
        const raw = await callVertexAI(prompt);
        const text = extractVertexText(raw);
        const parsed = parseEnrichmentJson(text);

        if (parsed && parsed.confidence > 0) {
          enrichment = parsed;
          source = "vertex_ai";
          logger.info("AI enrichment succeeded", { estimateId, confidence: parsed.confidence });
        } else {
          logger.warn("AI returned unparseable result, using fallback", { estimateId, text: text.slice(0, 200) });
          enrichment = deterministicFallback(rooflineFeet);
          source = "deterministic_fallback";
        }
      } catch (aiError) {
        logger.warn("AI enrichment failed, using deterministic fallback", { estimateId, error: aiError });
        enrichment = deterministicFallback(rooflineFeet);
        source = "deterministic_fallback";
      }

      const enrichmentDoc: EnrichmentDoc = {
        estimateId,
        status: source === "vertex_ai" ? "success" : "fallback",
        enrichment,
        source,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.uid,
      };

      await db.collection("estimates").doc(estimateId).set(
        { aiEnrichment: enrichmentDoc, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );

      res.status(200).json({
        status: "ok",
        source,
        enrichment,
      });
    } catch (error) {
      handleHttpError(res, error);
    }
  },
);

/**
 * GET — Retrieve enrichment data for an estimate.
 */
export const getEstimateEnrichment = onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;
  try {
    if (req.method !== "GET") {
      throw new HttpError(405, "method_not_allowed", "Only GET allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth.role, ["staff"]);

    const estimateId = readString(req.query.estimateId);
    if (!estimateId) {
      throw new HttpError(400, "invalid_argument", "estimateId query param is required.");
    }

    const doc = await db.collection("estimates").doc(estimateId).get();
    if (!doc.exists) {
      throw new HttpError(404, "not_found", "Estimate not found.");
    }

    const data = doc.data();
    const aiEnrichment = data?.aiEnrichment ?? null;

    res.status(200).json({
      status: "ok",
      enrichment: aiEnrichment,
    });
  } catch (error) {
    handleHttpError(res, error);
  }
});
