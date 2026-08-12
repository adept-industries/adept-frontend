interface InlineAlertProps {
  message: string;
  kind?: "error" | "info" | "success";
  id?: string;
}

export function InlineAlert({ message, id }: InlineAlertProps) {
  return (
    <div
      id={id}
      className="inline-alert"
      role="alert"
      aria-live="assertive"
    >
      {message}
    </div>
  );
}
