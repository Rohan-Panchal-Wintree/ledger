import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { miscellaneousPaymentApi } from "../api";
import { dashboardQueryKeys } from "./dashboardQueries";

export const miscellaneousQueryKeys = {
  all: ["miscellaneous-payments"],
  list: ({ paymentSheetDate, search, entryType, bankLabel } = {}) => [
    ...miscellaneousQueryKeys.all,
    "list",
    { paymentSheetDate, search, entryType, bankLabel },
  ],
  detail: (id) => [...miscellaneousQueryKeys.all, "detail", id],
};

// Fetch miscellaneous payments
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

  const items = response.data?.data || [];

  console.log("miscelleanous", items);

  return {
    items,
    total: items.length,
  };
}

// Fetch one miscellaneous payment
async function fetchMiscellaneousPaymentApi(id) {
  const response = await miscellaneousPaymentApi.get(`/${id}`);
  return response.data?.data || null;
}

// Create miscellaneous payment
async function createMiscellaneousPaymentApi(payload) {
  const response = await miscellaneousPaymentApi.post("/", payload);
  return response.data?.data || response.data;
}

// Update miscellaneous payment
async function updateMiscellaneousPaymentApi({ id, payload }) {
  const response = await miscellaneousPaymentApi.put(`/${id}`, payload);
  return response.data?.data || response.data;
}

// Delete miscellaneous payment
async function deleteMiscellaneousPaymentApi(id) {
  await miscellaneousPaymentApi.delete(`/${id}`);
  return id;
}

// Queries

export function useMiscellaneousPayments(params = {}) {
  return useQuery({
    queryKey: miscellaneousQueryKeys.list(params),
    queryFn: () => fetchMiscellaneousPaymentsApi(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useMiscellaneousPayment(id) {
  return useQuery({
    queryKey: miscellaneousQueryKeys.detail(id),
    queryFn: () => fetchMiscellaneousPaymentApi(id),
    enabled: Boolean(id),
  });
}

export function useCreateMiscellaneousPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMiscellaneousPaymentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: miscellaneousQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
    },
  });
}

export function useUpdateMiscellaneousPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMiscellaneousPaymentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: miscellaneousQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
    },
  });
}

export function useDeleteMiscellaneousPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMiscellaneousPaymentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: miscellaneousQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
    },
  });
}
