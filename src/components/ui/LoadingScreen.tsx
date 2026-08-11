export function LoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg
        aria-hidden="true"
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        style={{ animation: "adept-spin 0.9s linear infinite" }}
      >
        <circle cx="20" cy="20" r="16" stroke="#e2e8f0" strokeWidth="4" />
        <path
          d="M20 4a16 16 0 0 1 16 16"
          stroke="#4763d8"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <style>{`
          @keyframes adept-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </svg>
    </div>
  );
}
