import type { ReactNode } from "react";
import { Link } from "react-router";
import logoPath from "../../assets/logo.png";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main 
      className="dark-theme"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexWrap: "wrap",
        backgroundColor: "#000000",
        color: "var(--text-primary)",
        position: "relative",
        overflow: "hidden"
      }} 
      aria-labelledby="auth-page-title"
    >
      {/* Fading Pattern Background */}
      <div 
        className="auth-pattern"
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          maskImage: "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)",
          pointerEvents: "none",
          zIndex: 0
        }} 
      />

      {/* Top Left Text */}
      <div style={{
        position: "absolute",
        top: "2.5rem",
        left: "3rem",
        zIndex: 10,
        fontWeight: 600,
        fontSize: "0.95rem",
        letterSpacing: "0.05em",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem"
      }}>
        <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>ADEPT</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>|</span>
        <span style={{ color: "rgba(255,255,255,0.7)" }}>Enterprises Portal</span>
      </div>

      {/* Left Side - Visuals & Logo */}
      <div 
        className="auth-left-panel"
        style={{
          flex: "1 1 50%",
          minWidth: "300px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "2rem",
          position: "relative",
          zIndex: 1
        }}
      >
        {/* Subtle decorative glow behind logo */}
        <div 
          className="auth-glow"
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "300px", height: "300px",
            background: "radial-gradient(circle, rgba(0,0,0,0.9) 0%, transparent 70%)",
            filter: "blur(50px)"
          }} 
        />
        <div style={{ zIndex: 2, textAlign: "center" }}>
            <Link to="/">
              <img src={logoPath} alt="Adept Logo" className="auth-logo" style={{ width: "320px", maxWidth: "80%", filter: "drop-shadow(0 0 30px rgba(0, 0, 0, 0.8))" }} />
            </Link>
        </div>
      </div>

      {/* Right Side - Login Portal */}
      <div style={{
        flex: "1 1 40%",
        minWidth: "320px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "3rem 2rem",
        zIndex: 2
      }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <section
            className="card"
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "1.8rem",
              background: "linear-gradient(145deg, rgba(30, 30, 35, 0.6) 0%, rgba(15, 15, 18, 0.8) 100%)",
              borderTop: "1px solid rgba(255, 255, 255, 0.15)",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              borderRight: "1px solid rgba(255, 255, 255, 0.05)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(25px)",
              WebkitBackdropFilter: "blur(25px)",
              padding: "3rem",
              borderRadius: "1.2rem",
              boxShadow: "0 30px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
              width: "100%"
            }}
          >
            <header style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <h1
                id="auth-page-title"
                style={{ margin: 0, fontSize: "1.7rem", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}
              >
                {title}
              </h1>
              {description && (
                <p style={{ margin: "0.6rem 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                  {description}
                </p>
              )}
            </header>
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
