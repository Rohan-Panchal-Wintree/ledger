import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { merchantApi } from "../api";

export const merchantQueryKeys = {
  all: ["merchants"],

  list: ({ page = 1, limit = 25, search = "" } = {}) => [
    ...merchantQueryKeys.all,
    "list",
    { page, limit, search },
  ],
};

const defaultMerchantMeta = {
  total: 0,
  page: 1,
  limit: 25,
  totalPages: 1,
};

function extractResponseData(response, fallback) {
  return response?.data?.data ?? fallback;
}

function extractResponseMeta(response, fallback) {
  return response?.data?.meta ?? fallback;
}

async function fetchMerchantsApi({ page = 1, limit = 25, search = "" } = {}) {
  const response = await merchantApi.get("/", {
    params: {
      page,
      limit,
      search,
    },
  });

  return {
    items: extractResponseData(response, []),
    meta: extractResponseMeta(response, {
      ...defaultMerchantMeta,
      page,
      limit,
    }),
  };
}

async function createMerchantApi(payload) {
  const response = await merchantApi.post("/", payload);

  return extractResponseData(response, response.data);
}

async function updateMerchantApi({ id, payload }) {
  const response = await merchantApi.put(`/${id}`, payload);

  return extractResponseData(response, response.data);
}

async function deleteMerchantApi(id) {
  await merchantApi.delete(`/${id}`);

  return id;
}

export function useMerchants(params = {}) {
  return useQuery({
    queryKey: merchantQueryKeys.list(params),
    queryFn: () => fetchMerchantsApi(params),
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
