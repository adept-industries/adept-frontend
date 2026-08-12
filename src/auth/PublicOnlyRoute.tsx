import { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "./AuthContext.js";
import { LoadingScreen } from "../components/ui/LoadingScreen.js";

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const context = useContext(AuthContext);
  if (!context) throw new Error("PublicOnlyRoute must be inside AuthProvider");
  if (context.state.status === "bootstrapping") return <LoadingScreen />;
  if (context.state.status === "authenticated") return <Navigate to="/dashboard" replace />;
  if (context.state.status === "workspaceRequired") return <Navigate to="/select-workspace" replace />;
  return <>{children}</>;
}
