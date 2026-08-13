import { apiUrl } from "../../../api/client.js";

interface GoogleAuthButtonProps {
  label?: string;
}

export function GoogleAuthButton({ label = "Continue with Google" }: GoogleAuthButtonProps) {
  return (
    <a className="button-link google-auth-button" href={apiUrl("/auth/google/start")}>
      <GoogleMark />
      <span>{label}</span>
    </a>
  );
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      className="google-auth-mark"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.874 2.683-6.614Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.181l-2.909-2.258c-.806.54-1.836.859-3.048.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.167.282-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

export function AuthDivider() {
  return (
    <div className="auth-divider" aria-hidden="true">
      <span />
      <span>or</span>
      <span />
    </div>
  );
}
