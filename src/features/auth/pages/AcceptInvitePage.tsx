import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError } from "../../../api/problem.js";
import { useAuth } from "../../../auth/AuthProvider.js";
import { AuthLayout } from "../../../components/layout/AuthLayout.js";
import { FormField } from "../../../components/ui/FormField.js";
import { InlineAlert } from "../../../components/ui/InlineAlert.js";
import { getActionToken } from "../actionTokenHandoff.js";
import {
  acceptInvitation,
  previewInvitation,
  type InvitationPreviewResponse,
} from "../../members/api.js";
import { AuthDivider, GoogleAuthButton } from "../components/GoogleAuthButton.js";

type AcceptPageState = "loading" | "valid" | "expired" | "invalid" | "no-token";

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { state: authState } = useAuth();

  // Extract raw token from hash fragment (#token=XYZ), query param (?token=XYZ), or actionTokenHandoff
  const [token] = useState<string | null>(() => {
    const fromHandoff = getActionToken("accept-invite");
    if (fromHandoff) return fromHandoff;

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const tokenFromHash = hashParams.get("token");
    if (tokenFromHash) return tokenFromHash;

    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("token");
  });

  const [pageState, setPageState] = useState<AcceptPageState>(() =>
    token ? "loading" : "no-token"
  );
  const [preview, setPreview] = useState<InvitationPreviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setPageState("no-token");
      return;
    }

    let active = true;
    const fetchPreview = async () => {
      try {
        setPageState("loading");
        const data = await previewInvitation(token);
        if (active) {
          setPreview(data);
          setPageState("valid");
        }
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof ApiError) {
          if (err.problem.code === "INVITATION_EXPIRED") {
            setPageState("expired");
          } else {
            setPageState("invalid");
          }
          setErrorMessage(err.problem.detail);
        } else {
          setPageState("invalid");
          setErrorMessage("The invitation preview could not be loaded.");
        }
      }
    };

    void fetchPreview();
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    setErrorMessage(null);

    // Validation for new accounts
    if (preview && !preview.existingAccount) {
      if (!displayName.trim()) {
        setErrorMessage("Please enter your display name.");
        return;
      }
      if (password.length < 12) {
        setErrorMessage("Password must be at least 12 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await acceptInvitation({
        token,
        displayName: displayName.trim() || undefined,
        password: password || undefined,
      });

      if (result.kind === "authenticated") {
        await navigate("/dashboard", { replace: true });
      } else {
        await navigate("/select-workspace", { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.problem.code === "INVITATION_EXPIRED") {
          setPageState("expired");
        }
        setErrorMessage(err.problem.fieldErrors?.[0]?.message ?? err.problem.detail);
      } else {
        setErrorMessage("Invitation acceptance failed. Please try again or request a new link.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── No token found ──
  if (pageState === "no-token") {
    return (
      <AuthLayout title="Accept workspace invitation">
        <InlineAlert message="No invitation token found. Please open the link directly from your invitation email." />
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem" }}>
          <Link to="/login">Go to Sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  // ── Loading preview ──
  if (pageState === "loading") {
    return (
      <AuthLayout title="Accept workspace invitation">
        <p style={{ textAlign: "center", color: "var(--text-secondary)", margin: 0 }}>
          Loading invitation details…
        </p>
      </AuthLayout>
    );
  }

  // ── Expired invitation ──
  if (pageState === "expired") {
    return (
      <AuthLayout title="Invitation expired">
        <InlineAlert message={errorMessage ?? "This invitation link has expired. Please contact your workspace Manager to request a new invitation."} />
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem" }}>
          <Link to="/login">Go to Sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  // ── Invalid invitation ──
  if (pageState === "invalid") {
    return (
      <AuthLayout title="Invalid invitation">
        <InlineAlert message={errorMessage ?? "This invitation link is invalid, has already been accepted, or was revoked."} />
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.875rem" }}>
          <Link to="/login">Go to Sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  // ── Valid Preview & Accept Form ──
  const isCurrentlySameUser =
    authState.status === "authenticated" &&
    preview?.existingAccount &&
    authState.user.email.toLowerCase() === preview.email.toLowerCase();

  return (
    <AuthLayout
      title="Join Workspace"
      description={`You've been invited to join ${preview?.workspaceName ?? "a workspace"} as a repository Lead.`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Invitation Summary Card */}
        {preview && (
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "0.5rem",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              fontSize: "0.875rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Workspace:</span>
              <strong style={{ color: "var(--text-primary)" }}>{preview.workspaceName}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Role:</span>
              <span
                style={{
                  padding: "0.15rem 0.5rem",
                  borderRadius: "0.25rem",
                  background: "rgba(129, 140, 248, 0.15)",
                  color: "var(--primary-light, #818cf8)",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                }}
              >
                {preview.role}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-secondary)" }}>Invited Email:</span>
              <span style={{ color: "var(--text-primary)" }}>{preview.email}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>Assigned Repositories:</span>
              {preview.repositories && preview.repositories.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text-primary)" }}>
                  {preview.repositories.map((repo) => (
                    <li key={repo} style={{ fontSize: "0.825rem" }}>
                      <code>{repo}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <span style={{ color: "var(--text-secondary)", fontStyle: "italic", fontSize: "0.825rem" }}>
                  All workspace repositories
                </span>
              )}
            </div>
            {preview.expiresAt && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem", fontSize: "0.775rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Expires:</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {new Date(preview.expiresAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}

        {errorMessage && <InlineAlert message={errorMessage} />}

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {preview?.existingAccount ? (
            isCurrentlySameUser ? (
              <>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  You are currently signed in as <strong>{preview.email}</strong>. Click below to accept the invitation.
                </p>
                <button type="submit" id="accept-invite-submit" disabled={submitting} style={{ marginTop: "0.5rem" }}>
                  {submitting ? "Accepting…" : "Accept & Join Workspace"}
                </button>
              </>
            ) : preview.hasPassword === false ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                  An Adept account with email <strong>{preview.email}</strong> exists and was registered with Google. Sign in with Google to verify your identity and accept this invitation:
                </p>
                <div
                  onClick={() => {
                    if (token) {
                      sessionStorage.setItem(
                        "adept_post_auth_redirect",
                        `/accept-invite?token=${encodeURIComponent(token)}`
                      );
                    }
                  }}
                >
                  <GoogleAuthButton label="Sign in with Google to Accept" />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p style={{ margin: "0 0 1rem 0", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                    An Adept account with email <strong>{preview.email}</strong> exists. Enter your password to verify your identity and accept the invitation:
                  </p>
                  <FormField
                    id="accept-password"
                    label="Password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" id="accept-invite-submit" disabled={submitting} style={{ marginTop: "0.5rem" }}>
                  {submitting ? "Accepting…" : "Accept & Join Workspace"}
                </button>
              </>
            )
          ) : (
            <>
              <div
                onClick={() => {
                  if (token) {
                    sessionStorage.setItem(
                      "adept_post_auth_redirect",
                      `/accept-invite?token=${encodeURIComponent(token)}`
                    );
                  }
                }}
              >
                <GoogleAuthButton label="Sign up with Google to Accept" />
              </div>

              <AuthDivider />

              <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                Or create an account with email and password:
              </p>
              <FormField
                id="display-name"
                label="Your Name"
                type="text"
                required
                autoComplete="name"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <FormField
                id="new-password"
                label="Create Password"
                type="password"
                required
                autoComplete="new-password"
                hint="At least 12 characters."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <FormField
                id="confirm-password"
                label="Confirm Password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="submit" id="accept-invite-submit" disabled={submitting} style={{ marginTop: "0.5rem" }}>
                {submitting ? "Accepting…" : "Create Account & Join"}
              </button>
            </>
          )}
        </form>

        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Already have an account? <Link to="/login">Sign in here</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
