import type { ReactNode } from "react";
import { Link } from "react-router";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main className="shell" aria-labelledby="auth-page-title">
      <div style={{ width: "min(26rem, 100%)" }}>
        {/* Logo / wordmark */}
        <Link
          to="/"
          aria-label="Adept home"
          style={{
            display: "block",
            marginBottom: "2rem",
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: "1.5rem",
              letterSpacing: "-0.03em",
              color: "#4763d8",
            }}
          >
            adept
          </span>
        </Link>

        <section
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <header style={{ textAlign: "center" }}>
            <h1
              id="auth-page-title"
              style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}
            >
              {title}
            </h1>
            {description && (
              <p style={{ margin: "0.4rem 0 0", color: "#6b7280", fontSize: "0.95rem" }}>
                {description}
              </p>
            )}
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
