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
        style={{ fontWeight: 600, fontSize: "0.875rem", color: "#374151" }}
      >
        {label}
      </label>
      {hint && (
        <span id={hintId} style={{ fontSize: "0.8rem", color: "#6b7280" }}>
          {hint}
        </span>
      )}
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? "true" : undefined}
        style={{
          padding: "0.6rem 0.75rem",
          borderRadius: "0.4rem",
          border: error ? "1.5px solid #ef4444" : "1.5px solid #d1d5db",
          fontSize: "1rem",
          outline: "none",
          transition: "border-color 0.15s",
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
