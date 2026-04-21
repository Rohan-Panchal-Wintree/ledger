import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { ledgerApi, paymentApi, settlementApi } from "../../api";
import { getUserFromStorage } from "./Auth.slice";

async function resolveAccessToken({ dispatch, getState }) {
  let accessToken = getState().auth?.accessToken;

  if (!accessToken) {
    const restoredAuth = await dispatch(getUserFromStorage()).unwrap();
    accessToken = restoredAuth?.accessToken;
  }

  if (!accessToken) {
    throw new Error("Access token not found. Please log in again.");
  }

  return accessToken;
}

export const fetchPayments = createAsyncThunk(
  "payments/fetchPayments",
  async (_, { dispatch, getState, rejectWithValue }) => {
    try {
      const accessToken = await resolveAccessToken({ dispatch, getState });
      const response = await ledgerApi.get("/", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("response", response);

      return response.data?.data || [];
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to fetch payments",
      );
    }
  },
);

export const fetchUnmatchedPaymentSummary = createAsyncThunk(
  "payments/fetchUnmatchedPaymentSummary",
  async (_, { dispatch, getState, rejectWithValue }) => {
    try {
      const accessToken = await resolveAccessToken({ dispatch, getState });
      const response = await paymentApi.get("/unmatched-summary", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return (
        response.data?.data || {
          pendingCount: 0,
          manualReviewCount: 0,
          recentRows: [],
        }
      );
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to fetch unmatched payment summary",
      );
    }
  },
);

export const reconcileUnmatchedPaymentRows = createAsyncThunk(
  "payments/reconcileUnmatchedPaymentRows",
  async ({ batchId } = {}, { dispatch, getState, rejectWithValue }) => {
    try {
      const accessToken = await resolveAccessToken({ dispatch, getState });
      const response = await paymentApi.post(
        "/reconcile-unmatched",
        batchId ? { batchId } : {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const result = response.data?.data || response.data;

      try {
        await dispatch(fetchUnmatchedPaymentSummary()).unwrap();
      } catch (_error) {}

      try {
        await dispatch(fetchPayments()).unwrap();
      } catch (_error) {}

      return result;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to reconcile unmatched payment rows",
      );
    }
  },
);

export const uploadFiles = createAsyncThunk(
  "payments/uploadFiles",
  async (
    {
      wireFiles = [],
      paymentFiles = [],
      batchId,
      paymentDate,
      acquirerId,
    } = {},
    { dispatch, getState, rejectWithValue },
  ) => {
    try {
      if (wireFiles.length === 0 && paymentFiles.length === 0) {
        throw new Error("No files selected for upload");
      }

      const accessToken = await resolveAccessToken({ dispatch, getState });
      const authHeaders = {
        Authorization: `Bearer ${accessToken}`,
      };

      const result = {
        wire: null,
        payments: [],
      };

      if (wireFiles.length > 0) {
        const wireFormData = new FormData();

        if (wireFiles.length === 1) {
          wireFormData.append("file", wireFiles[0]);
        } else {
          wireFiles.forEach((file) => {
            wireFormData.append("files", file);
          });
        }

        if (acquirerId) {
          wireFormData.append("acquirerId", acquirerId);
        }

        const wireResponse = await settlementApi.post(
          "/upload-wiresheet",
          wireFormData,
          {
            headers: {
              ...authHeaders,
              "Content-Type": "multipart/form-data",
            },
          },
        );

        result.wire = wireResponse.data?.data || wireResponse.data;
      }

      if (paymentFiles.length > 0) {
        const uploadedPayments = await Promise.all(
          paymentFiles.map(async (file) => {
            const paymentFormData = new FormData();
            paymentFormData.append("file", file);

            if (batchId) {
              paymentFormData.append("batchId", batchId);
            }

            if (paymentDate) {
              paymentFormData.append("paymentDate", paymentDate);
            }

            const paymentResponse = await paymentApi.post(
              "/upload",
              paymentFormData,
              {
                headers: {
                  ...authHeaders,
                  "Content-Type": "multipart/form-data",
                },
              },
            );

            console.log("response for the file uploaded", paymentResponse);

            return {
              fileName: file.name,
              data: paymentResponse.data?.data || paymentResponse.data,
            };
          }),
        );

        result.payments = uploadedPayments;
      }

      try {
        result.unmatchedSummary = await dispatch(
          fetchUnmatchedPaymentSummary(),
        ).unwrap();
      } catch (_error) {
        result.unmatchedSummary = null;
      }

      return result;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to upload files",
      );
    }
  },
);

const paymentSlice = createSlice({
  name: "payments",
  initialState: {
    transactions: [],
    loading: false,
    error: null,
    uploadResult: null,
    unmatchedSummary: {
      pendingCount: 0,
      manualReviewCount: 0,
      recentRows: [],
    },
    unmatchedSummaryLoading: false,
    unmatchedSummaryError: null,
    reconcileResult: null,
  },

  reducers: {
    clearPaymentsError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchPayments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload || [];
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(fetchUnmatchedPaymentSummary.pending, (state) => {
        state.unmatchedSummaryLoading = true;
        state.unmatchedSummaryError = null;
      })
      .addCase(fetchUnmatchedPaymentSummary.fulfilled, (state, action) => {
        state.unmatchedSummaryLoading = false;
        state.unmatchedSummary = action.payload || {
          pendingCount: 0,
          manualReviewCount: 0,
          recentRows: [],
        };
      })
      .addCase(fetchUnmatchedPaymentSummary.rejected, (state, action) => {
        state.unmatchedSummaryLoading = false;
        state.unmatchedSummaryError = action.payload || action.error.message;
      })
      .addCase(uploadFiles.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.reconcileResult = null;
      })
      .addCase(uploadFiles.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.uploadResult = action.payload;
        if (action.payload?.unmatchedSummary) {
          state.unmatchedSummary = action.payload.unmatchedSummary;
        }
      })
      .addCase(uploadFiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(reconcileUnmatchedPaymentRows.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(reconcileUnmatchedPaymentRows.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.reconcileResult = action.payload;
        if (action.payload?.summary) {
          state.unmatchedSummary = action.payload.summary;
        }
      })
      .addCase(reconcileUnmatchedPaymentRows.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearPaymentsError } = paymentSlice.actions;

export default paymentSlice.reducer;

export const selectPaymentsFullState = (state) => state.payments;
export const selectPayments = (state) => state.payments.transactions;
