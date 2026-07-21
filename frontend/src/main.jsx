import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import router from "./route/index.jsx";
import toast, { Toaster } from "react-hot-toast";
import store from "./store/index.js";
import { getUserFromStorage } from "./store/slices/Auth.slice.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const isDev = import.meta.env.DEV;

store.dispatch(getUserFromStorage());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
      onError: (error) => {
        if (isDev) {
          toast.error(
            `Query Error: ${error.message || "Something went wrong"}`,
          );
        }
      },
    },
    mutations: {
      onError: (error) => {
        if (isDev) {
          toast.error(
            `Mutation Error: ${error.message || "Something went wrong"}`,
          );
        }
      },
    },
  },
});

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={12}
        toastOptions={{
          duration: 3000,
          className: "toast-base",
          success: {
            className: "toast-base toast-success",
          },
          error: {
            className: "toast-base toast-error",
          },
          loading: {
            className: "toast-base toast-loading",
          },
        }}
      />
      <RouterProvider router={router} />
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  </Provider>,
);
