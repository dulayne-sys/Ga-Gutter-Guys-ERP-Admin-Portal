import { FUNCTIONS_BASE_URL } from "./config";
import { getToken } from "./authGate";

export type ApiError = Error & { status?: number; payload?: unknown };

const buildUrl = (endpoint: string, query?: Record<string, string | number | boolean | null | undefined>): string => {
  const url = new URL(`${FUNCTIONS_BASE_URL}/${endpoint}`);
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
