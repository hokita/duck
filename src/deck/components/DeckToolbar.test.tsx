import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeckToolbar } from "./DeckToolbar";

const renderToolbar = (overrides: Partial<Parameters<typeof DeckToolbar>[0]> = {}) =>
  render(
    <DeckToolbar
      pageIndex={1}
      pageCount={3}
      mode="deck"
      onToggleEdit={vi.fn()}
      onOpenSettings={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />,
  );

describe("DeckToolbar", () => {
  it("marks itself as the window drag region", () => {
    const { container } = renderToolbar();
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
  });

  it("announces the current page position", () => {
    renderToolbar();
    expect(screen.getByLabelText("Page 2 of 3")).toBeInTheDocument();
  });

  it("wires the edit, settings, and close controls", async () => {
    const onToggleEdit = vi.fn();
    const onOpenSettings = vi.fn();
    const onClose = vi.fn();
    renderToolbar({ onToggleEdit, onOpenSettings, onClose });
    await userEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await userEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Close window" }));
    expect(onToggleEdit).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("reflects edit mode on the edit control", () => {
    renderToolbar({ mode: "edit" });
    expect(screen.getByRole("button", { name: "Toggle edit mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
