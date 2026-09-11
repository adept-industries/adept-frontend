import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RepositoryPatternSelect } from "./RepositoryPatternSelect.js";
import { literalRepositoryPattern } from "./repositoryPatterns.js";

function Harness({ initial = ["release/*"], onSubmit = vi.fn() }: { initial?: string[]; onSubmit?: () => void }) {
  const [value, setValue] = useState(initial);
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <RepositoryPatternSelect id="branches" label="Branches" help="Choose production branches."
      placeholder="Search or add a pattern" value={value} onChange={setValue} loading={false}
      options={{ values: ["main", "release/next", "CI [prod], deploy?*"], complete: true }} />
    <output aria-label="Saved patterns">{JSON.stringify(value)}</output>
    <button type="button">Outside</button>
  </form>;
}

describe("RepositoryPatternSelect", () => {
  it("searches and selects multiple GitHub names without removing saved custom patterns", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Remove release/*" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Branches" }));
    await user.type(screen.getByRole("textbox", { name: "Search Branches" }), "MAIN");
    expect(screen.queryByRole("checkbox", { name: "release/next" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "main" }));
    await user.clear(screen.getByRole("textbox"));
    await user.click(screen.getByRole("checkbox", { name: "release/next" }));
    expect(screen.getByLabelText("Saved patterns")).toHaveTextContent('["release/*","main","release/next"]');
    await user.click(screen.getByRole("button", { name: "Remove main" }));
    expect(screen.getByRole("checkbox", { name: "main" })).not.toBeChecked();
  });

  it("adds custom globs with Enter without submitting and closes on Escape/outside click", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<Harness onSubmit={submit} />);
    const trigger = screen.getByRole("button", { name: "Branches" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox")).toHaveFocus();
    await user.type(screen.getByRole("textbox"), "hotfix/*{Enter}");
    expect(screen.getByRole("button", { name: "Remove hotfix/*" })).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("preserves commas and escapes glob metacharacters for exact GitHub choices", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);
    await user.click(screen.getByRole("button", { name: "Branches" }));
    await user.click(screen.getByRole("checkbox", { name: "CI [prod], deploy?*" }));
    expect(screen.getByLabelText("Saved patterns")).toHaveTextContent('["CI [[]prod], deploy[?][*]"]');
    expect(screen.getByRole("button", { name: "Remove CI [prod], deploy?*" })).toBeInTheDocument();
    expect(literalRepositoryPattern("main")).toBe("main");
  });

  it("allows manual entry while loading or when GitHub access fails", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    const props = { id: "env", label: "Environments", help: "Production only.", placeholder: "Pattern", value: ["prod"], onChange: change };
    const { rerender } = render(<RepositoryPatternSelect {...props} loading />);
    await user.click(screen.getByRole("button", { name: "Environments" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading GitHub options");
    await user.type(screen.getByRole("textbox"), "live{Enter}");
    expect(change).toHaveBeenCalledWith(["prod", "live"]);
    rerender(<RepositoryPatternSelect {...props} loading={false} options={{ values: [], complete: false, warning: "Check read permissions." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Check read permissions");
    expect(screen.getByRole("button", { name: "Remove prod" })).toBeInTheDocument();
  });

  it("rejects duplicate, overly long and excessive patterns", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Branches" }));
    await user.type(screen.getByRole("textbox"), "release/*{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("already selected");
    await user.clear(screen.getByRole("textbox"));
    await user.paste("x".repeat(129));
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("128 characters");
    unmount();
    render(<Harness initial={Array.from({ length: 32 }, (_, index) => `branch-${index}`)} />);
    await user.click(screen.getByRole("button", { name: "Branches" }));
    await user.click(screen.getByRole("checkbox", { name: "main" }));
    expect(screen.getByRole("alert")).toHaveTextContent("up to 32");
  });
});
