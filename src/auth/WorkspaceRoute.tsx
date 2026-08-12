import { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "./AuthContext.js";
import { LoadingScreen } from "../components/ui/LoadingScreen.js";

/**
 * Redirects to /select-workspace when a workspace hasn't been selected yet.
 */
export function WorkspaceRoute({ children }: { children: React.ReactNode }) {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("WorkspaceRoute must be inside AuthProvider");
  const { state } = ctx;

  if (state.status === "bootstrapping") return <LoadingScreen />;
  if (state.status === "anonymous") return <Navigate to="/login" replace />;
  if (state.status === "workspaceRequired") {
    return <Navigate to="/select-workspace" replace />;
  }

  return <>{children}</>;
}
