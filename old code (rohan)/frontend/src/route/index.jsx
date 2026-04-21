import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import Login from "../pages/Login";
import NotFound from "../pages/NotFound";
import Reports from "../pages/Reports";
import ErrorBoundary from "../component/ErrorBoundary";
import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import ProtectedRoutes from "../utils/ProtectedRoutes";
import Unauthorized from "../pages/Unauthorized";
import Upload from "../pages/Upload";
import ManageEmails from "../pages/ManageEmails";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoutes allowedRoles={["admin", "merchant"]}>
        <App />
      </ProtectedRoutes>
    ),
    // errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoutes allowedRoles={["admin", "merchant"]}>
            <Dashboard />
          </ProtectedRoutes>
        ),
      },
      {
        path: "reports",
        element: (
          <ProtectedRoutes allowedRoles={["admin"]}>
            <Reports />
          </ProtectedRoutes>
        ),
      },
      {
        path: "upload",
        element: (
          <ProtectedRoutes allowedRoles={["admin"]}>
            <Upload />
          </ProtectedRoutes>
        ),
      },
      {
        path: "manage-emails",
        element: (
          <ProtectedRoutes allowedRoles={["admin"]}>
            <ManageEmails />
          </ProtectedRoutes>
        ),
      },
      {
        path: "profile",
        element: (
          <ProtectedRoutes allowedRoles={["admin", "merchant"]}>
            <Profile />
          </ProtectedRoutes>
        ),
      },
    ],
  },

  // ✅ LOGIN PAGE
  {
    path: "/login",
    element: <Login />,
  },

  // ✅ UNAUTHORIZED
  {
    path: "/unauthorized",
    element: <Unauthorized />,
  },

  // ✅ CATCH ALL (NOT FOUND)
  {
    path: "*",
    element: <NotFound />,
  },
]);

export default router;
