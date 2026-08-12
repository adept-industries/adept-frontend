interface InlineAlertProps {
  message: string;
  kind?: "error" | "info" | "success";
  id?: string;
}

const colours: Record<NonNullable<InlineAlertProps["kind"]>, string> = {
  error: "#fee2e2",
  info: "#dbeafe",
  success: "#d1fae5",
};

const textColours: Record<NonNullable<InlineAlertProps["kind"]>, string> = {
  error: "#991b1b",
  info: "#1e40af",
  success: "#065f46",
};

export function InlineAlert({ message, kind = "error", id }: InlineAlertProps) {
  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      style={{
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        background: colours[kind],
        color: textColours[kind],
        fontSize: "0.9rem",
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}
