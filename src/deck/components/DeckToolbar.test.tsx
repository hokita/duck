import { fireEvent, render, screen } from "@testing-library/react";
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
      onDragStart={vi.fn()}
      {...overrides}
    />,
  );

describe("DeckToolbar", () => {
  it("starts a window drag on mousedown over the toolbar", () => {
    const onDragStart = vi.fn();
    const { container } = renderToolbar({ onDragStart });
    fireEvent.mouseDown(container.querySelector(".deck-toolbar__title")!);
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it("does not start a window drag from a toolbar button", () => {
    const onDragStart = vi.fn();
    renderToolbar({ onDragStart });
    fireEvent.mouseDown(screen.getByRole("button", { name: "Toggle edit mode" }));
    expect(onDragStart).not.toHaveBeenCalled();
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
