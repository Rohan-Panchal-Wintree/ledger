import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authApi } from "../../api";
import { decryptData, encryptData } from "../../utils/cryptoUtils";

// Thunks
export const sendOtp = createAsyncThunk(
  "auth/sendOtp",
  async (email, { rejectWithValue }) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      const response = await authApi.post("/request-otp", {
        email: normalizedEmail,
      });

      console.log("response", response);

      return {
        email: normalizedEmail,
        message: response.data?.message || "OTP sent successfully",
        data: response.data,
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
      console.log("email", email);
      console.log("otp", otp);

      const response = await authApi.post("/verify-otp", {
        email,
        otp,
      });

      const user = response.data?.user;
      const accessToken = response.data?.accessToken;
      const refreshToken = response.data?.refreshToken;

      if (!user) {
        throw new Error("No user data found");
      }

      const encryptedUser = await encryptData({
        user,
        accessToken,
        refreshToken,
      });
      localStorage.setItem("pg_user", encryptedUser);

      return {
        user: response.data?.user,
        accessToken,
        refreshToken,
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
      const storedUser = localStorage.getItem("pg_user");

      if (!storedUser) return null;

      const user = await decryptData(storedUser);

      return user;
    } catch (error) {
      localStorage.removeItem("pg_user");
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
      localStorage.removeItem("pg_user");
      return true;
    } catch (error) {
      localStorage.removeItem("pg_user");
      return rejectWithValue(error.message || "Logout failed");
    }
  },
);

const initialState = {
  currentUser: null,
  accessToken: null,
  refreshToken: null,
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
      state.otpEmail = "";
    },
  },
  extraReducers: (builder) => {
    builder
      // sendOtp
      .addCase(sendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.otpSent = true;
        state.otpEmail = action.payload.email;

        console.log("state from state", state.otpSent);
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.otpSent = false;
      })

      // verifyOtp
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload.user;
        state.accessToken = action.payload.accessToken || null;
        state.refreshToken = action.payload.refreshToken || null;
        state.error = null;
        state.otpSent = false;
        state.otpEmail = "";
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // getUserFromStorage
      .addCase(getUserFromStorage.pending, (state) => {
        state.loading = true;
      })
      .addCase(getUserFromStorage.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload?.user || null;
        state.accessToken = action.payload?.accessToken || null;
        state.refreshToken = action.payload?.refreshToken || null;
      })
      .addCase(getUserFromStorage.rejected, (state, action) => {
        state.loading = false;
        state.currentUser = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.error = action.payload;
      })

      // logoutUser
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.currentUser = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.loading = false;
        state.error = null;
        state.otpSent = false;
        state.otpEmail = "";
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.currentUser = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.loading = false;
        state.error = action.payload || "Logout failed";
        state.otpSent = false;
        state.otpEmail = "";
      });
  },
});

// Actions
export const { setCurrentUser } = authSlice.actions;

// Reducer
export default authSlice.reducer;

// Selectors
export const selectCurrentUser = (state) => state.auth.currentUser;
export const selectAccessToken = (state) => state.auth.accessToken;
export const selectIsAuthenticated = (state) =>
  Boolean(state.auth.currentUser?.email);
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectOtpSent = (state) => state.auth.otpSent;
export const selectOtpEmail = (state) => state.auth.otpEmail;
