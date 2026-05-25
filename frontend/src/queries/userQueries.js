import { usersApi } from "../api";

export const getUsers = async () => {
  const response = await usersApi.get("/");
  return response.data;
};

export const createUser = async (payload) => {
  const response = await usersApi.post("/", payload);
  return response.data;
};

export const updateUser = async (id, payload) => {
  const response = await usersApi.put(`/${id}`, payload);
  return response.data;
};

export const deleteUser = async (id) => {
  const response = await usersApi.delete(`/${id}`);
  return response.data;
};
