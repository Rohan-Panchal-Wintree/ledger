import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authApi } from "../../api";
import { decryptData, encryptData } from "../../utils/cryptoUtils";

const AUTH_STORAGE_KEY = "pg_user";

export const sendOtp = createAsyncThunk(
  "auth/sendOtp",
  async (email, { rejectWithValue }) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      const response = await authApi.post("/request-otp", {
        email: normalizedEmail,
      });

      return {
        email: normalizedEmail,
        message: response.data?.message || "OTP sent successfully",
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || "Failed to send OTP",
      );
    }
  },
);

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const response = await authApi.post("/verify-otp", {
        email: email.trim().toLowerCase(),
        otp,
      });

      const user = response.data?.user;
      const csrfToken = response.data?.csrfToken;

      if (!user) {
        throw new Error("No user data found");
      }

      const encryptedAuth = await encryptData({
        user,
        csrfToken,
      });

      localStorage.setItem(AUTH_STORAGE_KEY, encryptedAuth);

      return {
        user,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "OTP verification failed",
      );
    }
  },
);

export const getUserFromStorage = createAsyncThunk(
  "auth/getUserFromStorage",
  async (_, { rejectWithValue }) => {
    try {
      const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);

      if (!storedAuth) return null;

      const auth = await decryptData(storedAuth);

      return {
        user: auth?.user || null,
      };
    } catch (error) {
      localStorage.removeItem(AUTH_STORAGE_KEY);

      return rejectWithValue(
        error.message || "Failed to restore user from storage",
      );
    }
  },
);

export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      await authApi.post("/logout");

      localStorage.removeItem(AUTH_STORAGE_KEY);

      return true;
    } catch (error) {
      localStorage.removeItem(AUTH_STORAGE_KEY);

      return rejectWithValue(
        error.response?.data?.message || error.message || "Logout failed",
      );
    }
  },
);

const initialState = {
  currentUser: null,
  loading: false,
  error: null,
  otpSent: false,
  otpEmail: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,

  reducers: {
    setCurrentUser: (state, action) => {
      state.currentUser = action.payload;
    },

    clearAuthError: (state) => {
      state.error = null;
    },

    resetOtpState: (state) => {
      state.otpSent = false;
      state.otpEmail = null;
    },

    clearAuthState: (state) => {
      state.currentUser = null;
      state.loading = false;
      state.error = null;
      state.otpSent = false;
      state.otpEmail = null;

      localStorage.removeItem(AUTH_STORAGE_KEY);
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(sendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.otpSent = true;
        state.otpEmail = action.payload.email;
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.otpSent = false;
      })

      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload.user;
        state.error = null;
        state.otpSent = false;
        state.otpEmail = null;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(getUserFromStorage.pending, (state) => {
        state.loading = true;
      })
      .addCase(getUserFromStorage.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload?.user || null;
      })
      .addCase(getUserFromStorage.rejected, (state, action) => {
        state.loading = false;
        state.currentUser = null;
        state.error = action.payload;
      })

      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.currentUser = null;
        state.loading = false;
        state.error = null;
        state.otpSent = false;
        state.otpEmail = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.currentUser = null;
        state.loading = false;
        state.error = action.payload || "Logout failed";
        state.otpSent = false;
        state.otpEmail = null;
      });
  },
});

export const { setCurrentUser, clearAuthError, resetOtpState, clearAuthState } =
  authSlice.actions;

export default authSlice.reducer;

export const selectCurrentUser = (state) => state.auth.currentUser;
export const selectIsAuthenticated = (state) =>
  Boolean(state.auth.currentUser?.email);
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectOtpSent = (state) => state.auth.otpSent;
export const selectOtpEmail = (state) => state.auth.otpEmail;
