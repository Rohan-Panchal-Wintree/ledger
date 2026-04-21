import { configureStore } from "@reduxjs/toolkit";
// Import slices
import authReducer from "./slices/Auth.slice.js";
import paymentReducer from "./slices/Payments.slice.js";

const store = configureStore({
  reducer: {
    auth: authReducer,
    payments: paymentReducer,
  },
});

export default store;
