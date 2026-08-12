import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError } from "../../../api/problem.js";
import { useAuth } from "../../../auth/AuthProvider.js";
import { AuthLayout } from "../../../components/layout/AuthLayout.js";
import { FormField } from "../../../components/ui/FormField.js";
import { InlineAlert } from "../../../components/ui/InlineAlert.js";
import { hasActionToken, submitActionToken } from "../actionTokenHandoff.js";

export function ResetPasswordPage() {
  const { actions } = useAuth();
  const navigate = useNavigate();
  const [tokenAvailable, setTokenAvailable] = useState(() => hasActionToken("reset-password"));
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const password = newPassword;
    setNewPassword("");

    const submission = submitActionToken(
      "reset-password",
      (token) => actions.resetPassword({ token, newPassword: password }),
      (submissionError) =>
        submissionError instanceof ApiError && submissionError.problem.code === "VALIDATION_FAILED",
    );
    if (!submission) {
      setTokenAvailable(false);
      setSubmitting(false);
      return;
    }

    try {
      await submission;
      await navigate("/login?reset=1", { replace: true });
    } catch (submissionError) {
      if (submissionError instanceof ApiError && submissionError.problem.code === "VALIDATION_FAILED") {
        setError(submissionError.problem.fieldErrors?.[0]?.message ?? submissionError.problem.detail);
        setTokenAvailable(true);
      } else if (submissionError instanceof ApiError && submissionError.problem.code === "ACTION_TOKEN_INVALID") {
        setError("This reset link is invalid or has expired. Please request a new one.");
        setTokenAvailable(false);
      } else {
        setError("The password could not be reset safely. Please request a new link.");
        setTokenAvailable(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!tokenAvailable) {
    return (
      <AuthLayout title="Reset your password">
        <InlineAlert message={error ?? "No reset token found or the link has already been used."} />
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem" }}>
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" description="Your new password replaces the old one immediately.">
      <form onSubmit={(event) => void handleSubmit(event)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {error && <InlineAlert message={error} />}
        <FormField
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 12 characters. Maximum 72 UTF-8 bytes."
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <button type="submit" id="reset-submit" disabled={submitting}>
          {submitting ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </AuthLayout>
  );
}
