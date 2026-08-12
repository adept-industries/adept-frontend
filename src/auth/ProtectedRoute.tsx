import { useContext } from "react";
import { Navigate, useLocation } from "react-router";
import { AuthContext } from "./AuthContext.js";
import { LoadingScreen } from "../components/ui/LoadingScreen.js";

/**
 * Wraps routes that require the user to be authenticated.
 * - bootstrapping → renders LoadingScreen
 * - anonymous / ambiguousSession → redirects to /login, preserving intended location
 * - workspaceRequired → redirects to /select-workspace
 * - authenticated → renders children
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("ProtectedRoute must be inside AuthProvider");
  const location = useLocation();
  const { state } = ctx;

  if (state.status === "bootstrapping") {
    return <LoadingScreen />;
  }

  if (state.status === "anonymous") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (state.status === "workspaceRequired") {
    return <Navigate to="/select-workspace" replace />;
  }

  return <>{children}</>;
}
