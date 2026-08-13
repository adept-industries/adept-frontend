import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError } from "../../../api/problem.js";
import { useAuth } from "../../../auth/AuthProvider.js";
import { AuthLayout } from "../../../components/layout/AuthLayout.js";
import { FormField } from "../../../components/ui/FormField.js";
import { InlineAlert } from "../../../components/ui/InlineAlert.js";
import { formatTimezone, getBrowserTimezone, listTimezones } from "../../../lib/timezone.js";
import { GoogleAuthButton } from "../components/GoogleAuthButton.js";

const TIME_ZONES = listTimezones();

function onboardingError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
  if (error.problem.code === "GOOGLE_SIGNUP_SESSION_INVALID") {
    return "Your Google signup session expired. Start again with Google.";
  }
  if (error.problem.code === "GOOGLE_ACCOUNT_CONFLICT") {
    return "An Adept account already uses this email. Sign in with your password.";
  }
  return error.problem.detail;
}

export function GoogleOnboardingPage() {
  const { actions } = useAuth();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState(getBrowserTimezone());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const next = await actions.completeGoogleOnboarding({ workspaceName, timezone });
      await navigate(
        next.status === "workspaceRequired" ? "/select-workspace" : "/dashboard",
        { replace: true },
      );
    } catch (caught) {
      setError(onboardingError(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Finish setting up Adept"
      description="Choose the workspace Google will sign you into."
    >
      <form
        id="google-onboarding-form"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}
      >
        {error && <InlineAlert message={error} />}

        <FormField
          id="google-workspace-name"
          label="Workspace name"
          type="text"
          autoComplete="organization"
          maxLength={160}
          required
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label
            htmlFor="google-timezone"
            style={{ fontWeight: 500, fontSize: "0.9rem", color: "var(--text-primary)" }}
          >
            Timezone
          </label>
          <select
            id="google-timezone"
            className="form-input"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
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
            {TIME_ZONES.map((zone) => (
              <option key={zone} value={zone}>{formatTimezone(zone)}</option>
            ))}
          </select>
        </div>

        <button type="submit" id="google-onboarding-submit" disabled={submitting}>
          {submitting ? "Creating workspace…" : "Create workspace"}
        </button>

        {error?.includes("Start again") && <GoogleAuthButton label="Start again with Google" />}

        <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Already have an Adept account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
