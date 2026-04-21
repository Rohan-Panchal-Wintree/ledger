import { apiClient } from "./apiClient";

const acquirerService = {
  async getAll() {
    const response = await apiClient.get("/acquirers");
    return response.data?.data || [];
  },

  async getById(id) {
    const response = await apiClient.get(`/acquirers/${id}`);
    return response.data?.data;
  },

  async create(payload) {
    const response = await apiClient.post("/acquirers", payload);
    return response.data?.data;
  },

  async update(id, payload) {
    const response = await apiClient.put(`/acquirers/${id}`, payload);
    return response.data?.data;
  },

  async remove(id) {
    const response = await apiClient.delete(`/acquirers/${id}`);
    return response.data;
  },
};

export default acquirerService;
