import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import Login from "../pages/Login";
import NotFound from "../pages/NotFound";
import Reports from "../pages/Reports";
import ErrorBoundary from "../component/ErrorBoundary";
import Dashboard from "../pages/Dashboard";
import Merchants from "../pages/Merchants";
import Acquirers from "../pages/Acquirers";
import Profile from "../pages/Profile";
import ProtectedRoutes from "../utils/ProtectedRoutes";
import Unauthorized from "../pages/Unauthorized";
import Upload from "../pages/Upload";
import ManageEmails from "../pages/ManageEmails";
import Sheets from "../pages/Sheets.jsx";
import Miscellaneous from "../pages/Miscellaneous";
import ReportDetail from "../pages/ReportDetail";
import MerchantSettlement from "../pages/MerchantSettlement.jsx";

const authenticatedRoles = [
  "admin",
  "finance",
  "settlement",
  "merchant",
  "support",
];

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoutes allowedRoles={authenticatedRoles}>
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
          <ProtectedRoutes allowedRoles={authenticatedRoles}>
            <Dashboard />
          </ProtectedRoutes>
        ),
      },
      {
        path: "merchants",
        element: (
          <ProtectedRoutes
            allowedRoles={["admin", "settlement", "finance", "support"]}
          >
            <Merchants />
          </ProtectedRoutes>
        ),
      },
      {
        path: "acquirers",
        element: (
          <ProtectedRoutes
            allowedRoles={["admin", "finance", "settlement", "support"]}
          >
            <Acquirers />
          </ProtectedRoutes>
        ),
      },
      {
        path: "reports",
        element: (
          <ProtectedRoutes
            allowedRoles={["admin", "settlement", "finance", "support"]}
          >
            <Reports />
          </ProtectedRoutes>
        ),
      },
      {
        path: "upload",
        element: (
          <ProtectedRoutes
            allowedRoles={["admin", "settlement", "finance", "support"]}
          >
            <Upload />
          </ProtectedRoutes>
        ),
      },
      {
        path: "merchant-settlement",
        element: (
          <ProtectedRoutes allowedRoles={["admin", "support", "settlement"]}>
            <MerchantSettlement />
          </ProtectedRoutes>
        ),
      },
      {
        path: "miscellaneous",
        element: (
          <ProtectedRoutes allowedRoles={["admin", "settlement", "finance"]}>
            <Miscellaneous />
          </ProtectedRoutes>
        ),
      },
      {
        path: "sheets",
        element: (
          <ProtectedRoutes allowedRoles={["admin", "settlement", "finance"]}>
            <Sheets />
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
          <ProtectedRoutes allowedRoles={authenticatedRoles}>
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
