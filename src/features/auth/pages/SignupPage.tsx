import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../../../components/layout/AuthLayout";
import { FormField } from "../../../components/ui/FormField";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { useAuth } from "../../../auth/AuthProvider";
import { ApiError } from "../../../api/problem";

// All IANA time zones supported by the browser runtime.
const TIME_ZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
})();

const DEFAULT_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
})();

export function SignupPage() {
  const { actions } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_TZ);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const request = { email, password, displayName, workspaceName, timezone };
    setPassword("");
    try {
      await actions.signup(request);
      await navigate("/check-email", { state: { email } });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problem.detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      description="Start your workspace and invite your team later."
    >
      <form
        id="signup-form"
        onSubmit={(e: FormEvent<HTMLFormElement>) => void handleSubmit(e)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}
      >
        {error && <InlineAlert message={error} />}

        <FormField
          id="signup-email"
          label="Work email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <FormField
          id="signup-display-name"
          label="Full name"
          type="text"
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <FormField
          id="signup-workspace-name"
          label="Workspace name"
          type="text"
          autoComplete="organization"
          required
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
        />

        <FormField
          id="signup-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          hint={
            <>
              At least 12 characters. Maximum 72 UTF-8 bytes.
            </>
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label
            htmlFor="signup-timezone"
            style={{ fontWeight: 500, fontSize: "0.9rem", color: "var(--text-primary)" }}
          >
            Timezone
          </label>
          <select
            id="signup-timezone"
            className="form-input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border-color)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              fontSize: "1rem",
              outline: "none",
            }}
          >
            {TIME_ZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          id="signup-submit"
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
          {submitting ? "Creating account…" : "Create account"}
        </button>

        <p style={{ margin: 0, textAlign: "center", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--primary-color)", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
