import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { merchantApi } from "../api";

export const merchantQueryKeys = {
  all: ["merchants"],
  list: ({ page, limit, search }) => [
    ...merchantQueryKeys.all,
    "list",
    { page, limit, search },
  ],
};

// Fetch all Merchant data
async function fetchMerchantsApi({ page = 1, limit = 25, search = "" }) {
  const response = await merchantApi.get("/", {
    params: {
      page,
      limit,
      search,
    },
  });

  return {
    items: response?.data?.data || [],
    meta: response?.data?.meta || {
      total: 0,
      page,
      limit,
      totalPages: 1,
    },
    search,
  };
}

// Add a new Merchant
async function createMerchantApi(payload) {
  const response = await merchantApi.post("/", payload);
  return response?.data?.data || null;
}

// Update an existing Merchant
async function updateMerchantApi({ id, payload }) {
  const response = await merchantApi.put(`/${id}`, payload);
  return response?.data?.data || null;
}

// Delete an existing Merchant
async function deleteMerchantApi(id) {
  await merchantApi.delete(`/${id}`);
  return id;
}

// Queries

export function useMerchants({ page = 1, limit = 25, search = "" }) {
  return useQuery({
    queryKey: merchantQueryKeys.list({ page, limit, search }),
    queryFn: () => fetchMerchantsApi({ page, limit, search }),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMerchantApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: merchantQueryKeys.all,
      });
    },
  });
}

export function useUpdateMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMerchantApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: merchantQueryKeys.all,
      });
    },
  });
}

export function useDeleteMerchant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMerchantApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: merchantQueryKeys.all,
      });
    },
  });
}
