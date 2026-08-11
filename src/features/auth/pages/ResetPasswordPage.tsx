import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../../../components/layout/AuthLayout";
import { FormField } from "../../../components/ui/FormField";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { captureActionToken, consumeActionToken, hasActionToken } from "../actionTokenHandoff";
import { resetPassword } from "../api";
import { ApiError } from "../../../api/problem";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  // Token is stored in the module closure — never in state.
  const tokenCaptured = useRef(false);
  const [hasToken, setHasToken] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tokenCaptured.current) return;
    tokenCaptured.current = true;
    captureActionToken();
    setHasToken(hasActionToken());
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const token = consumeActionToken();
    if (!token) {
      setError("Reset token is missing or already used. Please request a new link.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ token, newPassword });
      await navigate("/login", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.problem.code === "ACTION_TOKEN_INVALID") {
          setError("This reset link is invalid or has expired. Please request a new one.");
        } else {
          setError(err.problem.detail);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
      setHasToken(false); // Token consumed — don't allow re-use.
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasToken) {
    return (
      <AuthLayout title="Reset your password">
        <InlineAlert message="No reset token found or the link has already been used." />
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem" }}>
          <Link to="/forgot-password" style={{ color: "#4763d8", fontWeight: 600 }}>
            Request a new link
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      description="Your new password will replace the old one immediately."
    >
      <form
        id="reset-form"
        onSubmit={(e: FormEvent<HTMLFormElement>) => void handleSubmit(e)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        {error && <InlineAlert message={error} />}

        <FormField
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 12 characters. Maximum 72 UTF-8 bytes."
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button
          type="submit"
          id="reset-submit"
          disabled={submitting}
          style={{
            padding: "0.7rem",
            borderRadius: "0.4rem",
            background: "#4763d8",
            color: "#fff",
            border: "none",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </AuthLayout>
  );
}
