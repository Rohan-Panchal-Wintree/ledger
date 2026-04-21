import axios from "axios";
import { API_URL, LEDGER_URL, PAYMENT_URL, SETTLEMENT_URL } from "./config";

export const authApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const paymentApi = axios.create({
  baseURL: PAYMENT_URL,
  withCredentials: true,
});

export const settlementApi = axios.create({
  baseURL: SETTLEMENT_URL,
  withCredentials: true,
});

export const ledgerApi = axios.create({
  baseURL: LEDGER_URL,
  withCredentials: true,
});
