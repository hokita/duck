import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DeckButton } from "../../deck/models/DeckButton";
import { EditorPanel } from "./EditorPanel";

const button: DeckButton = { id: "a", title: "Alpha", status: "active" };

const renderPanel = (overrides: Partial<Parameters<typeof EditorPanel>[0]> = {}) => {
  const props = {
    selectedButton: button,
    onUpdate: vi.fn(),
    onMove: vi.fn(),
    onRestore: vi.fn(),
    ...overrides,
  };
  render(<EditorPanel {...props} />);
  return props;
};

describe("EditorPanel", () => {
  it("asks for a selection when nothing is selected", () => {
    renderPanel({ selectedButton: null });
    expect(screen.getByText(/select a button/i)).toBeInTheDocument();
  });

  it("edits the title", async () => {
    const { onUpdate } = renderPanel();
    await userEvent.type(screen.getByLabelText("Title"), "!");
    expect(onUpdate).toHaveBeenCalledWith({ title: "Alpha!" });
  });

  it("changes the visual status", async () => {
    const { onUpdate } = renderPanel();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "error");
    expect(onUpdate).toHaveBeenCalledWith({ status: "error" });
  });

  it("toggles disabled", async () => {
    const { onUpdate } = renderPanel();
    await userEvent.click(screen.getByLabelText("Disabled"));
    expect(onUpdate).toHaveBeenCalledWith({ disabled: true });
  });

  it("moves the button", async () => {
    const { onMove } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Move right" }));
    expect(onMove).toHaveBeenCalledWith("right");
  });

  it("restores the mock configuration", async () => {
    const { onRestore } = renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Restore mock configuration" }),
    );
    expect(onRestore).toHaveBeenCalled();
  });
});
