import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api";

export const dashboardQueryKeys = {
  all: ["dashboard"],
  latest: () => [...dashboardQueryKeys.all, "latest"],
  byPeriod: ({ paymentDate, fromDate, toDate }) => [
    ...dashboardQueryKeys.all,
    "period",
    {
      paymentDate,
      fromDate,
      toDate,
    },
  ],
  wiresheetUploads: () => [...dashboardQueryKeys.all, "wiresheet-uploads"],
};

// Fetch all the transactions
async function fetchDashboardLatestApi() {
  const response = await dashboardApi.get("/latest");

  console.log("latest dashboard response", response.data.data);

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
async function fetchDashboardByPeriodApi({
  paymentDate = "",
  fromDate = "",
  toDate = "",
} = {}) {
  const params = {};

  if (paymentDate) {
    params.paymentDate = paymentDate;
  }

  if (fromDate && toDate) {
    params.fromDate = fromDate;
    params.toDate = toDate;
  }

  const response = await dashboardApi.get("/", {
    params,
  });

  return (
    response?.data?.data || {
      paymentDate: paymentDate || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      isRange: Boolean(fromDate && toDate),
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

export function useDashboardByPeriod({
  paymentDate = "",
  fromDate = "",
  toDate = "",
  enabled = true,
}) {
  const hasSingleDate = Boolean(paymentDate);
  const hasDateRange = Boolean(fromDate && toDate);

  return useQuery({
    queryKey: dashboardQueryKeys.byPeriod({
      paymentDate,
      fromDate,
      toDate,
    }),
    queryFn: () =>
      fetchDashboardByPeriodApi({
        paymentDate,
        fromDate,
        toDate,
      }),
    enabled: enabled && (hasSingleDate || hasDateRange),
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
