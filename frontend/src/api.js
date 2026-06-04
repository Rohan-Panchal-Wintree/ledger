import axios from "axios";

import {
  ACQUIRER_URL,
  DASHBOARD_URL,
  API_URL,
  MERCHANT_URL,
  PAYMENT_URL,
  REPORTS_URL,
  WIRESHEET_URL,
  INVALID_URL,
  MISCELLANEOUS_PAYMENT_URL,
  PROFILE_URL,
  USERS_URL,
  SHEETS_URL,
} from "./config";

import { decryptData, encryptData } from "./utils/cryptoUtils";
import { decryptApiResponse } from "./utils/apiEncryption";

const AUTH_STORAGE_KEY = "pg_user";
const LOGIN_PATH = "/login";

async function getStoredAuth() {
  const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedAuth) return null;

  try {
    return await decryptData(storedAuth);
  } catch {
    return null;
  }
}

async function saveStoredAuth(auth) {
  if (!auth) return;

  const encryptedAuth = await encryptData(auth);

  localStorage.setItem(AUTH_STORAGE_KEY, encryptedAuth);
}

function expireAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event("auth:expired"));

  if (window.location.pathname !== LOGIN_PATH) {
    window.location.assign(LOGIN_PATH);
  }
}

function shouldAttachAuthHeaders(method) {
  return ["post", "put", "patch", "delete"].includes(method?.toLowerCase());
}

function isAuthRoute(url = "") {
  return (
    url.includes("/refresh") ||
    url.includes("/verify-otp") ||
    url.includes("/request-otp") ||
    url.includes("/logout")
  );
}

function isInvalidCsrfError(error) {
  const status = error.response?.status;
  const message = String(error.response?.data?.message || "").toLowerCase();

  return status === 403 && message.includes("csrf");
}

function isMissingOrInvalidSessionError(error) {
  const status = error.response?.status;
  const message = String(error.response?.data?.message || "").toLowerCase();

  return (
    status === 401 &&
    (message.includes("session expired") ||
      message.includes("session") ||
      message.includes("authentication required") ||
      message.includes("invalid access token"))
  );
}

async function attachAuthHeaders(config) {
  if (!shouldAttachAuthHeaders(config.method)) return config;

  if (isAuthRoute(config.url)) return config;

  const auth = await getStoredAuth();
  const csrfToken = auth?.csrfToken || null;
  const sessionId = auth?.sessionId || null;

  if (!csrfToken || !sessionId) {
    expireAuth();

    return Promise.reject(new Error("Missing authentication session."));
  }

  config.headers = config.headers ?? {};
  config.headers["X-CSRF-Token"] = csrfToken;
  config.headers["X-Session-Id"] = sessionId;

  return config;
}

const refreshApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

refreshApi.interceptors.request.use(async (config) => {
  const auth = await getStoredAuth();
  const csrfToken = auth?.csrfToken || null;
  const sessionId = auth?.sessionId || null;

  config.headers = config.headers ?? {};

  if (csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }

  if (sessionId) {
    config.headers["X-Session-Id"] = sessionId;
  }

  return config;
});

let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = refreshApi
      .post("/refresh")
      .then(async (response) => {
        const previousAuth = await getStoredAuth();

        const nextAuth = {
          user: response.data?.user || previousAuth?.user,
          sessionId: response.data?.sessionId || previousAuth?.sessionId,
          csrfToken: response.data?.csrfToken,
          responseKey: response.data?.responseKey || previousAuth?.responseKey,
        };

        if (
          !nextAuth.user ||
          !nextAuth.sessionId ||
          !nextAuth.csrfToken ||
          !nextAuth.responseKey
        ) {
          throw new Error("Refresh response missing auth data");
        }

        await saveStoredAuth(nextAuth);

        return nextAuth;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function createApiInstance(baseURL) {
  const instance = axios.create({
    baseURL,
    withCredentials: true,
  });

  instance.interceptors.request.use(attachAuthHeaders);

  instance.interceptors.response.use(
    async (response) => {
      const auth = await getStoredAuth();
      const responseKey = auth?.responseKey || null;

      if (response.data?.encrypted === true) {
        if (!responseKey) {
          expireAuth();
          throw new Error("Missing response decryption key");
        }

        response.data = await decryptApiResponse(response.data, responseKey);
      }

      return response;
    },

    async (error) => {
      const originalRequest = error.config;

      if (isInvalidCsrfError(error)) {
        expireAuth();
        return Promise.reject(error);
      }

      if (
        isAuthRoute(originalRequest?.url) &&
        isMissingOrInvalidSessionError(error)
      ) {
        expireAuth();
        return Promise.reject(error);
      }

      if (
        error.response?.status !== 401 ||
        !originalRequest ||
        originalRequest._retry ||
        isAuthRoute(originalRequest.url)
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        await refreshSession();

        await attachAuthHeaders(originalRequest);

        return instance(originalRequest);
      } catch (refreshError) {
        expireAuth();

        return Promise.reject(refreshError);
      }
    },
  );

  return instance;
}

export const authApi = createApiInstance(API_URL);
export const dashboardApi = createApiInstance(DASHBOARD_URL);
export const paymentApi = createApiInstance(PAYMENT_URL);
export const merchantApi = createApiInstance(MERCHANT_URL);
export const acquirerApi = createApiInstance(ACQUIRER_URL);
export const reportsApi = createApiInstance(REPORTS_URL);
export const wiresheetApi = createApiInstance(WIRESHEET_URL);
export const sheetsApi = createApiInstance(SHEETS_URL);
export const invalidApi = createApiInstance(INVALID_URL);
export const miscellaneousPaymentApi = createApiInstance(
  MISCELLANEOUS_PAYMENT_URL,
);
export const profileApi = createApiInstance(PROFILE_URL);
export const usersApi = createApiInstance(USERS_URL);
