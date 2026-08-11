import type { ReactNode } from "react";
import { useContext } from "react";
import { Link } from "react-router";
import { AuthContext } from "../../auth/AuthContext.js";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const ctx = useContext(AuthContext);
  const state = ctx?.state;
  const displayName =
    state?.status === "authenticated" ? state.user.displayName : "";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          padding: "0 1.5rem",
          height: "3.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          to="/dashboard"
          aria-label="Dashboard"
          style={{
            fontWeight: 800,
            fontSize: "1.1rem",
            color: "#4763d8",
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          adept
        </Link>
        {displayName && (
          <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>{displayName}</span>
        )}
      </header>
      <main style={{ flex: 1, padding: "2rem 1.5rem" }}>{children}</main>
    </div>
  );
}
