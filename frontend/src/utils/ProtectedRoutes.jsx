import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

import {
  selectAuthLoading,
  selectCurrentUser,
  selectIsAuthenticated,
} from "../store/slices/Auth.slice";

import Spinner from "../component/UI/Spinner";

function ProtectedRoutes({ children, allowedRoles = [] }) {
  const location = useLocation();

  const currentUser = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAuthLoading = useSelector(selectAuthLoading);

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner type="xl" />
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export default ProtectedRoutes;
