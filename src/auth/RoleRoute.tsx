import { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "./AuthContext.js";
import { ForbiddenPage } from "../components/ui/ForbiddenPage.js";
import { LoadingScreen } from "../components/ui/LoadingScreen.js";

interface RoleRouteProps {
  children: React.ReactNode;
  /** Required role. Currently only "MANAGER" is a gated role. */
  role: "MANAGER";
}

/**
 * Renders children only when the authenticated user has the required role.
 * Renders ForbiddenPage for authenticated users with insufficient role.
 */
export function RoleRoute({ children, role }: RoleRouteProps) {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("RoleRoute must be inside AuthProvider");
  const { state } = ctx;

  if (state.status === "bootstrapping") return <LoadingScreen />;
  if (state.status === "anonymous") return <Navigate to="/login" replace />;
  if (state.status === "workspaceRequired") {
    return <Navigate to="/select-workspace" replace />;
  }

  if (state.currentMembership.role !== role) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
