import { type FormEvent, useState } from "react";
import { useLocation } from "react-router";
import { AuthLayout } from "../../../components/layout/AuthLayout";
import { FormField } from "../../../components/ui/FormField";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { resendVerification } from "../api";

export function CheckEmailPage() {
  const location = useLocation();
  // The email may arrive as transient router state (never persisted).
  const stateEmail = (location.state as { email?: string } | null)?.email ?? "";

  const [email, setEmail] = useState(stateEmail);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleResend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const requestedEmail = email;
    if (!stateEmail) setEmail("");
    try {
      await resendVerification(requestedEmail);
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Check your email"
      description="We sent you a verification link. Click it to activate your account."
    >
      {sent ? (
        <InlineAlert
          kind="success"
          message="Verification email sent! Check your inbox and spam folder."
        />
      ) : (
        <form
          id="resend-form"
          onSubmit={(e: FormEvent<HTMLFormElement>) => void handleResend(e)}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {error && <InlineAlert message={error} />}

          {!stateEmail && (
            <FormField
              id="resend-email"
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}

          {stateEmail && (
            <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "0.95rem" }}>
              Sent to <strong>{stateEmail}</strong>
            </p>
          )}

          <button
            type="submit"
            id="resend-submit"
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Resend verification email"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
