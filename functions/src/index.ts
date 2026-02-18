// ======================================================
// GA GUTTER GUYS — CLOUD FUNCTIONS ENTRY
// Firebase v2 (HTTP) — us-east1
// ======================================================

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { randomUUID } from "node:crypto";
import type { Request as HttpRequest } from "firebase-functions/v2/https";
import type { Response as HttpResponse } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

import {
  buildOptimizeRouteRequest,
  callRoutesComputeRoutes,
  normalizeRouteResponse,
  type RouteLegSummary,
  type RouteTotals,
} from "./routes/routesClient";

// ======================================================
// GLOBAL REGION LOCK
// ======================================================

setGlobalOptions({
  region: "us-east1",
});

// ======================================================
// ADMIN INITIALIZATION (SAFE SINGLE INIT)
// ======================================================

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/* -------------------------------------------------------------------------- */
/* SECRETS */
/* -------------------------------------------------------------------------- */

const mapsApiKey = defineSecret("MAPS_API_KEY");
const vertexApiKeySecret = defineSecret("VERTEX_API_KEY");
const qboClientIdSecret = defineSecret("QBO_CLIENT_ID");
const qboClientSecretSecret = defineSecret("QBO_CLIENT_SECRET");
const qboRedirectUriSecret = defineSecret("QBO_REDIRECT_URI");
const gcalClientIdSecret = defineSecret("GCAL_CLIENT_ID");
const gcalClientSecretSecret = defineSecret("GCAL_CLIENT_SECRET");
const gcalRedirectUriSecret = defineSecret("GCAL_REDIRECT_URI");

const getMapsApiKey = (): string => {
  const key = mapsApiKey.value();
  if (!key) {
    throw new HttpError(500, "missing_api_key", "Routes API key missing.");
  }
  return key;
};

const getVertexApiKey = (): string => getRequiredSecret(
  () => vertexApiKeySecret.value(),
  "vertex_api_key_missing",
  "Vertex API key missing. Set VERTEX_API_KEY secret."
);

const getRequiredSecret = (
  getValue: () => string,
  code: string,
  message: string,
): string => {
  const value = readString(getValue());
  if (!value) {
    throw new HttpError(500, code, message);
  }
  return value;
};

const getQboClientId = (): string => getRequiredSecret(
  () => qboClientIdSecret.value(),
  "qbo_client_id_missing",
  "QuickBooks client ID missing."
);

const getQboClientSecret = (): string => getRequiredSecret(
  () => qboClientSecretSecret.value(),
  "qbo_client_secret_missing",
  "QuickBooks client secret missing."
);

const getQboRedirectUri = (): string => getRequiredSecret(
  () => qboRedirectUriSecret.value(),
  "qbo_redirect_uri_missing",
  "QuickBooks redirect URI missing."
);

const getGcalClientId = (): string => getRequiredSecret(
  () => gcalClientIdSecret.value(),
  "gcal_client_id_missing",
  "Google Calendar client ID missing."
);

const getGcalClientSecret = (): string => getRequiredSecret(
  () => gcalClientSecretSecret.value(),
  "gcal_client_secret_missing",
  "Google Calendar client secret missing."
);

const getGcalRedirectUri = (): string => getRequiredSecret(
  () => gcalRedirectUriSecret.value(),
  "gcal_redirect_uri_missing",
  "Google Calendar redirect URI missing."
);

/* -------------------------------------------------------------------------- */
/* TYPES */
/* -------------------------------------------------------------------------- */

type Role = "admin" | "staff" | "viewer";

interface AuthContext {
  uid: string;
  role: Role;
  token: DecodedIdToken;
}

interface HomeSettings {
  address: string;
  lat: number;
  lng: number;
}

interface RouteStop {
  jobId: string;
  rank: number;
  address: string;
  lat: number;
  lng: number;
  customerName: string | null;
  scheduledAt: string | null;
  status: string | null;
}

interface RouteDoc {
  date: string;
  home: HomeSettings;
  stopCount: number;
  stops: RouteStop[];
  optimized: boolean;
  totals: RouteTotals;
  polyline: {
    encoded: string;
    hasEncoded: boolean;
  };
  legs: RouteLegSummary[];
  updatedAt: FieldValue;
}

interface QboAuthStateDoc {
  uid: string;
  createdAtMs: number;
  expiresAtMs: number;
  used: boolean;
  returnUrl: string | null;
}

interface QboConnectionDoc {
  provider: "quickbooks";
  connected: boolean;
  realmId: string | null;
  tokenType: string | null;
  scope: string[];
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  connectedAt?: FieldValue;
  connectedBy?: string;
  disconnectedAt?: FieldValue;
  disconnectedBy?: string;
  updatedAt: FieldValue;
}

interface GcalAuthStateDoc {
  uid: string;
  createdAtMs: number;
  expiresAtMs: number;
  used: boolean;
  returnUrl: string | null;
}

interface GcalConnectionDoc {
  provider: "google_calendar";
  connected: boolean;
  calendarId: string;
  tokenType: string | null;
  scope: string[];
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  connectedAt?: FieldValue;
  connectedBy?: string;
  disconnectedAt?: FieldValue;
  disconnectedBy?: string;
  updatedAt: FieldValue;
}

interface VertexChatMessage {
  role?: string;
  content?: string;
}

interface VertexChatBody {
  address?: string;
  messages?: VertexChatMessage[];
  meta?: {
    task?: string;
    responseFormat?: "json" | "text";
  };
}

/* -------------------------------------------------------------------------- */
/* ERROR CLASS */
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
/* AUTH HELPERS */
/* -------------------------------------------------------------------------- */

const ROLE_SET: ReadonlySet<Role> = new Set(["admin", "staff", "viewer"]);

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const isRole = (value: string): value is Role => ROLE_SET.has(value as Role);

const resolveRoleFromTokenOrUserDoc = async (decoded: DecodedIdToken): Promise<Role> => {
  const roleFromClaim = readString(decoded.role);
  if (roleFromClaim && isRole(roleFromClaim)) {
    return roleFromClaim;
  }

  const userSnapshot = await db.collection("users").doc(decoded.uid).get();
  const roleFromDoc = readString(userSnapshot.data()?.role);
  if (roleFromDoc && isRole(roleFromDoc)) {
    return roleFromDoc;
  }

  throw new HttpError(403, "forbidden", "User role missing or invalid.");
};

const getBearerToken = (req: HttpRequest): string => {
  const header = req.headers.authorization as string | undefined;
  if (!header) throw new HttpError(401, "unauthenticated", "Missing Authorization header.");

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token)
    throw new HttpError(401, "unauthenticated", "Invalid Authorization header.");

  return token;
};

const requireAuth = async (req: HttpRequest): Promise<AuthContext> => {
  const token = getBearerToken(req);

  let decoded: DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch (error) {
    logger.warn("Auth token verification failed", { error });
    throw new HttpError(401, "unauthenticated", "Invalid or expired token.");
  }

  const roleValue = await resolveRoleFromTokenOrUserDoc(decoded);

  return { uid: decoded.uid, role: roleValue, token: decoded };
};

const requireAuthenticatedToken = async (req: HttpRequest): Promise<DecodedIdToken> => {
  const token = getBearerToken(req);

  try {
    return await admin.auth().verifyIdToken(token);
  } catch (error) {
    logger.warn("Auth token verification failed", { error });
    throw new HttpError(401, "unauthenticated", "Invalid or expired token.");
  }
};

const requireRole = (auth: AuthContext, allowed: ReadonlyArray<Role>): void => {
  if (auth.role === "admin") {
    return;
  }

  if (!allowed.includes(auth.role))
    throw new HttpError(403, "forbidden", "Insufficient role.");
};

const requireActiveLicense = async (): Promise<void> => {
  const snapshot = await db.collection("license").doc("current").get();
  if (!snapshot.exists) {
    logger.warn("License document missing");
    throw new HttpError(403, "license_missing", "License document missing.");
  }

  const active = snapshot.data()?.active === true;
  if (!active) {
    logger.warn("License inactive");
    throw new HttpError(403, "license_inactive", "License inactive.");
  }
};

/* -------------------------------------------------------------------------- */
/* UTILITIES */
/* -------------------------------------------------------------------------- */

const handleHttpError = (res: HttpResponse, error: unknown): void => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  logger.error("Unhandled error", { error });
  res.status(500).json({ error: "Internal server error", code: "internal" });
};

const parseDateId = (value: unknown): string => {
  const dateId = readString(value);
  if (!dateId || !/^\d{4}-\d{2}-\d{2}$/.test(dateId)) {
    throw new HttpError(400, "invalid_argument", "Invalid date format. Use YYYY-MM-DD.");
  }
  return dateId;
};

const readIsoDate = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") {
      return toDate().toISOString();
    }
  }
  return null;
};

const resolveOrigin = (req: HttpRequest): string | null => {
  const origin = readString(req.headers.origin as string | undefined);
  if (!origin) {
    return null;
  }
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

const setCorsHeaders = (req: HttpRequest, res: HttpResponse): void => {
  const origin = resolveOrigin(req) ?? "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Max-Age", "3600");
};

const handlePreflight = (req: HttpRequest, res: HttpResponse): boolean => {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
};

const withCors = (
  handler: (req: HttpRequest, res: HttpResponse) => Promise<void> | void,
) => {
  return async (req: HttpRequest, res: HttpResponse): Promise<void> => {
    if (handlePreflight(req, res)) {
      return;
    }
    setCorsHeaders(req, res);
    await handler(req, res);
  };
};

const getProjectId = (): string => {
  const fromEnv = readString(process.env.GCLOUD_PROJECT);
  if (fromEnv) return fromEnv;

  const fromAdmin = readString(admin.app().options.projectId as string | undefined);
  if (fromAdmin) return fromAdmin;

  throw new HttpError(500, "project_id_missing", "Unable to resolve Firebase project ID.");
};

const buildVertexPrompt = (address: string): string => {
  return [
    "You are estimating residential roof-edge and gutter replacement scope.",
    `Address: ${address}`,
    "Return strict JSON only with keys: totalFeet (number), confidence (0..1), reasoning (string).",
    "Do not include markdown fences.",
  ].join("\n");
};

const extractVertexText = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const parts = record.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
};

const invokeVertexEstimate = async (address: string): Promise<{ text: string; raw: unknown }> => {
  const apiKey = getVertexApiKey();
  const projectId = getProjectId();
  const model = readString(process.env.VERTEX_MODEL) ?? "gemini-2.0-flash";
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildVertexPrompt(address) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = payload && typeof payload === "object" && "error" in payload
      ? JSON.stringify((payload as { error?: unknown }).error)
      : "Unknown Vertex error";
    throw new HttpError(502, "vertex_failed", `Vertex request failed: ${details}`);
  }

  return {
    text: extractVertexText(payload),
    raw: payload,
  };
};

const qboAuthBaseUrl = "https://appcenter.intuit.com/connect/oauth2";
const qboTokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const qboScope = "com.intuit.quickbooks.accounting";
const gcalAuthBaseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const gcalTokenUrl = "https://oauth2.googleapis.com/token";
const gcalApiBaseUrl = "https://www.googleapis.com/calendar/v3";
const gcalScope = "https://www.googleapis.com/auth/calendar.events";

const qboConnectionRef = () => db.collection("integrations").doc("quickbooks");
const qboAuthStateRef = (stateId: string) => db.collection("qboAuthStates").doc(stateId);
const gcalConnectionRef = (uid: string) => db.collection("integrations").doc(`googleCalendar_${uid}`);
const gcalAuthStateRef = (stateId: string) => db.collection("gcalAuthStates").doc(stateId);

const buildQboAuthUrl = (state: string): string => {
  const query = new URLSearchParams({
    client_id: getQboClientId(),
    response_type: "code",
    scope: qboScope,
    redirect_uri: getQboRedirectUri(),
    state,
  });

  return `${qboAuthBaseUrl}?${query.toString()}`;
};

const buildGcalAuthUrl = (state: string): string => {
  const query = new URLSearchParams({
    client_id: getGcalClientId(),
    redirect_uri: getGcalRedirectUri(),
    response_type: "code",
    scope: gcalScope,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });

  return `${gcalAuthBaseUrl}?${query.toString()}`;
};

const appendStatusToReturnUrl = (returnUrl: string, provider: "qbo" | "gcal", value: string): string | null => {
  try {
    const parsed = new URL(returnUrl);
    parsed.searchParams.set(provider, value);
    return parsed.toString();
  } catch {
    return null;
  }
};

const sendQboCallbackHtml = (res: HttpResponse, title: string, message: string): void => {
  res.status(200).send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;">
    <h1 style="font-size:20px;margin-bottom:10px;">${title}</h1>
    <p style="font-size:14px;line-height:1.5;">${message}</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:16px;">You can close this tab and return to the portal.</p>
  </body>
</html>`);
};

const callGoogleCalendarApi = async (options: {
  accessToken: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}): Promise<unknown> => {
  const url = new URL(`${gcalApiBaseUrl}${options.path}`);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: options.method,
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const details = payload && typeof payload === "object" && "error" in payload
      ? JSON.stringify((payload as { error?: unknown }).error)
      : `status ${response.status}`;
    throw new HttpError(502, "gcal_api_error", `Google Calendar API failed: ${details}`);
  }

  return payload;
};

const getValidGcalAccess = async (uid: string): Promise<{ accessToken: string; calendarId: string }> => {
  const connectionSnapshot = await gcalConnectionRef(uid).get();
  if (!connectionSnapshot.exists) {
    throw new HttpError(412, "gcal_not_connected", "Google Calendar not connected.");
  }

  const connection = connectionSnapshot.data() as Partial<GcalConnectionDoc>;
  if (connection.connected !== true) {
    throw new HttpError(412, "gcal_not_connected", "Google Calendar not connected.");
  }

  const accessToken = readString(connection.accessToken);
  const refreshToken = readString(connection.refreshToken);
  const tokenType = readString(connection.tokenType);
  const calendarId = readString(connection.calendarId) ?? "primary";
  const accessTokenExpiresAt = readString(connection.accessTokenExpiresAt);

  const isAccessTokenFresh = (() => {
    if (!accessToken || !accessTokenExpiresAt) return false;
    const expiresMs = Date.parse(accessTokenExpiresAt);
    if (Number.isNaN(expiresMs)) return false;
    return expiresMs - Date.now() > 60 * 1000;
  })();

  if (isAccessTokenFresh && accessToken) {
    return { accessToken, calendarId };
  }

  if (!refreshToken) {
    throw new HttpError(412, "gcal_reconnect_required", "Google Calendar token expired. Reconnect required.");
  }

  const tokenPayload = new URLSearchParams({
    client_id: getGcalClientId(),
    client_secret: getGcalClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const tokenResponse = await fetch(gcalTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenPayload.toString(),
  });

  const refreshed = await tokenResponse.json().catch(() => null) as {
    access_token?: unknown;
    expires_in?: unknown;
    token_type?: unknown;
  } | null;

  if (!tokenResponse.ok || !refreshed) {
    throw new HttpError(502, "gcal_token_refresh_failed", "Unable to refresh Google Calendar access token.");
  }

  const nextAccessToken = readString(refreshed.access_token);
  const expiresIn = typeof refreshed.expires_in === "number"
    ? refreshed.expires_in
    : Number(refreshed.expires_in ?? 0);
  const nextTokenType = readString(refreshed.token_type) ?? tokenType ?? "Bearer";

  if (!nextAccessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new HttpError(502, "gcal_token_payload_invalid", "Google Calendar refresh payload was incomplete.");
  }

  await gcalConnectionRef(uid).set({
    accessToken: nextAccessToken,
    tokenType: nextTokenType,
    accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  } satisfies Partial<GcalConnectionDoc>, { merge: true });

  return { accessToken: nextAccessToken, calendarId };
};

const loadHomeSettings = async (): Promise<HomeSettings> => {
  const snapshot = await db.collection("settings").doc("home").get();
  if (!snapshot.exists) {
    throw new HttpError(
      400,
      "home_missing",
      "Home settings missing. Please configure settings/home with address, lat, lng."
    );
  }

  const data = snapshot.data() ?? {};
  const address = readString(data.address);
  const lat = typeof data.lat === "number" ? data.lat : null;
  const lng = typeof data.lng === "number" ? data.lng : null;

  if (!address || lat == null || lng == null) {
    throw new HttpError(
      400,
      "home_missing",
      "Home settings missing. Please configure settings/home with address, lat, lng."
    );
  }

  return { address, lat, lng };
};

const hasPriorityRanks = (stops: RouteStop[]): boolean => {
  return stops.some((stop) => stop.rank !== Number.MAX_SAFE_INTEGER);
};

const normalizeStops = (jobs: QuerySnapshot<DocumentData>): RouteStop[] => {
  const stops: RouteStop[] = [];

  jobs.forEach((doc) => {
    const data = doc.data();
    const address = readString(data.address) ?? "";
    const lat = typeof data.lat === "number" ? data.lat : null;
    const lng = typeof data.lng === "number" ? data.lng : null;

    if (lat == null || lng == null) {
      logger.warn("Job missing coordinates", { jobId: doc.id });
      return;
    }

    const rank = typeof data.priorityRank === "number" ? data.priorityRank : Number.MAX_SAFE_INTEGER;

    stops.push({
      jobId: doc.id,
      rank,
      address,
      lat,
      lng,
      customerName: readString(data.customerName),
      scheduledAt: readString(data.scheduledAt),
      status: readString(data.status),
    });
  });

  return stops.sort((a, b) => a.rank - b.rank);
};

const attachLegJobIds = (legs: RouteLegSummary[], stops: RouteStop[]): RouteLegSummary[] => {
  return legs.map((leg, index) => {
    const fromJobId = index === 0 ? null : (stops[index - 1]?.jobId ?? null);
    const toJobId = stops[index]?.jobId ?? null;
    return { ...leg, fromJobId, toJobId };
  });
};

const roundToTwo = (value: number): number => Number(value.toFixed(2));

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const radius = 6371000;
  const toRad = (v: number): number => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * radius * Math.asin(Math.sqrt(h));
};

const loadVehicleSettings = async (): Promise<{ mpg: number; fuelCostPerGallon: number; laborCostPerHour: number }> => {
  const snapshot = await db.collection("settings").doc("vehicle").get();
  const data = snapshot.data() ?? {};
  const mpg = typeof data.mpg === "number" ? data.mpg : 18;
  const fuelCostPerGallon = typeof data.fuelCostPerGallon === "number" ? data.fuelCostPerGallon : 3.75;
  const laborCostPerHour = typeof data.laborCostPerHour === "number" ? data.laborCostPerHour : 50;

  if (!snapshot.exists) {
    logger.warn("Vehicle settings missing; using defaults.");
  }

  return { mpg, fuelCostPerGallon, laborCostPerHour };
};

const computeRouteRevenue = async (stops: RouteStop[]): Promise<number> => {
  const jobIds = stops.map((stop) => stop.jobId).filter(Boolean);
  if (jobIds.length === 0) return 0;

  let total = 0;
  const chunks = chunkArray(jobIds, 10);

  for (const chunk of chunks) {
    const snapshot = await db.collection("estimates").where("jobId", "in", chunk).get();
    snapshot.forEach((doc) => {
      const amount = doc.data()?.amount;
      if (typeof amount === "number") {
        total += amount;
      }
    });
  }

  return total;
};

const computeRouteAnalytics = async (route: RouteDoc): Promise<Record<string, number>> => {
  const revenueTotal = await computeRouteRevenue(route.stops);
  const miles = typeof route.totals?.miles === "number" ? route.totals.miles : 0;
  const minutes = typeof route.totals?.minutes === "number" ? route.totals.minutes : 0;
  const hours = minutes > 0 ? minutes / 60 : 0;
  const stopCount = route.stopCount || route.stops.length;

  const revenuePerStop = stopCount > 0 ? revenueTotal / stopCount : 0;
  const revenuePerMile = miles > 0 ? revenueTotal / miles : 0;
  const revenuePerHour = hours > 0 ? revenueTotal / hours : 0;

  const vehicle = await loadVehicleSettings();
  const gallonsUsed = vehicle.mpg > 0 ? miles / vehicle.mpg : 0;
  const fuelCost = gallonsUsed * vehicle.fuelCostPerGallon;
  const laborDriveCost = hours * vehicle.laborCostPerHour;
  const routeCost = fuelCost + laborDriveCost;
  const profitEstimate = revenueTotal - routeCost;
  const efficiencyScore = clamp(
    vehicle.laborCostPerHour > 0 ? (revenuePerHour / vehicle.laborCostPerHour) * 100 : 0,
    0,
    200
  );

  return {
    revenueTotal: roundToTwo(revenueTotal),
    revenuePerStop: roundToTwo(revenuePerStop),
    revenuePerMile: roundToTwo(revenuePerMile),
    revenuePerHour: roundToTwo(revenuePerHour),
    fuelCost: roundToTwo(fuelCost),
    laborDriveCost: roundToTwo(laborDriveCost),
    routeCost: roundToTwo(routeCost),
    profitEstimate: roundToTwo(profitEstimate),
    efficiencyScore: roundToTwo(efficiencyScore),
  };
};

/* -------------------------------------------------------------------------- */
/* HEALTHCHECK */
/* -------------------------------------------------------------------------- */

export const healthcheck = onRequest((req, res) => {
  Promise.resolve()
    .then(async () => {
      const auth = await requireAuth(req);
      requireRole(auth, ["admin"]);
      await requireActiveLicense();

      res.status(200).json({
        status: "ok",
        service: "GA Gutter Guys Admin",
        timestamp: new Date().toISOString(),
      });
    })
    .catch((error) => {
      handleHttpError(res, error);
    });
});

export const vertexAIChat = onRequest(
  { secrets: [vertexApiKeySecret] },
  async (req, res) => {
    try {
      if (handlePreflight(req, res)) {
        return;
      }

      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
      }

      await requireAuthenticatedToken(req);
      await requireActiveLicense();

      setCorsHeaders(req, res);

      const body = (req.body ?? {}) as VertexChatBody;
      const explicitAddress = readString(body.address);
      const messageContent = body.messages
        ?.map((entry) => readString(entry.content))
        .find((entry) => Boolean(entry));

      const prompt = readString(messageContent);
      if (!explicitAddress && !prompt) {
        throw new HttpError(400, "invalid_argument", "address or messages[0].content is required.");
      }

      const addressMatch = prompt?.match(/address:\s*(.*)$/i);
      const addressFromPrompt = addressMatch?.[1]?.trim() ?? "";
      const address = explicitAddress ?? (addressFromPrompt || prompt || "");

      const result = await invokeVertexEstimate(address);

      res.status(200).json({
        status: "ok",
        text: result.text,
        result: result.raw,
      });
    } catch (error) {
      setCorsHeaders(req, res);
      handleHttpError(res, error);
    }
  }
);

export const qboAuthStart = onRequest(
  { secrets: [qboClientIdSecret, qboClientSecretSecret, qboRedirectUriSecret] },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
      }

      const auth = await requireAuth(req);
      requireRole(auth, ["admin"]);
      await requireActiveLicense();

      const origin = resolveOrigin(req);
      const body = req.body ?? {};
      const returnPathCandidate = readString(body.returnPath) ?? "/dashboard";
      const returnPath = returnPathCandidate.startsWith("/") ? returnPathCandidate : "/dashboard";
      const returnUrl = origin ? `${origin}${returnPath}` : null;

      const state = randomUUID();
      const now = Date.now();
      const stateDoc: QboAuthStateDoc = {
        uid: auth.uid,
        createdAtMs: now,
        expiresAtMs: now + 10 * 60 * 1000,
        used: false,
        returnUrl,
      };

      await qboAuthStateRef(state).set(stateDoc);

      res.status(200).json({
        status: "ok",
        authUrl: buildQboAuthUrl(state),
      });
    } catch (error) {
      handleHttpError(res, error);
    }
  })
);

export const qboAuthCallback = onRequest(
  { secrets: [qboClientIdSecret, qboClientSecretSecret, qboRedirectUriSecret] },
  async (req, res) => {
    try {
      if (req.method !== "GET") {
        throw new HttpError(405, "method_not_allowed", "Only GET allowed.");
      }

      const state = readString(req.query.state);
      const code = readString(req.query.code);
      const realmId = readString(req.query.realmId);
      const oauthError = readString(req.query.error);

      if (!state) {
        throw new HttpError(400, "invalid_argument", "Missing OAuth state.");
      }

      const stateSnapshot = await qboAuthStateRef(state).get();
      if (!stateSnapshot.exists) {
        throw new HttpError(400, "invalid_argument", "Invalid OAuth state.");
      }

      const stateData = stateSnapshot.data() as QboAuthStateDoc;
      if (stateData.used) {
        throw new HttpError(400, "invalid_argument", "OAuth state already used.");
      }
      if (Date.now() > stateData.expiresAtMs) {
        throw new HttpError(400, "invalid_argument", "OAuth state expired.");
      }

      await qboAuthStateRef(state).set({ used: true, usedAtMs: Date.now() }, { merge: true });

      if (oauthError) {
        const errorRedirect = stateData.returnUrl
          ? appendStatusToReturnUrl(stateData.returnUrl, "qbo", "error")
          : null;
        if (errorRedirect) {
          res.redirect(302, errorRedirect);
          return;
        }
        sendQboCallbackHtml(res, "QuickBooks Connection Failed", "Authorization was not completed.");
        return;
      }

      if (!code) {
        throw new HttpError(400, "invalid_argument", "Missing authorization code.");
      }

      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getQboRedirectUri(),
      });

      const clientId = getQboClientId();
      const clientSecret = getQboClientSecret();
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

      const tokenResponse = await fetch(qboTokenUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        const failureText = await tokenResponse.text().catch(() => "");
        throw new HttpError(
          502,
          "qbo_token_exchange_failed",
          `QuickBooks token exchange failed (${tokenResponse.status}). ${failureText}`
        );
      }

      const tokenPayload = await tokenResponse.json() as {
        token_type?: unknown;
        access_token?: unknown;
        refresh_token?: unknown;
        expires_in?: unknown;
        x_refresh_token_expires_in?: unknown;
        scope?: unknown;
      };

      const accessToken = readString(tokenPayload.access_token);
      const refreshToken = readString(tokenPayload.refresh_token);
      const tokenType = readString(tokenPayload.token_type);
      const accessExpiresSeconds = typeof tokenPayload.expires_in === "number" ? tokenPayload.expires_in : 0;
      const refreshExpiresSeconds = typeof tokenPayload.x_refresh_token_expires_in === "number"
        ? tokenPayload.x_refresh_token_expires_in
        : 0;
      const scopeValue = readString(tokenPayload.scope);
      const scope = scopeValue ? scopeValue.split(/\s+/).filter(Boolean) : [];

      if (!accessToken || !refreshToken || !tokenType) {
        throw new HttpError(502, "qbo_token_payload_invalid", "QuickBooks token payload was incomplete.");
      }

      const now = Date.now();
      const connectionDoc: QboConnectionDoc = {
        provider: "quickbooks",
        connected: true,
        realmId,
        tokenType,
        scope,
        accessToken,
        refreshToken,
        accessTokenExpiresAt: accessExpiresSeconds > 0
          ? new Date(now + accessExpiresSeconds * 1000).toISOString()
          : null,
        refreshTokenExpiresAt: refreshExpiresSeconds > 0
          ? new Date(now + refreshExpiresSeconds * 1000).toISOString()
          : null,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        connectedBy: stateData.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await qboConnectionRef().set(connectionDoc, { merge: true });

      const successRedirect = stateData.returnUrl
        ? appendStatusToReturnUrl(stateData.returnUrl, "qbo", "connected")
        : null;

      if (successRedirect) {
        res.redirect(302, successRedirect);
        return;
      }

      sendQboCallbackHtml(res, "QuickBooks Connected", "Connection completed successfully.");
    } catch (error) {
      logger.error("qboAuthCallback failed", { error });
      sendQboCallbackHtml(res, "QuickBooks Connection Error", "We could not complete the QuickBooks connection.");
    }
  }
);

export const qboStatus = onRequest(async (req, res) => {
  if (handlePreflight(req, res)) {
    return;
  }
  try {
    if (req.method !== "GET") {
      throw new HttpError(405, "method_not_allowed", "Only GET allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth, ["admin"]);
    await requireActiveLicense();

    const snapshot = await qboConnectionRef().get();
    if (!snapshot.exists) {
      res.status(200).json({
        status: "ok",
        connected: false,
        realmId: null,
        connectedAt: null,
        updatedAt: null,
      });
      return;
    }

    const data = snapshot.data() as Partial<QboConnectionDoc>;
    res.status(200).json({
      status: "ok",
      connected: data.connected === true,
      realmId: readString(data.realmId),
      connectedAt: readIsoDate(data.connectedAt),
      updatedAt: readIsoDate(data.updatedAt),
    });
  } catch (error) {
    handleHttpError(res, error);
  }
});

export const qboDisconnect = onRequest(async (req, res) => {
  if (handlePreflight(req, res)) {
    return;
  }
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth, ["admin"]);
    await requireActiveLicense();

    await qboConnectionRef().set({
      provider: "quickbooks",
      connected: false,
      realmId: null,
      tokenType: null,
      scope: [],
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      disconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
      disconnectedBy: auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    } satisfies QboConnectionDoc, { merge: true });

    res.status(200).json({ status: "ok", connected: false });
  } catch (error) {
    handleHttpError(res, error);
  }
});

export const gcalAuthStart = onRequest(
  { secrets: [gcalClientIdSecret, gcalClientSecretSecret, gcalRedirectUriSecret] },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
      }

      const auth = await requireAuth(req);
      requireRole(auth, ["staff"]);
      await requireActiveLicense();

      const origin = resolveOrigin(req);
      const body = (req.body ?? {}) as { returnPath?: unknown };
      const returnPathCandidate = readString(body.returnPath) ?? "/web/calendar";
      const returnPath = returnPathCandidate.startsWith("/") ? returnPathCandidate : "/web/calendar";
      const returnUrl = origin ? `${origin}${returnPath}` : null;

      const state = randomUUID();
      const now = Date.now();
      const stateDoc: GcalAuthStateDoc = {
        uid: auth.uid,
        createdAtMs: now,
        expiresAtMs: now + 10 * 60 * 1000,
        used: false,
        returnUrl,
      };

      await gcalAuthStateRef(state).set(stateDoc);

      res.status(200).json({
        status: "ok",
        authUrl: buildGcalAuthUrl(state),
      });
    } catch (error) {
      handleHttpError(res, error);
    }
  })
);

export const gcalAuthCallback = onRequest(
  { secrets: [gcalClientIdSecret, gcalClientSecretSecret, gcalRedirectUriSecret] },
  async (req, res) => {
    try {
      if (req.method !== "GET") {
        throw new HttpError(405, "method_not_allowed", "Only GET allowed.");
      }

      const state = readString(req.query.state);
      const code = readString(req.query.code);
      const oauthError = readString(req.query.error);

      if (!state) {
        throw new HttpError(400, "invalid_argument", "Missing OAuth state.");
      }

      const stateSnapshot = await gcalAuthStateRef(state).get();
      if (!stateSnapshot.exists) {
        throw new HttpError(400, "invalid_argument", "Invalid OAuth state.");
      }

      const stateData = stateSnapshot.data() as GcalAuthStateDoc;
      if (stateData.used) {
        throw new HttpError(400, "invalid_argument", "OAuth state already used.");
      }
      if (Date.now() > stateData.expiresAtMs) {
        throw new HttpError(400, "invalid_argument", "OAuth state expired.");
      }

      await gcalAuthStateRef(state).set({ used: true, usedAtMs: Date.now() }, { merge: true });

      if (oauthError) {
        const errorRedirect = stateData.returnUrl
          ? appendStatusToReturnUrl(stateData.returnUrl, "gcal", "error")
          : null;
        if (errorRedirect) {
          res.redirect(302, errorRedirect);
          return;
        }
        sendQboCallbackHtml(res, "Google Calendar Connection Failed", "Authorization was not completed.");
        return;
      }

      if (!code) {
        throw new HttpError(400, "invalid_argument", "Missing authorization code.");
      }

      const tokenParams = new URLSearchParams({
        code,
        client_id: getGcalClientId(),
        client_secret: getGcalClientSecret(),
        redirect_uri: getGcalRedirectUri(),
        grant_type: "authorization_code",
      });

      const tokenResponse = await fetch(gcalTokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
      });

      const tokenPayload = await tokenResponse.json().catch(() => null) as {
        token_type?: unknown;
        access_token?: unknown;
        refresh_token?: unknown;
        expires_in?: unknown;
        scope?: unknown;
      } | null;

      if (!tokenResponse.ok || !tokenPayload) {
        throw new HttpError(502, "gcal_token_exchange_failed", "Google Calendar token exchange failed.");
      }

      const accessToken = readString(tokenPayload.access_token);
      const refreshToken = readString(tokenPayload.refresh_token);
      const tokenType = readString(tokenPayload.token_type);
      const expiresIn = typeof tokenPayload.expires_in === "number"
        ? tokenPayload.expires_in
        : Number(tokenPayload.expires_in ?? 0);
      const scopeValue = readString(tokenPayload.scope);
      const scope = scopeValue ? scopeValue.split(/\s+/).filter(Boolean) : [gcalScope];

      if (!accessToken || !refreshToken || !tokenType || !Number.isFinite(expiresIn) || expiresIn <= 0) {
        throw new HttpError(502, "gcal_token_payload_invalid", "Google Calendar token payload was incomplete.");
      }

      const now = Date.now();
      const connectionDoc: GcalConnectionDoc = {
        provider: "google_calendar",
        connected: true,
        calendarId: "primary",
        tokenType,
        scope,
        accessToken,
        refreshToken,
        accessTokenExpiresAt: new Date(now + expiresIn * 1000).toISOString(),
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        connectedBy: stateData.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await gcalConnectionRef(stateData.uid).set(connectionDoc, { merge: true });

      const successRedirect = stateData.returnUrl
        ? appendStatusToReturnUrl(stateData.returnUrl, "gcal", "connected")
        : null;

      if (successRedirect) {
        res.redirect(302, successRedirect);
        return;
      }

      sendQboCallbackHtml(res, "Google Calendar Connected", "Connection completed successfully.");
    } catch (error) {
      logger.error("gcalAuthCallback failed", { error });
      sendQboCallbackHtml(res, "Google Calendar Connection Error", "We could not complete the Google Calendar connection.");
    }
  }
);

export const gcalStatus = onRequest(async (req, res) => {
  if (handlePreflight(req, res)) {
    return;
  }
  try {
    if (req.method !== "GET") {
      throw new HttpError(405, "method_not_allowed", "Only GET allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth, ["staff"]);
    await requireActiveLicense();

    const snapshot = await gcalConnectionRef(auth.uid).get();
    if (!snapshot.exists) {
      res.status(200).json({
        status: "ok",
        connected: false,
        calendarId: null,
        connectedAt: null,
        updatedAt: null,
      });
      return;
    }

    const data = snapshot.data() as Partial<GcalConnectionDoc>;
    res.status(200).json({
      status: "ok",
      connected: data.connected === true,
      calendarId: readString(data.calendarId),
      connectedAt: readIsoDate(data.connectedAt),
      updatedAt: readIsoDate(data.updatedAt),
    });
  } catch (error) {
    handleHttpError(res, error);
  }
});

export const gcalListCalendars = onRequest(
  { secrets: [gcalClientIdSecret, gcalClientSecretSecret, gcalRedirectUriSecret] },
  withCors(async (req, res) => {
    try {
      if (req.method !== "GET") {
        throw new HttpError(405, "method_not_allowed", "Only GET allowed.");
      }

      const auth = await requireAuth(req);
      requireRole(auth, ["staff"]);
      await requireActiveLicense();

      const { accessToken, calendarId } = await getValidGcalAccess(auth.uid);
      const payload = await callGoogleCalendarApi({
        accessToken,
        method: "GET",
        path: "/users/me/calendarList",
        query: {
          minAccessRole: "writer",
          showDeleted: "false",
          showHidden: "false",
          maxResults: "250",
        },
      }) as {
        items?: Array<{ id?: unknown; summary?: unknown; primary?: unknown; accessRole?: unknown }>;
      };

      const calendars = (Array.isArray(payload.items) ? payload.items : [])
        .map((item) => {
          const id = readString(item.id);
          if (!id) return null;
          return {
            id,
            summary: readString(item.summary) ?? id,
            primary: item.primary === true,
            accessRole: readString(item.accessRole) ?? null,
          };
        })
        .filter((item): item is { id: string; summary: string; primary: boolean; accessRole: string | null } => Boolean(item));

      res.status(200).json({
        status: "ok",
        selectedCalendarId: calendarId,
        calendars,
      });
    } catch (error) {
      handleHttpError(res, error);
    }
  })
);

export const gcalSetCalendar = onRequest(
  { secrets: [gcalClientIdSecret, gcalClientSecretSecret, gcalRedirectUriSecret] },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
      }

      const auth = await requireAuth(req);
      requireRole(auth, ["staff"]);
      await requireActiveLicense();

      const body = (req.body ?? {}) as { calendarId?: unknown };
      const calendarId = readString(body.calendarId);
      if (!calendarId) {
        throw new HttpError(400, "invalid_argument", "calendarId is required.");
      }

      const { accessToken } = await getValidGcalAccess(auth.uid);
      await callGoogleCalendarApi({
        accessToken,
        method: "GET",
        path: `/users/me/calendarList/${encodeURIComponent(calendarId)}`,
      });

      await gcalConnectionRef(auth.uid).set({
        calendarId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      } satisfies Partial<GcalConnectionDoc>, { merge: true });

      res.status(200).json({ status: "ok", calendarId });
    } catch (error) {
      handleHttpError(res, error);
    }
  })
);

export const gcalDisconnect = onRequest(async (req, res) => {
  if (handlePreflight(req, res)) {
    return;
  }
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth, ["staff"]);
    await requireActiveLicense();

    await gcalConnectionRef(auth.uid).set({
      provider: "google_calendar",
      connected: false,
      calendarId: "primary",
      tokenType: null,
      scope: [],
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      disconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
      disconnectedBy: auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    } satisfies GcalConnectionDoc, { merge: true });

    res.status(200).json({ status: "ok", connected: false });
  } catch (error) {
    handleHttpError(res, error);
  }
});

export const gcalSyncEvent = onRequest(
  { secrets: [gcalClientIdSecret, gcalClientSecretSecret, gcalRedirectUriSecret] },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
      }

      const auth = await requireAuth(req);
      requireRole(auth, ["staff"]);
      await requireActiveLicense();

      const body = (req.body ?? {}) as {
        id?: unknown;
        title?: unknown;
        start?: unknown;
        end?: unknown;
        status?: unknown;
        crewAssigned?: unknown;
        jobId?: unknown;
        googleEventId?: unknown;
      };

      const eventId = readString(body.id);
      const title = readString(body.title) ?? "Untitled Event";
      const startIso = readString(body.start);
      const endIso = readString(body.end);
      const googleEventId = readString(body.googleEventId);
      const status = readString(body.status);
      const crewAssigned = readString(body.crewAssigned);
      const jobId = readString(body.jobId);

      if (!eventId || !startIso || !endIso) {
        throw new HttpError(400, "invalid_argument", "id, start, and end are required.");
      }

      const startDate = new Date(startIso);
      const endDate = new Date(endIso);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        throw new HttpError(400, "invalid_argument", "Invalid start/end datetime range.");
      }

      const { accessToken, calendarId } = await getValidGcalAccess(auth.uid);
      const descriptionLines = [
        `ERP Event ID: ${eventId}`,
        status ? `Status: ${status}` : null,
        crewAssigned ? `Crew: ${crewAssigned}` : null,
        jobId ? `Job ID: ${jobId}` : null,
      ].filter(Boolean);

      const payload = {
        summary: title,
        description: descriptionLines.join("\n"),
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        extendedProperties: {
          private: {
            erpEventId: eventId,
            erpJobId: jobId ?? "",
            erpStatus: status ?? "",
          },
        },
      };

      const result = await callGoogleCalendarApi({
        accessToken,
        method: googleEventId ? "PATCH" : "POST",
        path: googleEventId
          ? `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`
          : `/calendars/${encodeURIComponent(calendarId)}/events`,
        body: payload,
      }) as { id?: unknown };

      const nextGoogleEventId = readString(result.id);
      if (!nextGoogleEventId) {
        throw new HttpError(502, "gcal_sync_failed", "Google Calendar event sync returned no event ID.");
      }

      await db.collection("calendarEvents").doc(eventId).set({
        googleEventId: nextGoogleEventId,
        source: "crm",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      res.status(200).json({ status: "ok", synced: true, googleEventId: nextGoogleEventId });
    } catch (error) {
      handleHttpError(res, error);
    }
  })
);

export const gcalSyncToFirestore = onRequest(
  { secrets: [gcalClientIdSecret, gcalClientSecretSecret, gcalRedirectUriSecret] },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
      }

      const auth = await requireAuth(req);
      requireRole(auth, ["staff"]);
      await requireActiveLicense();

      const body = (req.body ?? {}) as { daysBack?: unknown; daysAhead?: unknown };
      const daysBack = typeof body.daysBack === "number" ? body.daysBack : 7;
      const daysAhead = typeof body.daysAhead === "number" ? body.daysAhead : 30;

      const now = Date.now();
      const timeMin = new Date(now - daysBack * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(now + daysAhead * 24 * 60 * 60 * 1000).toISOString();

      const { accessToken, calendarId } = await getValidGcalAccess(auth.uid);
      const response = await callGoogleCalendarApi({
        accessToken,
        method: "GET",
        path: `/calendars/${encodeURIComponent(calendarId)}/events`,
        query: {
          singleEvents: "true",
          orderBy: "startTime",
          showDeleted: "false",
          timeMin,
          timeMax,
          maxResults: "250",
        },
      }) as {
        items?: Array<{
          id?: unknown;
          summary?: unknown;
          start?: { dateTime?: unknown; date?: unknown };
          end?: { dateTime?: unknown; date?: unknown };
        }>;
      };

      const items = Array.isArray(response.items) ? response.items : [];
      let importedCount = 0;

      for (const item of items) {
        const gId = readString(item.id);
        if (!gId) continue;

        const startRaw = readString(item.start?.dateTime) ?? readString(item.start?.date);
        const endRaw = readString(item.end?.dateTime) ?? readString(item.end?.date);
        if (!startRaw || !endRaw) continue;

        const start = new Date(startRaw);
        const end = new Date(endRaw);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;

        await db.collection("calendarEvents").doc(`gcal_${gId}`).set({
          jobId: null,
          title: readString(item.summary) ?? "Google Calendar Event",
          start: admin.firestore.Timestamp.fromDate(start),
          end: admin.firestore.Timestamp.fromDate(end),
          crewAssigned: "",
          status: "meeting",
          googleEventId: gId,
          source: "google",
          createdBy: auth.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        importedCount += 1;
      }

      res.status(200).json({ status: "ok", synced: true, importedCount });
    } catch (error) {
      handleHttpError(res, error);
    }
  })
);

export const bootstrapCoreDocs = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth, ["admin"]);

    const licenseRef = db.collection("license").doc("current");
    const licenseSnapshot = await licenseRef.get();
    let licenseExists = licenseSnapshot.exists;

    if (!licenseExists) {
      await licenseRef.set({
        active: true,
        plan: "pro",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      licenseExists = true;
    }

    const homeSnapshot = await db.collection("settings").doc("home").get();
    const homeConfigured = homeSnapshot.exists
      && typeof homeSnapshot.data()?.address === "string"
      && typeof homeSnapshot.data()?.lat === "number"
      && typeof homeSnapshot.data()?.lng === "number";

    if (!homeConfigured) {
      throw new HttpError(
        400,
        "home_missing",
        "Home settings missing. Please configure settings/home with address, lat, lng."
      );
    }

    res.status(200).json({ status: "ok", licenseExists, homeConfigured });
  } catch (error) {
    handleHttpError(res, error);
  }
});

export const routeSystemHealth = onRequest(
  { secrets: [mapsApiKey] },
  async (req, res) => {
    try {
      const auth = await requireAuth(req);
      requireRole(auth, ["admin"]);
      await requireActiveLicense();

      await loadHomeSettings();
      getMapsApiKey();

      res.status(200).json({
        status: "ok",
        license: "active",
        homeConfigured: true,
        routesApiConfigured: true,
      });
    } catch (error) {
      handleHttpError(res, error);
    }
  }
);

export const testRouteOptimization = onRequest(
  { secrets: [mapsApiKey] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
      }

      const auth = await requireAuth(req);
      requireRole(auth, ["admin"]);
      await requireActiveLicense();

      const body = req.body ?? {};
      const dateId = parseDateId(body.date);

      const home = await loadHomeSettings();
      const jobs = await db.collection("jobs").where("date", "==", dateId).get();
      const stops = normalizeStops(jobs);

      if (stops.length === 0) {
        throw new HttpError(400, "invalid_argument", "No stops found for this date.");
      }

      const respectRank = hasPriorityRanks(stops);
      const request = buildOptimizeRouteRequest(
        { lat: home.lat, lng: home.lng },
        stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
        true,
        respectRank
      );

      const response = await callRoutesComputeRoutes(request, getMapsApiKey());
      const normalized = normalizeRouteResponse(response);

      res.status(200).json({
        optimized: !respectRank,
        stopCount: stops.length,
        totals: normalized.totals,
        encodedPolylineLength: normalized.encodedPolyline.length,
      });
    } catch (error) {
      handleHttpError(res, error);
    }
  }
);

export const getDailyRoute = onRequest(async (req, res) => {
  try {
    const auth = await requireAuth(req);
    requireRole(auth, ["admin"]);
    await requireActiveLicense();

    const dateId = parseDateId(req.query.date);
    const snapshot = await db.collection("routes").doc(dateId).get();
    if (!snapshot.exists) {
      throw new HttpError(404, "not_found", "Route not found.");
    }

    const route = snapshot.data() as RouteDoc;
    const analytics = await computeRouteAnalytics(route);

    res.status(200).json({ status: "ok", route: { ...route, ...analytics } });
  } catch (error) {
    handleHttpError(res, error);
  }
});

export const getOrCreateDailyRoute = onRequest(async (req, res) => {
  try {
    const auth = await requireAuth(req);
    requireRole(auth, ["admin"]);
    await requireActiveLicense();

    const body = req.body ?? {};
    const dateId = parseDateId(body.date ?? req.query.date);
    const existing = await db.collection("routes").doc(dateId).get();
    if (existing.exists) {
      const route = existing.data() as RouteDoc;
      const analytics = await computeRouteAnalytics(route);
      res.status(200).json({ status: "ok", route: { ...route, ...analytics } });
      return;
    }

    const home = await loadHomeSettings();
    const jobs = await db.collection("jobs").where("date", "==", dateId).get();
    const stops = normalizeStops(jobs);

    const route: RouteDoc = {
      date: dateId,
      home,
      stopCount: stops.length,
      stops,
      optimized: false,
      totals: { meters: 0, seconds: 0, miles: 0, minutes: 0 },
      polyline: { encoded: "", hasEncoded: false },
      legs: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("routes").doc(dateId).set(route, { merge: true });
    const analytics = await computeRouteAnalytics(route);
    res.status(200).json({ status: "ok", route: { ...route, ...analytics } });
  } catch (error) {
    handleHttpError(res, error);
  }
});

export const reorderStops = onRequest(
  { secrets: [mapsApiKey] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
      }

      const auth = await requireAuth(req);
      requireRole(auth, ["admin"]);
      await requireActiveLicense();

      const body = req.body ?? {};
      const dateId = parseDateId(body.date);
      const orderedJobIds = Array.isArray(body.orderedJobIds) ? body.orderedJobIds : [];
      if (orderedJobIds.length === 0) {
        throw new HttpError(400, "invalid_argument", "orderedJobIds required.");
      }

      const routeDoc = await db.collection("routes").doc(dateId).get();
      if (!routeDoc.exists) {
        throw new HttpError(404, "not_found", "Route not found.");
      }

      const stops = (routeDoc.data()?.stops as RouteStop[]) ?? [];
      const stopMap = new Map(stops.map((stop) => [stop.jobId, stop]));
      const reordered: RouteStop[] = [];

      orderedJobIds.forEach((jobId: string, index: number) => {
        const stop = stopMap.get(String(jobId));
        if (stop) {
          reordered.push({ ...stop, rank: index + 1 });
        }
      });

      if (reordered.length === 0) {
        throw new HttpError(400, "invalid_argument", "No matching stops to reorder.");
      }

      const home = await loadHomeSettings();
      const request = buildOptimizeRouteRequest(
        { lat: home.lat, lng: home.lng },
        reordered.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
        true,
        true
      );

      const response = await callRoutesComputeRoutes(request, getMapsApiKey());
      const normalized = normalizeRouteResponse(response);
      const legs = attachLegJobIds(normalized.legs, reordered);

      const route: RouteDoc = {
        date: dateId,
        home,
        stopCount: reordered.length,
        stops: reordered,
        optimized: false,
        totals: normalized.totals,
        polyline: {
          encoded: normalized.encodedPolyline,
          hasEncoded: !!normalized.encodedPolyline,
        },
        legs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("routes").doc(dateId).set(route, { merge: true });
      const analytics = await computeRouteAnalytics(route);
      res.status(200).json({ status: "ok", route: { ...route, ...analytics } });
    } catch (error) {
      handleHttpError(res, error);
    }
  }
);

export const updateJobPriority = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth, ["admin"]);
    await requireActiveLicense();

    const body = req.body ?? {};
    const jobId = readString(body.jobId);
    const priorityRank = typeof body.priorityRank === "number" ? body.priorityRank : null;

    if (!jobId || priorityRank == null) {
      throw new HttpError(400, "invalid_argument", "jobId and priorityRank required.");
    }

    await db.collection("jobs").doc(jobId).set({ priorityRank }, { merge: true });
    res.status(200).json({ status: "ok", jobId, priorityRank });
  } catch (error) {
    handleHttpError(res, error);
  }
});

export const aiPrioritizeRoute = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth, ["admin"]);
    await requireActiveLicense();

    const body = req.body ?? {};
    const dateId = parseDateId(body.date);

    const home = await loadHomeSettings();
    const jobsSnapshot = await db.collection("jobs").where("date", "==", dateId).get();
    const jobs = normalizeStops(jobsSnapshot);

    if (jobs.length === 0) {
      throw new HttpError(400, "invalid_argument", "No stops found for this date.");
    }

    const revenueByJob = new Map<string, number>();
    const jobIds = jobs.map((job) => job.jobId);
    const chunks = chunkArray(jobIds, 10);
    for (const chunk of chunks) {
      const estimates = await db.collection("estimates").where("jobId", "in", chunk).get();
      estimates.forEach((doc) => {
        const data = doc.data();
        const jobId = readString(data.jobId);
        const amount = typeof data.amount === "number" ? data.amount : 0;
        if (jobId) {
          revenueByJob.set(jobId, (revenueByJob.get(jobId) ?? 0) + amount);
        }
      });
    }

    const distances = jobs.map((job) => haversineMeters(home, { lat: job.lat, lng: job.lng }));
    const maxRevenue = Math.max(1, ...jobs.map((job) => revenueByJob.get(job.jobId) ?? 0));
    const maxDistance = Math.max(1, ...distances);

    const now = Date.now();
    const weights = { revenue: 0.5, distance: 0.3, urgency: 0.2 };

    const scored = jobs.map((job, index) => {
      const revenue = revenueByJob.get(job.jobId) ?? 0;
      const revenueFactor = revenue / maxRevenue;

      const distance = distances[index];
      const distanceFactor = 1 - (distance / maxDistance);

      let timeFactor = 0.5;
      if (job.scheduledAt) {
        const scheduled = Date.parse(job.scheduledAt);
        if (!Number.isNaN(scheduled)) {
          const hoursUntil = (scheduled - now) / (1000 * 60 * 60);
          timeFactor = clamp(1 - (hoursUntil / 24), 0, 1);
        }
      }

      const statusBoost = job.status && job.status.toLowerCase().includes("urgent") ? 0.15 : 0;

      const score = clamp(
        (weights.revenue * revenueFactor)
        + (weights.distance * distanceFactor)
        + (weights.urgency * timeFactor)
        + statusBoost,
        0,
        1.0
      ) * 100;

      return { jobId: job.jobId, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const updates = scored.map((item, index) => {
      const priorityRank = clamp(index + 1, 1, 10);
      return { ...item, priorityRank };
    });

    const batch = db.batch();
    updates.forEach((item) => {
      batch.set(db.collection("jobs").doc(item.jobId), { priorityRank: item.priorityRank }, { merge: true });
    });
    await batch.commit();

    res.status(200).json({ status: "ok", ranked: updates });
  } catch (error) {
    handleHttpError(res, error);
  }
});

/* -------------------------------------------------------------------------- */
/* ROUTE OPTIMIZATION */
/* -------------------------------------------------------------------------- */

export const optimizeDailyRoute = onRequest(
  { secrets: [mapsApiKey] },
  async (req, res) => {
    try {
      if (req.method !== "POST")
        throw new HttpError(405, "method_not_allowed", "Only POST allowed.");

      const auth = await requireAuth(req);
      requireRole(auth, ["admin"]);
      await requireActiveLicense();

      const body = req.body ?? {};
      const dateId = parseDateId(body.date);
      const mode = readString(body.mode) ?? "optimizeOrder";

      const home = await loadHomeSettings();

      const routeDoc = await db.collection("routes").doc(dateId).get();
      let stops: RouteStop[] = routeDoc.exists ? (routeDoc.data()?.stops as RouteStop[]) ?? [] : [];

      if (stops.length === 0) {
        const jobs = await db.collection("jobs").where("date", "==", dateId).get();
        stops = normalizeStops(jobs);
      }

      if (stops.length === 0) {
        throw new HttpError(400, "invalid_argument", "No stops found for this date.");
      }

      const respectRank = mode === "respectRank" || hasPriorityRanks(stops);
      logger.info("Optimizing route", { dateId, stopCount: stops.length, respectRank });

      const request = buildOptimizeRouteRequest(
        { lat: home.lat, lng: home.lng },
        stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
        true,
        respectRank
      );

      const response = await callRoutesComputeRoutes(request, getMapsApiKey());
      const normalized = normalizeRouteResponse(response);
      const orderedStops = !respectRank && normalized.optimizedOrder
        ? normalized.optimizedOrder.map((index) => stops[index]).filter(Boolean)
        : stops;

      const legs = attachLegJobIds(normalized.legs, orderedStops);
      const route: RouteDoc = {
        date: dateId,
        home,
        stopCount: orderedStops.length,
        stops: orderedStops,
        optimized: !respectRank,
        totals: normalized.totals,
        polyline: {
          encoded: normalized.encodedPolyline,
          hasEncoded: !!normalized.encodedPolyline,
        },
        legs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("routes").doc(dateId).set(route, { merge: true });

      res.status(200).json({ status: "ok", route });
    } catch (error) {
      handleHttpError(res, error);
    }
  }
);

/* -------------------------------------------------------------------------- */
/* DAILY SCHEDULED BUILD */
/* -------------------------------------------------------------------------- */

export const buildTodayRoute = onSchedule(
  { schedule: "0 5 * * *", timeZone: "America/New_York", secrets: [mapsApiKey] },
  async () => {
    const today = new Date().toISOString().split("T")[0];

    try {
      await requireActiveLicense();
      const home = await loadHomeSettings();

      const jobs = await db.collection("jobs")
        .where("date", "==", today)
        .get();

      const stops = normalizeStops(jobs);

      if (stops.length === 0) {
        logger.info("No stops for today.");
        return;
      }

      const respectRank = hasPriorityRanks(stops);
      const request = buildOptimizeRouteRequest(
        { lat: home.lat, lng: home.lng },
        stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
        true,
        respectRank
      );

      const response = await callRoutesComputeRoutes(request, getMapsApiKey());
      const normalized = normalizeRouteResponse(response);
      const orderedStops = !respectRank && normalized.optimizedOrder
        ? normalized.optimizedOrder.map((index) => stops[index]).filter(Boolean)
        : stops;
      const legs = attachLegJobIds(normalized.legs, orderedStops);

      const route: RouteDoc = {
        date: today,
        home,
        stopCount: orderedStops.length,
        stops: orderedStops,
        optimized: !respectRank,
        totals: normalized.totals,
        polyline: {
          encoded: normalized.encodedPolyline,
          hasEncoded: !!normalized.encodedPolyline,
        },
        legs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("routes").doc(today).set(route, { merge: true });

      logger.info("Daily route built successfully.");
    } catch (error) {
      logger.error("buildTodayRoute failed", { error });
    }
  }
);

export { onLeadCreated, onEstimateApproved, followUpReminderRunner } from "./leads";
export { qbSyncCustomer, qbCreateInvoice, qbWebhook, qbSyncNightly } from "./quickbooks";