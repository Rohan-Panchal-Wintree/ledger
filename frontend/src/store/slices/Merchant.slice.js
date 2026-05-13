import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { merchantApi } from "../../api";

// Get all the merchants
export const fetchMerchants = createAsyncThunk(
  "merchants/fetchAll",
  async ({ page = 1, limit = 25, search = "" } = {}, { rejectWithValue }) => {
    try {
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
    } catch (error) {
      console.error("Fetch merchants error:", error);

      return rejectWithValue(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to load merchant data.",
      );
    }
  },
);

// Add a new merchant
export const createMerchant = createAsyncThunk(
  "merchants/create",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await merchantApi.post("/", payload);
      return response?.data?.data || null;
    } catch (error) {
      console.error("Create merchant error:", error);

      return rejectWithValue(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to create merchant.",
      );
    }
  },
);

// Update an exisiting merchant
export const updateMerchant = createAsyncThunk(
  "merchants/update",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await merchantApi.put(`/${id}`, payload);
      return response?.data?.data || null;
    } catch (error) {
      console.error("Update merchant error:", error);

      return rejectWithValue(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to update merchant.",
      );
    }
  },
);

// Delete and exisiting merchant
export const deleteMerchant = createAsyncThunk(
  "merchants/delete",
  async (id, { rejectWithValue }) => {
    try {
      await merchantApi.delete(`/${id}`);
      return id;
    } catch (error) {
      console.error("Delete merchant error:", error);

      return rejectWithValue(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to delete merchant.",
      );
    }
  },
);

const initialState = {
  items: [],
  total: 0,
  page: 1,
  limit: 25,
  totalPages: 1,
  search: "",
  error: "",
  isLoading: false,
  isSubmitting: false,
  isDeletePending: false,
};

const merchantSlice = createSlice({
  name: "merchants",
  initialState,
  reducers: {
    clearMerchantError: (state) => {
      state.error = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMerchants.pending, (state) => {
        state.isLoading = true;
        state.error = "";
      })
      .addCase(fetchMerchants.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.items;
        state.total = action.payload.meta.total;
        state.page = action.payload.meta.page;
        state.limit = action.payload.meta.limit;
        state.totalPages = action.payload.meta.totalPages;
        state.search = action.payload.search;
      })
      .addCase(fetchMerchants.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      .addCase(createMerchant.pending, (state) => {
        state.isSubmitting = true;
        state.error = "";
      })
      .addCase(createMerchant.fulfilled, (state, action) => {
        state.isSubmitting = false;

        if (action.payload) {
          state.items.unshift(action.payload);
        }
      })
      .addCase(createMerchant.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })

      .addCase(updateMerchant.pending, (state) => {
        state.isSubmitting = true;
        state.error = "";
      })
      .addCase(updateMerchant.fulfilled, (state, action) => {
        state.isSubmitting = false;

        const updatedMerchant = action.payload;

        if (!updatedMerchant?._id) return;

        const index = state.items.findIndex(
          (merchant) => merchant._id === updatedMerchant._id,
        );

        if (index !== -1) {
          state.items[index] = updatedMerchant;
        }

        state.selectedItem = updatedMerchant;
      })
      .addCase(updateMerchant.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })

      .addCase(deleteMerchant.pending, (state) => {
        state.isDeletePending = true;
        state.error = "";
      })
      .addCase(deleteMerchant.fulfilled, (state, action) => {
        state.isDeletePending = false;
        state.items = state.items.filter(
          (merchant) => merchant._id !== action.payload,
        );
      })
      .addCase(deleteMerchant.rejected, (state, action) => {
        state.isDeletePending = false;
        state.error = action.payload;
      });
  },
});

export const { clearMerchantError } = merchantSlice.actions;

export const selectMerchants = (state) => state.merchants.items;
export const selectMerchantState = (state) => state.merchants;

export default merchantSlice.reducer;
