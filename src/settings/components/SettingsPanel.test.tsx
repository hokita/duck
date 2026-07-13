import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK_SETTINGS } from "../../deck/models/DeckSettings";
import { SettingsPanel } from "./SettingsPanel";

const renderPanel = (overrides: Partial<Parameters<typeof SettingsPanel>[0]> = {}) => {
  const props = {
    settings: DEFAULT_DECK_SETTINGS,
    onChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<SettingsPanel {...props} />);
  return props;
};

describe("SettingsPanel", () => {
  it("is an accessible dialog", () => {
    renderPanel();
    expect(screen.getByRole("dialog", { name: "Deck settings" })).toBeInTheDocument();
  });

  it("shows current values", () => {
    renderPanel();
    expect(screen.getByLabelText("Columns")).toHaveValue(5);
    expect(screen.getByLabelText("Rows")).toHaveValue(3);
    expect(screen.getByLabelText("Button size")).toHaveValue(88);
    expect(screen.getByLabelText("Gap")).toHaveValue(12);
  });

  it("emits numeric changes", async () => {
    const { onChange } = renderPanel();
    const rows = screen.getByLabelText("Rows");
    await userEvent.clear(rows);
    await userEvent.type(rows, "4");
    expect(onChange).toHaveBeenLastCalledWith({ rows: 4 });
  });

  it("emits boolean changes", async () => {
    const { onChange } = renderPanel();
    await userEvent.click(screen.getByLabelText("Always on top"));
    expect(onChange).toHaveBeenCalledWith({ alwaysOnTop: true });
    await userEvent.click(screen.getByLabelText("Compact mode"));
    expect(onChange).toHaveBeenCalledWith({ compact: true });
  });

  it("closes", async () => {
    const { onClose } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalled();
  });
});
