import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AuthLayout } from "../../../components/layout/AuthLayout.js";
import { InlineAlert } from "../../../components/ui/InlineAlert.js";
import { verifyEmail } from "../api.js";
import { hasActionToken, submitActionToken } from "../actionTokenHandoff.js";

type VerifyState = "verifying" | "success" | "invalid" | "no-token";

export function VerifyEmailPage() {
  const [verifyState, setVerifyState] = useState<VerifyState>(() =>
    hasActionToken("verify-email") ? "verifying" : "no-token",
  );

  useEffect(() => {
    const submission = submitActionToken("verify-email", verifyEmail);
    if (!submission) return;
    void submission.then(
      () => setVerifyState("success"),
      () => setVerifyState("invalid"),
    );
  }, []);

  return (
    <AuthLayout title="Verify your email">
      {verifyState === "verifying" && <p style={{ textAlign: "center" }}>Verifying your email…</p>}
      {verifyState === "success" && (
        <>
          <InlineAlert kind="success" message="Your email has been verified. You can now sign in." />
          <p style={{ margin: 0, textAlign: "center" }}><Link to="/login">Sign in</Link></p>
        </>
      )}
      {verifyState === "invalid" && (
        <>
          <InlineAlert message="This verification link is invalid or has expired." />
          <p style={{ margin: 0, textAlign: "center" }}><Link to="/check-email">Request a new link</Link></p>
        </>
      )}
      {verifyState === "no-token" && (
        <>
          <InlineAlert message="No verification token found. Please use the link from your email." />
          <p style={{ margin: 0, textAlign: "center" }}><Link to="/check-email">Request a new link</Link></p>
        </>
      )}
    </AuthLayout>
  );
}
