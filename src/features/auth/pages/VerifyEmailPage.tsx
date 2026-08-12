import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AuthLayout } from "../../../components/layout/AuthLayout";
import { InlineAlert } from "../../../components/ui/InlineAlert";
import { captureActionToken, consumeActionToken } from "../actionTokenHandoff";
import { verifyEmail } from "../api";
import { ApiError } from "../../../api/problem";

type VerifyState =
  | "verifying"
  | "success"
  | "invalid"
  | "no-token";

export function VerifyEmailPage() {
  const [verifyState, setVerifyState] = useState<VerifyState>("verifying");
  // Guard against React StrictMode double-invoke.
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;

    // Capture and scrub the fragment before any render side-effects.
    captureActionToken();
    const token = consumeActionToken();

    if (!token) {
      setVerifyState("no-token");
      return;
    }

    submitted.current = true;

    void (async () => {
      try {
        await verifyEmail(token);
        setVerifyState("success");
      } catch (err) {
        if (err instanceof ApiError && err.problem.code === "ACTION_TOKEN_INVALID") {
          setVerifyState("invalid");
        } else {
          setVerifyState("invalid");
        }
      }
    })();
  }, []);

  return (
    <AuthLayout title="Verify your email">
      {verifyState === "verifying" && (
        <p style={{ textAlign: "center", color: "#6b7280" }}>Verifying your email…</p>
      )}

      {verifyState === "success" && (
        <>
          <InlineAlert kind="success" message="Your email has been verified. You can now sign in." />
          <p style={{ margin: 0, textAlign: "center" }}>
            <Link to="/login" style={{ color: "#4763d8", fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </>
      )}

      {verifyState === "invalid" && (
        <>
          <InlineAlert message="This verification link is invalid or has expired." />
          <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem" }}>
            <Link to="/check-email" style={{ color: "#4763d8", fontWeight: 600 }}>
              Request a new link
            </Link>
          </p>
        </>
      )}

      {verifyState === "no-token" && (
        <>
          <InlineAlert message="No verification token found. Please use the link from your email." />
          <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem" }}>
            <Link to="/check-email" style={{ color: "#4763d8", fontWeight: 600 }}>
              Request a new link
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
