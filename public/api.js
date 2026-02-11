import { getToken } from "./auth.js";

export async function callFunction(url, data) {
  const token = await getToken();
  if (!token) {
    const error = new Error("Authentication required.");
    error.code = "unauthenticated";
    throw error;
  }

  const hasBody = data && Object.keys(data).length > 0;
  const options = {
    method: hasBody ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  if (hasBody) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message = payload && typeof payload === "object" && payload.error
      ? payload.error
      : `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
