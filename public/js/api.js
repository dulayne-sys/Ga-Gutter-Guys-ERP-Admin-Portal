import { getIdToken } from "./authUi.js";
import { functions } from "./firebaseClient.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const BASE_URL = "https://us-east1-ga-gutter-guys-admin.cloudfunctions.net";

const buildUrl = (endpoint, query) => {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value != null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const callHttpFunction = async (endpoint, payload, options = {}) => {
  const token = await getIdToken();
  if (!token) {
    const error = new Error("Authentication required.");
    error.code = "unauthenticated";
    throw error;
  }

  const method = options.method || "POST";
  const url = buildUrl(endpoint, options.query);
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const fetchOptions = {
    method,
    headers,
  };

  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(payload ?? {});
  }

  const response = await fetch(url, fetchOptions);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message = data && typeof data === "object" && data.error
      ? data.error
      : `Request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

const callCallableFunction = async (name, payload) => {
  if (!functions) {
    throw new Error("Cloud Functions SDK is not available.");
  }

  const callable = httpsCallable(functions, name);
  const response = await callable(payload ?? {});
  return response.data;
};

const callFunction = async (name, payload, options = {}) => {
  try {
    return await callCallableFunction(name, payload);
  } catch (error) {
    const message = error && error.message ? String(error.message) : "";
    const isCallableMissing = message.includes("not-found") || message.includes("NOT_FOUND") || message.includes("unimplemented");
    if (isCallableMissing || options.forceHttp) {
      return callHttpFunction(name, payload, options);
    }

    throw error;
  }
};

export const apiCreateEstimate = (payload) => {
  return callFunction("createEstimate", payload);
};

export const apiGetEstimates = (jobId) => {
  return callFunction("getEstimates", { jobId }, { method: "GET", query: { jobId }, forceHttp: true });
};

export const apiGetDashboardKPIs = () => {
  return callFunction("getDashboardKPIs", null, { method: "GET", forceHttp: true });
};

export const apiGetDailyRoute = (date) => {
  return callFunction("getDailyRoute", { date }, { method: "GET", query: { date }, forceHttp: true });
};

export const apiGetOrCreateDailyRoute = (date) => {
  return callFunction("getOrCreateDailyRoute", { date });
};

export const apiOptimizeDailyRoute = (payload) => {
  return callFunction("optimizeDailyRoute", payload);
};

export const apiReorderStops = (payload) => {
  return callFunction("reorderStops", payload);
};

export const apiAiEstimate = (payload) => {
  return callFunction("aiEstimate", payload);
};

export const apiUpdateJobPriority = (payload) => {
  return callFunction("updateJobPriority", payload);
};

export const apiAiPrioritizeRoute = (payload) => {
  return callFunction("aiPrioritizeRoute", payload);
};
