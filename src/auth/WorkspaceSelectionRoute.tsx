import { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "./AuthContext.js";
import { LoadingScreen } from "../components/ui/LoadingScreen.js";

export function WorkspaceSelectionRoute({ children }: { children: React.ReactNode }) {
  const context = useContext(AuthContext);
  if (!context) throw new Error("WorkspaceSelectionRoute must be inside AuthProvider");
  if (context.state.status === "bootstrapping") return <LoadingScreen />;
  if (context.state.status === "anonymous") return <Navigate to="/login" replace />;
  if (context.state.status === "authenticated") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
