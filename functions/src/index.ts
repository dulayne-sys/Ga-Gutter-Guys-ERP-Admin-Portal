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

const getMapsApiKey = (): string => {
  const key = mapsApiKey.value();
  if (!key) {
    throw new HttpError(500, "missing_api_key", "Routes API key missing.");
  }
  return key;
};

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

  const roleValue = readString(decoded.role);
  if (!roleValue || !isRole(roleValue))
    throw new HttpError(403, "forbidden", "User role missing or invalid.");

  return { uid: decoded.uid, role: roleValue, token: decoded };
};

const requireRole = (auth: AuthContext, allowed: ReadonlyArray<Role>): void => {
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