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
        className="loading-spinner"
      >
        <circle cx="20" cy="20" r="16" stroke="var(--border-color)" strokeWidth="4" />
        <path
          d="M20 4a16 16 0 0 1 16 16"
          stroke="var(--text-primary)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
