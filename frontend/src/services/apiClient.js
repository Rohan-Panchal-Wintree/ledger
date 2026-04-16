import axios from "axios";
import { BASE_API_URL } from "../config";
import store from "../store";
import { decryptData } from "../utils/cryptoUtils";

async function resolveAccessToken() {
  const tokenFromStore = store.getState().auth?.accessToken;

  if (tokenFromStore) {
    return tokenFromStore;
  }

  const storedAuth = localStorage.getItem("pg_user");

  if (!storedAuth) {
    return null;
  }

  try {
    const restoredAuth = await decryptData(storedAuth);
    return restoredAuth?.accessToken || null;
  } catch {
    localStorage.removeItem("pg_user");
    return null;
  }
}

export function getApiErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage
  );
}

export const apiClient = axios.create({
  baseURL: BASE_API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use(async (config) => {
  const accessToken = await resolveAccessToken();

  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});
