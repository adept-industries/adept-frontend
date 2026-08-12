import { createBrowserRouter } from "react-router";
import { ProtectedRoute } from "../auth/ProtectedRoute.js";
import { CheckEmailPage } from "../features/auth/pages/CheckEmailPage.js";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage.js";
import { LoginPage } from "../features/auth/pages/LoginPage.js";
import { ResetPasswordPage } from "../features/auth/pages/ResetPasswordPage.js";
import { SignupPage } from "../features/auth/pages/SignupPage.js";
import { VerifyEmailPage } from "../features/auth/pages/VerifyEmailPage.js";
import { AppShell } from "../components/layout/AppShell.js";
import { NotFoundPage } from "../components/ui/NotFoundPage.js";

/**
 * Dashboard placeholder — Phase G will replace this with the real workspace UI.
 */
function DashboardPlaceholder() {
  return (
    <AppShell>
      <section className="card" aria-labelledby="dash-title">
        <p className="eyebrow">Phase 2</p>
        <h1 id="dash-title">Dashboard</h1>
        <p>You're authenticated. Workspace UI arrives in Phase 2 PR 2.</p>
      </section>
    </AppShell>
  );
}

/**
 * Router is created once outside React state to avoid recreation on re-renders.
 */
export const router = createBrowserRouter([
  // ── Public account pages ──────────────────────────────────────────────────
  { path: "/signup", element: <SignupPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/check-email", element: <CheckEmailPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },

  // ── Root redirect ─────────────────────────────────────────────────────────
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardPlaceholder />
      </ProtectedRoute>
    ),
  },

  // ── Protected dashboard ───────────────────────────────────────────────────
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardPlaceholder />
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard/settings",
    element: (
      <ProtectedRoute>
        <DashboardPlaceholder />
      </ProtectedRoute>
    ),
  },

  // ── Workspace selection (Part G) ─────────────────────────────────────────
  {
    path: "/select-workspace",
    element: <LoginPage />, // Temporary — Part G replaces this.
  },

  // ── Catch-all ─────────────────────────────────────────────────────────────
  { path: "*", element: <NotFoundPage /> },
]);
