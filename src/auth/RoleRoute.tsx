import { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "./AuthContext.js";
import { ForbiddenPage } from "../components/ui/ForbiddenPage.js";
import { LoadingScreen } from "../components/ui/LoadingScreen.js";
import type { MembershipSummary } from "./types.js";

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: readonly MembershipSummary["role"][];
}

/**
 * Renders children only when the authenticated user has the required role.
 * Renders ForbiddenPage for authenticated users with insufficient role.
 */
export function RoleRoute({ children, allowedRoles }: RoleRouteProps) {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("RoleRoute must be inside AuthProvider");
  const { state } = ctx;

  if (state.status === "bootstrapping") return <LoadingScreen />;
  if (state.status === "anonymous") {
    return <Navigate to={state.deletionRequested ? "/login?deleted=1" : "/login"} replace />;
  }
  if (state.status === "workspaceRequired") {
    return <Navigate to="/select-workspace" replace />;
  }

  if (!allowedRoles.includes(state.currentMembership.role)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
