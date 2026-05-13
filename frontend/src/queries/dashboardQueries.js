import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api";

export const dashboardQueryKeys = {
  all: ["dashboard"],
  latest: () => [...dashboardQueryKeys.all, "latest"],
  byPeriod: ({ paymentDate }) => [
    ...dashboardQueryKeys.all,
    "period",
    { paymentDate },
  ],
  wiresheetUploads: () => [...dashboardQueryKeys.all, "wiresheet-uploads"],
};

// Fetch all the transactions
async function fetchDashboardLatestApi() {
  const response = await dashboardApi.get("/latest");

  return (
    response?.data?.data || {
      dashboardSource: null,
      paymentDate: null,
      summary: {},
      groupedData: [],
      transactions: [],
      unmatchedPayments: [],
      wiresheets: [],
    }
  );
}

// Fetch transactions according to the date
async function fetchDashboardByPeriodApi({ paymentDate }) {
  const response = await dashboardApi.get("/", {
    params: {
      paymentDate,
    },
  });

  return (
    response?.data?.data || {
      paymentDate: paymentDate || null,
      summary: {},
      groupedData: [],
      transactions: [],
      unmatchedPayments: [],
      wiresheets: [],
    }
  );
}

// Fetch the wireshett summary data
async function fetchWiresheetUploadsApi() {
  const response = await dashboardApi.get("/wiresheet-uploads");
  return response?.data?.data || [];
}

// Queries

export function useDashboardLatest({ enabled = true } = {}) {
  return useQuery({
    queryKey: dashboardQueryKeys.latest(),
    queryFn: fetchDashboardLatestApi,
    enabled,
    placeholderData: (previousData) => previousData,
  });
}

export function useDashboardByPeriod({ paymentDate, enabled = true }) {
  return useQuery({
    queryKey: dashboardQueryKeys.byPeriod({ paymentDate }),
    queryFn: () => fetchDashboardByPeriodApi({ paymentDate }),
    enabled: enabled && Boolean(paymentDate),
    placeholderData: (previousData) => previousData,
  });
}

export function useWiresheetUploads() {
  return useQuery({
    queryKey: dashboardQueryKeys.wiresheetUploads(),
    queryFn: fetchWiresheetUploadsApi,
    placeholderData: (previousData) => previousData,
  });
}
