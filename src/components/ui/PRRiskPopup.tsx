import { useEffect, useState, useCallback, useContext } from "react";
import { AuthContext } from "../../auth/AuthContext.js";

export interface PRRiskEventPayload {
  prTitle: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  probability?: number;
}

export interface PRRiskNotification extends PRRiskEventPayload {
  id: string;
}

export function PRRiskPopup() {
  const auth = useContext(AuthContext);
  const isAuthenticated = auth ? auth.state.status === "authenticated" : true;
  const [notifications, setNotifications] = useState<PRRiskNotification[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    if (
      !isAuthenticated ||
      typeof window === "undefined" ||
      typeof window.EventSource === "undefined"
    ) {
      return;
    }

    const streamUrl = "/api/pr-risk/stream";
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(streamUrl);

      const handleRiskEvent = (event: MessageEvent) => {
        try {
          const data: Partial<PRRiskEventPayload> = JSON.parse(event.data);
          if (!data) return;

          const rawScore = typeof data.riskScore === "number"
            ? data.riskScore
            : Math.round((data.probability ?? 0) * 100);

          let level: "LOW" | "MEDIUM" | "HIGH" = "LOW";
          if (data.riskLevel) {
            const normalized = data.riskLevel.toUpperCase();
            if (normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") {
              level = normalized;
            }
          } else {
            level = rawScore > 70 ? "HIGH" : rawScore > 30 ? "MEDIUM" : "LOW";
          }

          const notification: PRRiskNotification = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            prTitle: data.prTitle || "Untitled Pull Request",
            riskScore: rawScore,
            riskLevel: level,
            probability: data.probability,
          };

          setNotifications((prev) => [...prev, notification]);
        } catch (err) {
          console.error("Failed to parse incoming PR risk event:", err);
        }
      };

      // Listen for "pr_risk_score" as well as "pr-risk" and general messages
      eventSource.addEventListener("pr_risk_score", handleRiskEvent);
      eventSource.addEventListener("pr-risk", handleRiskEvent);
      eventSource.addEventListener("message", (e) => {
        if (e.data && e.data.includes("riskScore")) {
          handleRiskEvent(e);
        }
      });

      eventSource.onerror = () => {
        // EventSource will automatically attempt reconnection
      };
    } catch (err) {
      console.error("Failed to initialize PR Risk SSE stream:", err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isAuthenticated]);

  // Automatically dismiss each notification after 6 seconds (between 5-7s)
  useEffect(() => {
    if (notifications.length === 0) return;

    const timer = setTimeout(() => {
      setNotifications((prev) => prev.slice(1));
    }, 6000);

    return () => clearTimeout(timer);
  }, [notifications]);

  if (notifications.length === 0) {
    return null;
  }

  const getRiskColors = (level: "LOW" | "MEDIUM" | "HIGH") => {
    switch (level) {
      case "HIGH":
        return {
          badgeBg: "#fef2f2",
          badgeBorder: "#ef4444",
          badgeText: "#b91c1c",
          barColor: "#ef4444",
        };
      case "MEDIUM":
        return {
          badgeBg: "#fefce8",
          badgeBorder: "#f59e0b",
          badgeText: "#b45309",
          barColor: "#f59e0b",
        };
      case "LOW":
      default:
        return {
          badgeBg: "#ecfdf5",
          badgeBorder: "#10b981",
          badgeText: "#047857",
          barColor: "#10b981",
        };
    }
  };

  return (
    <aside
      aria-label="PR Risk Notifications"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        maxWidth: "380px",
        width: "calc(100vw - 48px)",
        pointerEvents: "none",
      }}
    >
      {notifications.map((notification) => {
        const colors = getRiskColors(notification.riskLevel);
        return (
          <div
            key={notification.id}
            role="alert"
            data-testid="pr-risk-popup"
            style={{
              pointerEvents: "auto",
              backgroundColor: "var(--card-bg, #ffffff)",
              color: "var(--text-primary, #0a0a0a)",
              border: "1px solid var(--border-color, rgba(0, 0, 0, 0.15))",
              borderRadius: "12px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.12)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              transition: "all 0.25s ease-in-out",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Top Color Accent Bar */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                backgroundColor: colors.barColor,
              }}
            />

            {/* Header: Title + Close button */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: colors.badgeBg,
                    color: colors.badgeText,
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  !
                </span>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--text-primary, #0a0a0a)",
                  }}
                >
                  PR Risk Analysis Complete
                </h4>
              </div>
              <button
                type="button"
                onClick={() => dismissNotification(notification.id)}
                aria-label="Dismiss notification"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: 1,
                  color: "var(--text-secondary, #666666)",
                  padding: "2px 6px",
                }}
              >
                &times;
              </button>
            </div>

            {/* Subtitle */}
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "var(--text-secondary, #666666)",
              }}
            >
              Based on code size and history.
            </p>

            {/* PR Title */}
            <div
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--text-primary, #0a0a0a)",
                wordBreak: "break-word",
                marginTop: "2px",
              }}
            >
              <strong>PR:</strong> {notification.prTitle}
            </div>

            {/* Risk Score & Level Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "4px",
                paddingTop: "8px",
                borderTop: "1px solid var(--surface-muted, #eeeeee)",
              }}
            >
              <div style={{ fontSize: "13px" }}>
                Risk Score:{" "}
                <strong style={{ fontSize: "16px", color: colors.badgeText }}>
                  {notification.riskScore}
                </strong>{" "}
                / 100
              </div>
              <span
                data-testid="risk-level-badge"
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  backgroundColor: colors.badgeBg,
                  color: colors.badgeText,
                  border: `1px solid ${colors.badgeBorder}`,
                }}
              >
                {notification.riskLevel}
              </span>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
