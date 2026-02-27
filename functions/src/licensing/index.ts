import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Role = "admin" | "staff" | "viewer";

interface LicenseDoc {
  active: boolean;
  plan: string;
  maxUsers: number;
  expiresAt: string | null;
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
  updatedAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
}

interface LicenseStatus {
  active: boolean;
  plan: string;
  maxUsers: number;
  expiresAt: string | null;
  expired: boolean;
  userCount: number;
  withinUserLimit: boolean;
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
/* LICENSE CORE LOGIC                                                         */
/* -------------------------------------------------------------------------- */

const LICENSE_DOC_PATH = "license/current";

/**
 * Loads license state from Firestore and checks expiry + user count.
 */
const loadLicenseStatus = async (): Promise<LicenseStatus> => {
  const snapshot = await db.doc(LICENSE_DOC_PATH).get();
  if (!snapshot.exists) {
    return {
      active: false,
      plan: "none",
      maxUsers: 0,
      expiresAt: null,
      expired: false,
      userCount: 0,
      withinUserLimit: false,
    };
  }

  const data = snapshot.data() ?? {};
  const active = data.active === true;
  const plan = readString(data.plan) ?? "free";
  const maxUsers = typeof data.maxUsers === "number" ? data.maxUsers : 50;
  const expiresAt = readString(data.expiresAt);

  const expired = expiresAt ? Date.parse(expiresAt) < Date.now() : false;

  const userCount = (await db.collection("users").where("active", "!=", false).count().get()).data().count;

  return {
    active: active && !expired,
    plan,
    maxUsers,
    expiresAt,
    expired,
    userCount,
    withinUserLimit: userCount <= maxUsers,
  };
};

/**
 * Middleware helper: throws HttpError if license is inactive or expired.
 * Import this in other modules to gate restricted endpoints.
 */
export const enforceLicense = async (): Promise<LicenseStatus> => {
  const status = await loadLicenseStatus();
  if (!status.active) {
    throw new HttpError(
      403,
      "license_inactive",
      status.expired
        ? "License has expired. Contact support to renew."
        : "No active license. Contact support to activate.",
    );
  }
  return status;
};

/* -------------------------------------------------------------------------- */
/* HTTP ENDPOINTS                                                             */
/* -------------------------------------------------------------------------- */

/**
 * GET — Returns current license status (admin only).
 */
export const licenseStatus = onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;
  try {
    if (req.method !== "GET") {
      throw new HttpError(405, "method_not_allowed", "Only GET allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth.role, ["admin"]);

    const status = await loadLicenseStatus();
    res.status(200).json({ status: "ok", license: status });
  } catch (error) {
    handleHttpError(res, error);
  }
});

/**
 * POST — Activates or updates license (admin only).
 * Body: { plan?: string, maxUsers?: number, expiresAt?: string | null }
 */
export const licenseActivate = onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth.role, ["admin"]);

    const body = (req.body ?? {}) as {
      plan?: unknown;
      maxUsers?: unknown;
      expiresAt?: unknown;
    };

    const plan = readString(body.plan) ?? "pro";
    const maxUsers = typeof body.maxUsers === "number" && body.maxUsers > 0
      ? body.maxUsers
      : 50;
    const expiresAt = readString(body.expiresAt);

    const licenseDoc: LicenseDoc = {
      active: true,
      plan,
      maxUsers,
      expiresAt: expiresAt ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const existing = await db.doc(LICENSE_DOC_PATH).get();
    if (existing.exists) {
      await db.doc(LICENSE_DOC_PATH).set({
        active: licenseDoc.active,
        plan: licenseDoc.plan,
        maxUsers: licenseDoc.maxUsers,
        expiresAt: licenseDoc.expiresAt,
        updatedAt: licenseDoc.updatedAt,
      }, { merge: true });
    } else {
      await db.doc(LICENSE_DOC_PATH).set(licenseDoc);
    }

    logger.info("License activated", { plan, maxUsers, activatedBy: auth.uid });

    const status = await loadLicenseStatus();
    res.status(200).json({ status: "ok", license: status });
  } catch (error) {
    handleHttpError(res, error);
  }
});

/**
 * POST — Deactivates license (admin only).
 */
export const licenseDeactivate = onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Only POST allowed.");
    }

    const auth = await requireAuth(req);
    requireRole(auth.role, ["admin"]);

    await db.doc(LICENSE_DOC_PATH).set(
      {
        active: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    logger.info("License deactivated", { deactivatedBy: auth.uid });

    res.status(200).json({ status: "ok", active: false });
  } catch (error) {
    handleHttpError(res, error);
  }
});
