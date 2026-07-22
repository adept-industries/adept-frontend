import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the Phase 1 foundation page", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Adept" })).toBeInTheDocument();
    expect(screen.getByText(/frontend container is running/i)).toBeInTheDocument();
  });
});
