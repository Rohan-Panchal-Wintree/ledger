import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api";

export const reportQueryKeys = {
  all: ["reports"],
  dates: () => [...reportQueryKeys.all, "dates"],
  banks: (params) => [...reportQueryKeys.all, "banks", params],
  paymentDay: (params) => [...reportQueryKeys.all, "payment-day", params],
};

// Fetch reports according to dates
async function getReportDatesApi() {
  const response = await reportsApi.get("/dates");
  return response.data?.data || [];
}

// Fetch the reports for a specific bank
async function getBankReportsApi(params = {}) {
  const response = await reportsApi.get("/banks", { params });
  return response.data?.data || [];
}

// Fetch the Latest payment report for the last payment data uploaded
async function getPaymentDayReportApi(params = {}) {
  const response = await reportsApi.get("/payment-report", { params });
  return (
    response.data?.data || {
      paymentDate: null,
      payments: [],
      miscellaneous: [],
      summary: {},
    }
  );
}

// Queries

export function useReportDates() {
  return useQuery({
    queryKey: reportQueryKeys.dates(),
    queryFn: getReportDatesApi,
  });
}

export function useBankReports(params = {}) {
  return useQuery({
    queryKey: reportQueryKeys.banks(params),
    queryFn: () => getBankReportsApi(params),
    placeholderData: (previousData) => previousData,
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
