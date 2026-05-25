import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { miscellaneousPaymentApi } from "../api";
import { dashboardQueryKeys } from "./dashboardQueries";

export const miscellaneousQueryKeys = {
  all: ["miscellaneous-payments"],

  list: ({ paymentSheetDate, search, entryType, bankLabel } = {}) => [
    ...miscellaneousQueryKeys.all,
    "list",
    {
      paymentSheetDate,
      search,
      entryType,
      bankLabel,
    },
  ],

  detail: (id) => [...miscellaneousQueryKeys.all, "detail", id],
};

// Extract API response data
function extractResponseData(response, fallback) {
  return response?.data?.data ?? fallback;
}

// Fetch miscellaneous list
async function fetchMiscellaneousPaymentsApi({
  paymentSheetDate = "",
  search = "",
  entryType = "",
  bankLabel = "",
} = {}) {
  const response = await miscellaneousPaymentApi.get("/", {
    params: {
      paymentSheetDate,
      search,
      entryType,
      bankLabel,
    },
  });

  const items = extractResponseData(response, []);

  return {
    items,
    total: items.length,
  };
}

// Fetch single entry
async function fetchMiscellaneousPaymentApi(id) {
  const response = await miscellaneousPaymentApi.get(`/${id}`);

  return extractResponseData(response, null);
}

// Create entry
async function createMiscellaneousPaymentApi(payload) {
  const response = await miscellaneousPaymentApi.post("/", payload);

  return extractResponseData(response, response.data);
}

// Update entry
async function updateMiscellaneousPaymentApi({ id, payload }) {
  const response = await miscellaneousPaymentApi.put(`/${id}`, payload);

  return extractResponseData(response, response.data);
}

// Delete entry
async function deleteMiscellaneousPaymentApi(id) {
  await miscellaneousPaymentApi.delete(`/${id}`);

  return id;
}

// Shared invalidation
function invalidateMiscellaneousQueries(queryClient) {
  queryClient.invalidateQueries({
    queryKey: miscellaneousQueryKeys.all,
  });

  queryClient.invalidateQueries({
    queryKey: dashboardQueryKeys.all,
  });
}

// List query
export function useMiscellaneousPayments(params = {}) {
  return useQuery({
    queryKey: miscellaneousQueryKeys.list(params),

    queryFn: () => fetchMiscellaneousPaymentsApi(params),

    placeholderData: (previousData) => previousData,
  });
}

// Detail query
export function useMiscellaneousPayment(id) {
  return useQuery({
    queryKey: miscellaneousQueryKeys.detail(id),

    queryFn: () => fetchMiscellaneousPaymentApi(id),

    enabled: Boolean(id),
  });
}

// Create mutation
export function useCreateMiscellaneousPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMiscellaneousPaymentApi,

    onSuccess: () => {
      invalidateMiscellaneousQueries(queryClient);
    },
  });
}

// Update mutation
export function useUpdateMiscellaneousPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMiscellaneousPaymentApi,

    onSuccess: () => {
      invalidateMiscellaneousQueries(queryClient);
    },
  });
}

// Delete mutation
export function useDeleteMiscellaneousPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMiscellaneousPaymentApi,

    onSuccess: () => {
      invalidateMiscellaneousQueries(queryClient);
    },
  });
}
