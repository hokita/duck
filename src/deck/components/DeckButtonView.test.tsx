import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DeckButton } from "../models/DeckButton";
import { DeckButtonView } from "./DeckButtonView";

const button: DeckButton = {
  id: "backend",
  title: "Backend",
  subtitle: "Running",
  icon: "🖥️",
  status: "active",
  badge: "3",
  action: { type: "log", message: "hi" },
};

const renderButton = (overrides: Partial<Parameters<typeof DeckButtonView>[0]> = {}) =>
  render(
    <DeckButtonView
      button={button}
      size={88}
      compact={false}
      mode="deck"
      {...overrides}
    />,
  );

describe("DeckButtonView", () => {
  it("renders title, subtitle, icon, and badge", () => {
    renderButton();
    expect(screen.getByRole("button", { name: "Backend" })).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("🖥️")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("activates on click in deck mode", async () => {
    const onActivate = vi.fn();
    renderButton({ onActivate });
    await userEvent.click(screen.getByRole("button", { name: "Backend" }));
    expect(onActivate).toHaveBeenCalledWith(button);
  });

  it("activates with the keyboard (Enter and Space)", async () => {
    const onActivate = vi.fn();
    renderButton({ onActivate });
    const element = screen.getByRole("button", { name: "Backend" });
    element.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it("does not activate when disabled", async () => {
    const onActivate = vi.fn();
    renderButton({ button: { ...button, disabled: true }, onActivate });
    await userEvent.click(screen.getByRole("button", { name: "Backend" }));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("selects instead of activating in edit mode", async () => {
    const onActivate = vi.fn();
    const onSelect = vi.fn();
    renderButton({ mode: "edit", onActivate, onSelect });
    await userEvent.click(screen.getByRole("button", { name: "Backend" }));
    expect(onSelect).toHaveBeenCalledWith(button);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("renders a non-interactive filler for null slots", () => {
    const { container } = renderButton({ button: null });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".deck-button--empty")).not.toBeNull();
  });

  it("labels icon-less, title-less buttons as empty", () => {
    renderButton({ button: { id: "empty-1" } });
    expect(screen.getByRole("button", { name: "Empty button" })).toBeInTheDocument();
  });
});
