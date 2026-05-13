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
} from "./config";
import { decryptData, encryptData } from "./utils/cryptoUtils";

const AUTH_STORAGE_KEY = "pg_user";

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
  if (!auth?.user) return;

  const encryptedAuth = await encryptData(auth);
  localStorage.setItem(AUTH_STORAGE_KEY, encryptedAuth);
}

async function getCsrfTokenFromStorage() {
  const auth = await getStoredAuth();
  return auth?.csrfToken || null;
}

function shouldAttachCsrf(method) {
  return ["post", "put", "patch", "delete"].includes(method?.toLowerCase());
}

async function attachCsrfHeader(config) {
  if (!shouldAttachCsrf(config.method)) return config;

  const csrfToken = await getCsrfTokenFromStorage();

  if (csrfToken) {
    config.headers = config.headers ?? {};
    config.headers["X-CSRF-Token"] = csrfToken;
  }

  return config;
}

const refreshApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

refreshApi.interceptors.request.use(attachCsrfHeader);

let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = refreshApi
      .post("/refresh")
      .then(async (response) => {
        const previousAuth = await getStoredAuth();

        const nextAuth = {
          user: response.data?.user || previousAuth?.user,
          csrfToken: response.data?.csrfToken || previousAuth?.csrfToken,
        };

        if (!nextAuth.user || !nextAuth.csrfToken) {
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

function isAuthRoute(url = "") {
  return (
    url.includes("/refresh") ||
    url.includes("/verify-otp") ||
    url.includes("/request-otp") ||
    url.includes("/logout")
  );
}

function createApiInstance(baseURL) {
  const instance = axios.create({
    baseURL,
    withCredentials: true,
  });

  instance.interceptors.request.use(attachCsrfHeader);

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

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

        originalRequest.headers = originalRequest.headers ?? {};

        const csrfToken = await getCsrfTokenFromStorage();

        if (shouldAttachCsrf(originalRequest.method) && csrfToken) {
          originalRequest.headers["X-CSRF-Token"] = csrfToken;
        }

        return instance(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        window.dispatchEvent(new Event("auth:expired"));
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
export const invalidApi = createApiInstance(INVALID_URL);
export const miscellaneousPaymentApi = createApiInstance(
  MISCELLANEOUS_PAYMENT_URL,
);
