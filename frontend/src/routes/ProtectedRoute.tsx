import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { authStore } from "../store/auth-store";

interface ProtectedRouteProps {
  children: React.ReactElement;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, accessToken, initialise } = authStore();

  useEffect(() => {
    if (!user || !accessToken) {
      initialise();
    }
  }, [user, accessToken, initialise]);

  if (!user || !accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
