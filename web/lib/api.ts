import { FUNCTIONS_BASE_URL } from "./config";
import { getToken } from "./authGate";

export type ApiError = Error & { status?: number; payload?: unknown };

const normalizeFunctionsBaseUrl = (rawBaseUrl: string): string => {
  const trimmed = rawBaseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;

  return trimmed.replace(
    /^https:\/\/us-central1-ga-gutter-guys-admin\.cloudfunctions\.net$/,
    "https://us-east1-ga-gutter-guys-admin.cloudfunctions.net"
  );
};

const RESOLVED_FUNCTIONS_BASE_URL = normalizeFunctionsBaseUrl(FUNCTIONS_BASE_URL);

const buildUrl = (endpoint: string, query?: Record<string, string | number | boolean | null | undefined>): string => {
  const url = new URL(`${RESOLVED_FUNCTIONS_BASE_URL}/${endpoint}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value != null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const request = async <T>(
  endpoint: string,
  options?: {
    method?: "GET" | "POST";
    payload?: unknown;
    query?: Record<string, string | number | boolean | null | undefined>;
  }
): Promise<T> => {
  const token = await getToken();
  if (!token) {
    const error = new Error("Authentication required.") as ApiError;
    error.status = 401;
    throw error;
  }
  const method = options?.method ?? "POST";
  const url = buildUrl(endpoint, options?.query);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const init: RequestInit = { method, headers };

  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options?.payload ?? {});
  }

  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: string }).error)
        : `Request failed (${response.status}).`
    ) as ApiError;
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data as T;
};

export const apiGetDashboardKPIs = () => request<Record<string, number>>("getDashboardKPIs", { method: "GET" });

export const apiGetDailyRoute = (date: string) =>
  request<{ status: string; route: unknown }>("getDailyRoute", { method: "GET", query: { date } });

export const apiOptimizeDailyRoute = (payload: { date: string; mode?: string }) =>
  request<{ status: string; route: unknown }>("optimizeDailyRoute", { payload });

export const apiAiPrioritizeRoute = (payload: { date: string }) =>
  request<{ status: string; ranked?: unknown }>("aiPrioritizeRoute", { payload });

export const apiCreateEstimate = (payload: Record<string, unknown>) =>
  request<{ status?: string; id?: string }>("createEstimate", { payload });

export const apiGetEstimates = (jobId?: string) =>
  request<unknown>("getEstimates", { method: "GET", query: jobId ? { jobId } : undefined });

export const apiUpdateJobPriority = (payload: { jobId: string; priorityRank: number }) =>
  request<{ status: string }>("updateJobPriority", { payload });

export const apiReorderStops = (payload: { date: string; orderedJobIds: string[] }) =>
  request<{ status: string; route: unknown }>("reorderStops", { payload });

export const apiVertexMeasurement = (payload: {
  address: string;
  task?: string;
  responseFormat?: "json" | "text";
}) => {
  return (async () => {
    const token = await getToken();
    if (!token) {
      const error = new Error("Authentication required.") as ApiError;
      error.status = 401;
      throw error;
    }

    const url = "https://us-east1-ga-gutter-guys-admin.cloudfunctions.net/vertexAIChat";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        address: payload.address,
        messages: [
          {
            role: "user",
            content: `Estimate total roof-edge and gutter linear feet for this residential property address: ${payload.address}. Return JSON with totalFeet and confidence from 0 to 1.`,
          },
        ],
        meta: {
          task: payload.task ?? "satellite_measurement",
          responseFormat: payload.responseFormat ?? "json",
        },
      }),
    });

    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: string }).error)
          : `Request failed (${response.status}).`
      ) as ApiError;
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    return data;
  })();
};

export type QboStatusResponse = {
  status: string;
  connected: boolean;
  realmId: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
};

export const apiGetQboStatus = () =>
  request<QboStatusResponse>("qboStatus", { method: "GET" });

export const apiStartQboAuth = (payload?: { returnPath?: string }) =>
  request<{ status: string; authUrl: string }>("qboAuthStart", { payload: payload ?? {} });

export const apiDisconnectQbo = () =>
  request<{ status: string; connected: boolean }>("qboDisconnect", { payload: {} });

export type GcalStatusResponse = {
  status: string;
  connected: boolean;
  calendarId: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
};

export type GcalCalendarListItem = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string | null;
};

export const apiGetGcalStatus = () =>
  request<GcalStatusResponse>("gcalStatus", { method: "GET" });

export const apiStartGcalAuth = (payload?: { returnPath?: string }) =>
  request<{ status: string; authUrl: string }>("gcalAuthStart", { payload: payload ?? {} });

export const apiDisconnectGcal = () =>
  request<{ status: string; connected: boolean }>("gcalDisconnect", { payload: {} });

export const apiListGcalCalendars = () =>
  request<{ status: string; selectedCalendarId: string | null; calendars: GcalCalendarListItem[] }>(
    "gcalListCalendars",
    { method: "GET" }
  );

export const apiSetGcalCalendar = (payload: { calendarId: string }) =>
  request<{ status: string; calendarId: string }>("gcalSetCalendar", { payload });

export const apiSyncEventToGcal = (payload: {
  id: string;
  title: string;
  start: string;
  end: string;
  status?: string;
  crewAssigned?: string;
  jobId?: string;
  googleEventId?: string | null;
}) =>
  request<{ status: string; synced: boolean; googleEventId: string }>("gcalSyncEvent", { payload });

export const apiSyncGoogleToFirestore = (payload?: { daysBack?: number; daysAhead?: number }) =>
  request<{ status: string; synced: boolean; importedCount: number }>("gcalSyncToFirestore", {
    payload: payload ?? {},
  });
