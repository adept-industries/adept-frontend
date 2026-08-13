// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoogleAuthButton } from "./GoogleAuthButton.js";

describe("GoogleAuthButton", () => {
  it("navigates through Adept's backend OAuth start endpoint", () => {
    render(<GoogleAuthButton label="Sign up with Google" />);

    expect(screen.getByRole("link", { name: "Sign up with Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google/start",
    );
  });
});
