import { type FormEvent, useContext, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AuthLayout } from "../../../components/layout/AuthLayout";
import { FormField } from "../../../components/ui/FormField";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { AuthContext } from "../../../auth/AuthContext";
import { ApiError } from "../../../api/problem";

export function LoginPage() {
  const ctx = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = getSafeRedirect((location.state as { from?: Location } | null)?.from);
  const deletionRequested = new URLSearchParams(location.search).get("deleted") === "1";
  const passwordReset = new URLSearchParams(location.search).get("reset") === "1";
  const ambiguousSession = ctx?.state.status === "anonymous" && ctx.state.ambiguousSession;
  const sessionNotice = ctx?.state.status === "anonymous" ? ctx.state.notice : undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const credentials = { email, password };
    setPassword("");
    try {
      const next = await ctx?.actions.login(credentials);
      if (next?.status === "workspaceRequired") {
        await navigate("/select-workspace", { replace: true });
      } else {
        await navigate(from ?? "/dashboard", { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.problem.code === "EMAIL_NOT_VERIFIED") {
          await navigate("/check-email", { state: { email } });
          return;
        }
        setError("The email or password is incorrect.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Sign in to Adept">
      <form
        id="login-form"
        onSubmit={(e: FormEvent<HTMLFormElement>) => void handleSubmit(e)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}
      >
        {deletionRequested && (
          <InlineAlert kind="success" message="Workspace deletion was requested and access stopped immediately." />
        )}
        {passwordReset && (
          <InlineAlert kind="success" message="Password reset completed. Sign in with your new password." />
        )}
        {ambiguousSession && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <InlineAlert message="A previous session update had an uncertain result. Sign in to recover it, or clear the browser session." />
            <button type="button" onClick={() => void ctx.actions.logout()}>
              Clear browser session
            </button>
          </div>
        )}
        {!ambiguousSession && sessionNotice && (
          <InlineAlert message={sessionNotice} />
        )}
        {error && <InlineAlert message={error} />}

        <FormField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <label
              htmlFor="login-password"
              style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              style={{ fontSize: "0.85rem", color: "#4763d8" }}
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border-color)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              fontSize: "1rem",
              outline: "none",
            }}
          />
        </div>

        <button
          type="submit"
          id="login-submit"
          className="premium-btn"
          disabled={submitting}
          style={{
            padding: "0.85rem",
            borderRadius: "0.5rem",
            color: "#ffffff",
            border: "none",
            fontWeight: 600,
            letterSpacing: "0.02em",
            fontSize: "1.05rem",
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          New to Adept?{" "}
          <Link to="/signup" style={{ color: "var(--primary-color)", fontWeight: 600 }}>
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

/** Accept only same-origin, non-external redirects from router state. */
function getSafeRedirect(from: Location | undefined): string | null {
  if (!from) return null;
  try {
    const url = new URL(from.pathname + (from.search ?? ""), window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const path = url.pathname;
    // Reject double-slash, backslash, and non-leading-slash.
    // eslint-disable-next-line no-control-regex
    if (!path.startsWith("/") || /^\/\/|\\|[\u0000-\u001f]/.test(path)) return null;
    return path + (from.search ?? "");
  } catch {
    return null;
  }
}
