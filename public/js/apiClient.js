import { getIdToken as getToken } from "./authUi.js";

const BASE_URL = "https://us-east1-ga-gutter-guys-admin.cloudfunctions.net";

export const getIdToken = async () => {
  const token = await getToken();
  if (!token) {
    const error = new Error("Authentication required.");
    error.code = "unauthenticated";
    throw error;
  }

  return token;
};

export const apiCall = async (endpoint, payload) => {
  const token = await getIdToken();
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload ?? {}),
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const error = new Error((data && data.error) || `Request failed (${response.status}).`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

export const createApiRunner = () => {
  let successHandler = null;
  let failureHandler = null;

  const runner = new Proxy({}, {
    get(_target, prop) {
      if (prop === "withSuccessHandler") {
        return (handler) => {
          successHandler = handler;
          return runner;
        };
      }

      if (prop === "withFailureHandler") {
        return (handler) => {
          failureHandler = handler;
          return runner;
        };
      }

      return (...args) => {
        const endpoint = String(prop);
        const payload = args.length <= 1 ? (args[0] ?? {}) : { args };

        apiCall(endpoint, payload)
          .then((data) => {
            if (successHandler) {
              successHandler(data);
            }
          })
          .catch((error) => {
            if (failureHandler) {
              failureHandler(error);
            } else {
              console.error(error);
            }
          })
          .finally(() => {
            successHandler = null;
            failureHandler = null;
          });
      };
    },
  });

  return runner;
};

export const api = createApiRunner();

