import { useQuery } from "@tanstack/react-query";

import { reportsApi } from "../api";

export const reportQueryKeys = {
  all: ["reports"],

  dates: () => [...reportQueryKeys.all, "dates"],

  paymentDay: (params = {}) => [...reportQueryKeys.all, "payment-day", params],
};

const defaultPaymentDayReport = {
  paymentDate: null,
  summary: {},
  banks: [],
};

function extractResponseData(response, fallback) {
  return response?.data?.data ?? fallback;
}

async function getReportDatesApi() {
  const response = await reportsApi.get("/dates");

  return extractResponseData(response, []);
}

async function getPaymentDayReportApi(params = {}) {
  const response = await reportsApi.get("/payment-report", {
    params,
  });

  return extractResponseData(response, defaultPaymentDayReport);
}

export function useReportDates() {
  return useQuery({
    queryKey: reportQueryKeys.dates(),
    queryFn: getReportDatesApi,
  });
}

export function usePaymentDayReport(params = {}) {
  return useQuery({
    queryKey: reportQueryKeys.paymentDay(params),
    queryFn: () => getPaymentDayReportApi(params),
    placeholderData: (previousData) => previousData,
  });
}

export async function exportBankReportsExcel(params = {}) {
  const response = await reportsApi.get("/banks/export/excel", {
    params,
    responseType: "blob",
  });

  return response.data;
}

export async function exportBankReportsPdf(params = {}) {
  const response = await reportsApi.get("/banks/export/pdf", {
    params,
    responseType: "blob",
  });

  return response.data;
}
