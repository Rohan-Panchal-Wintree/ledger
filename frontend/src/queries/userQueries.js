import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { usersApi } from "../api";

export const userQueryKeys = {
  all: ["users"],
  list: () => [...userQueryKeys.all, "list"],
};

function extractResponseData(response, fallback = []) {
  return response?.data?.data ?? fallback;
}

async function getUsersApi() {
  const response = await usersApi.get("/");

  return extractResponseData(response, []);
}

async function createUserApi(payload) {
  const response = await usersApi.post("/", payload);

  return response?.data;
}

async function updateUserApi({ id, payload }) {
  const response = await usersApi.put(`/${id}`, payload);

  return response?.data;
}

async function deleteUserApi(id) {
  const response = await usersApi.delete(`/${id}`);

  return response?.data;
}

export function useUsers() {
  return useQuery({
    queryKey: userQueryKeys.list(),
    queryFn: getUsersApi,
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUserApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.list(),
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.list(),
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUserApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.list(),
      });
    },
  });
}
