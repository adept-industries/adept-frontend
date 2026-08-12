import type { InputHTMLAttributes, ReactNode } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function FormField({ id, label, error, hint, ...inputProps }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy =
    [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <label
        htmlFor={id}
        style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}
      >
        {label}
      </label>
      {hint && (
        <span id={hintId} style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          {hint}
        </span>
      )}
      <input
        id={id}
        className="form-input"
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : undefined}
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "0.5rem",
          border: error ? "1.5px solid #ef4444" : "1px solid var(--border-color)",
          background: "var(--input-bg)",
          color: "var(--text-primary)",
          fontSize: "1rem",
          outline: "none",
        }}
        {...inputProps}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{ fontSize: "0.8rem", color: "#dc2626" }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
