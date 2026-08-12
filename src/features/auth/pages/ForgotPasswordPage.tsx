import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { AuthLayout } from "../../../components/layout/AuthLayout";
import { FormField } from "../../../components/ui/FormField";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { forgotPassword } from "../api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const requestedEmail = email;
    setEmail("");
    try {
      await forgotPassword(requestedEmail);
    } finally {
      // Always show the same success message regardless of whether the account exists.
      setSubmitted(true);
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout title="Check your email">
        <InlineAlert
          kind="success"
          message="If an account exists for that email, we've sent a password reset link. Check your inbox and spam folder."
        />
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem" }}>
          <Link to="/login" style={{ fontWeight: 600 }}>
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email and we'll send a reset link."
    >
      <form
        id="forgot-form"
        onSubmit={(e: FormEvent<HTMLFormElement>) => void handleSubmit(e)}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <FormField
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          type="submit"
          id="forgot-submit"
          disabled={submitting}
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>

        <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem" }}>
          <Link to="/login" style={{ fontWeight: 600 }}>
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
