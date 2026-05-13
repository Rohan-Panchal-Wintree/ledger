import { configureStore } from "@reduxjs/toolkit";
// Import slices
import authReducer from "./slices/Auth.slice.js";

const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export default store;
