import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DECK_SETTINGS,
  parseDeckSettings,
  type DeckSettings,
} from "../../deck/models/DeckSettings";
import { SettingsPanel } from "./SettingsPanel";

/** Mimics a real parent that clamps every patch through parseDeckSettings. */
function StatefulPanel({ initial }: { initial: DeckSettings }) {
  const [settings, setSettings] = useState(initial);
  return (
    <SettingsPanel
      settings={settings}
      onChange={(patch) =>
        setSettings((current) => parseDeckSettings({ ...current, ...patch }))
      }
      onClose={() => {}}
    />
  );
}

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

  it("keeps typed digits intact even when an intermediate value gets clamped", async () => {
    render(<StatefulPanel initial={DEFAULT_DECK_SETTINGS} />);
    const buttonSize = screen.getByLabelText("Button size");
    await userEvent.clear(buttonSize);
    // Typing "1" then "2" clamps to the 48 minimum before "120" is complete;
    // the field must keep the typed digits rather than snap to the clamped echo.
    await userEvent.type(buttonSize, "120");
    expect(buttonSize).toHaveValue(120);
  });
});
