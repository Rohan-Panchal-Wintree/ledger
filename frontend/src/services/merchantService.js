import { apiClient } from "./apiClient";

const merchantService = {
  async getAll() {
    const response = await apiClient.get("/merchants");
    return response.data?.data || [];
  },

  async getById(id) {
    const response = await apiClient.get(`/merchants/${id}`);
    return response.data?.data;
  },

  async create(payload) {
    const response = await apiClient.post("/merchants", payload);
    return response.data?.data;
  },

  async update(id, payload) {
    const response = await apiClient.put(`/merchants/${id}`, payload);
    return response.data?.data;
  },

  async remove(id) {
    const response = await apiClient.delete(`/merchants/${id}`);
    return response.data;
  },
};

export default merchantService;
