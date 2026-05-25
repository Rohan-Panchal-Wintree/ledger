import { useQuery } from "@tanstack/react-query";

import { sheetsApi } from "../api";

export const sheetsQueryKeys = {
  all: ["sheets"],

  wiresheets: {
    all: () => [...sheetsQueryKeys.all, "wiresheets"],
    list: (params = {}) => [...sheetsQueryKeys.wiresheets.all(), params],
  },

  paymentSheets: {
    all: () => [...sheetsQueryKeys.all, "payment-sheets"],
    list: (params = {}) => [...sheetsQueryKeys.paymentSheets.all(), params],
  },
};

function extractResponsePayload(response) {
  return {
    data: response?.data?.data ?? [],
    meta: response?.data?.meta ?? {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    },
  };
}

function buildQueryParams({ page = 1, limit = 20, fromDate, toDate } = {}) {
  const params = {
    page,
    limit,
  };

  if (fromDate) {
    params.fromDate = fromDate;
  }

  if (toDate) {
    params.toDate = toDate;
  }

  return params;
}

async function getWiresheetsApi(filters = {}) {
  const response = await sheetsApi.get("/wiresheets", {
    params: buildQueryParams(filters),
  });

  return extractResponsePayload(response);
}

async function getPaymentSheetsApi(filters = {}) {
  const response = await sheetsApi.get("/payment-sheets", {
    params: buildQueryParams(filters),
  });

  return extractResponsePayload(response);
}

export function useWiresheets(filters = {}) {
  return useQuery({
    queryKey: sheetsQueryKeys.wiresheets.list(filters),
    queryFn: () => getWiresheetsApi(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function usePaymentSheets(filters = {}) {
  return useQuery({
    queryKey: sheetsQueryKeys.paymentSheets.list(filters),
    queryFn: () => getPaymentSheetsApi(filters),
    placeholderData: (previousData) => previousData,
  });
}
