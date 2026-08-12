import { Link } from "react-router";

export function ForbiddenPage() {
  return (
    <main className="shell" aria-labelledby="forbidden-title">
      <section className="card" style={{ textAlign: "center" }}>
        <p className="eyebrow">403</p>
        <h1 id="forbidden-title">Access denied</h1>
        <p>You don&apos;t have permission to view this page.</p>
        <Link to="/dashboard" style={{ color: "#4763d8", fontWeight: 600 }}>
          Go to dashboard
        </Link>
      </section>
    </main>
  );
}
