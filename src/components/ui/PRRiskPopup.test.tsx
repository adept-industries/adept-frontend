import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PRRiskPopup } from "./PRRiskPopup.js";

// Mock EventSource
type EventListenerCallback = (e: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners: Record<string, EventListenerCallback[]> = {};
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, callback: EventListenerCallback) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  removeEventListener(type: string, callback: EventListenerCallback) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((cb) => cb !== callback);
    }
  }

  simulateEvent(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    if (this.listeners[type]) {
      this.listeners[type].forEach((cb) => cb(event));
    }
  }

  close() {}
}

describe("PRRiskPopup", () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    // @ts-expect-error Mocking EventSource on global
    globalThis.EventSource = MockEventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.EventSource = originalEventSource;
  });

  it("renders nothing initially when there are no risk events", () => {
    const { container } = render(<PRRiskPopup />);
    expect(container.firstChild).toBeNull();
  });

  it("displays popup with all required fields when pr_risk_score event is received", () => {
    render(<PRRiskPopup />);

    const es = MockEventSource.instances[0];
    expect(es).toBeDefined();

    act(() => {
      es.simulateEvent("pr_risk_score", {
        prTitle: "Optimize search indexing",
        riskScore: 78,
        riskLevel: "HIGH",
        probability: 0.78,
      });
    });

    // Verify Title
    expect(screen.getByText("PR Risk Analysis Complete")).toBeInTheDocument();

    // Verify PR Title
    expect(screen.getByText("Optimize search indexing")).toBeInTheDocument();

    // Verify Subtitle
    expect(screen.getByText("Based on code size and history.")).toBeInTheDocument();

    // Verify Risk Score
    expect(screen.getByText("78")).toBeInTheDocument();
    expect(screen.getByText(/Risk Score:/)).toBeInTheDocument();

    // Verify Risk Level badge
    const badge = screen.getByTestId("risk-level-badge");
    expect(badge).toHaveTextContent("HIGH");
  });

  it("correctly color-codes LOW and MEDIUM risk levels", () => {
    render(<PRRiskPopup />);
    const es = MockEventSource.instances[0];

    // LOW
    act(() => {
      es.simulateEvent("pr_risk_score", {
        prTitle: "Fix typo in readme",
        riskScore: 12,
        riskLevel: "LOW",
      });
    });

    let badge = screen.getByTestId("risk-level-badge");
    expect(badge).toHaveTextContent("LOW");
    expect(badge.style.color).toBe("rgb(4, 120, 87)"); // green #047857

    // MEDIUM
    act(() => {
      es.simulateEvent("pr_risk_score", {
        prTitle: "Add payment gateway integration",
        riskScore: 55,
        riskLevel: "MEDIUM",
      });
    });

    const badges = screen.getAllByTestId("risk-level-badge");
    expect(badges).toHaveLength(2);
    expect(badges[1]).toHaveTextContent("MEDIUM");
    expect(badges[1].style.color).toBe("rgb(180, 83, 9)"); // yellow #b45309
  });

  it("allows manual dismissal via the close button", () => {
    render(<PRRiskPopup />);
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateEvent("pr_risk_score", {
        prTitle: "Refactor core loop",
        riskScore: 40,
        riskLevel: "MEDIUM",
      });
    });

    expect(screen.getByText("Refactor core loop")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Dismiss notification" });
    fireEvent.click(closeBtn);

    expect(screen.queryByText("Refactor core loop")).not.toBeInTheDocument();
  });

  it("automatically dismisses the notification after 6 seconds", () => {
    render(<PRRiskPopup />);
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateEvent("pr_risk_score", {
        prTitle: "Transient notification test",
        riskScore: 25,
        riskLevel: "LOW",
      });
    });

    expect(screen.getByText("Transient notification test")).toBeInTheDocument();

    // Advance 5 seconds - should still be there
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("Transient notification test")).toBeInTheDocument();

    // Advance 1 more second (total 6s) - should be dismissed
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Transient notification test")).not.toBeInTheDocument();
  });
});
