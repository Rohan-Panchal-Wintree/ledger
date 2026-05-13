import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { acquirerApi } from "../api";

export const acquirerQueryKeys = {
  all: ["acquirers"],
  list: ({ page, limit, search }) => [
    ...acquirerQueryKeys.all,
    "list",
    { page, limit, search },
  ],
};

// Fetch all Acquirer data
async function fetchAcquirersApi({ page = 1, limit = 25, search = "" }) {
  const response = await acquirerApi.get("/", {
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

// Add a new Acquirer
async function createAcquirerApi(payload) {
  const response = await acquirerApi.post("/", payload);
  return response?.data?.data || null;
}

// Update an exisiting Acquirer
async function updateAcquirerApi({ id, payload }) {
  const response = await acquirerApi.put(`/${id}`, payload);
  return response?.data?.data || null;
}

// Delete an exisiting Acquirer
async function deleteAcquirerApi(id) {
  await acquirerApi.delete(`/${id}`);
  return id;
}

// Queries

export function useAcquirers({ page = 1, limit = 25, search = "" }) {
  return useQuery({
    queryKey: acquirerQueryKeys.list({ page, limit, search }),
    queryFn: () => fetchAcquirersApi({ page, limit, search }),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateAcquirer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAcquirerApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: acquirerQueryKeys.all,
      });
    },
  });
}

export function useUpdateAcquirer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAcquirerApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: acquirerQueryKeys.all,
      });
    },
  });
}

export function useDeleteAcquirer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAcquirerApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: acquirerQueryKeys.all,
      });
    },
  });
}
