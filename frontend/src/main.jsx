import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import router from "./route/index.jsx";
import { Toaster } from "react-hot-toast";
import store from "./store/index.js";
import { getUserFromStorage } from "./store/slices/Auth.slice.js";

store.dispatch(getUserFromStorage());

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <Toaster reverseOrder={false} />
    <RouterProvider router={router} />
  </Provider>,
);
