import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="shell" aria-labelledby="notfound-title">
      <section className="card" style={{ textAlign: "center" }}>
        <p className="eyebrow">404</p>
        <h1 id="notfound-title">Page not found</h1>
        <p>The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link to="/dashboard" style={{ color: "#4763d8", fontWeight: 600 }}>
          Go to dashboard
        </Link>
      </section>
    </main>
  );
}
