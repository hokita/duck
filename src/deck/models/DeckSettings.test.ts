import { describe, expect, it } from "vitest";
import { DEFAULT_DECK_SETTINGS, parseDeckSettings } from "./DeckSettings";

describe("parseDeckSettings", () => {
  it("returns defaults for non-object input", () => {
    expect(parseDeckSettings(null)).toEqual(DEFAULT_DECK_SETTINGS);
    expect(parseDeckSettings("garbage")).toEqual(DEFAULT_DECK_SETTINGS);
    expect(parseDeckSettings(42)).toEqual(DEFAULT_DECK_SETTINGS);
  });

  it("keeps valid fields and fills missing ones with defaults", () => {
    const parsed = parseDeckSettings({ columns: 4, compact: true });
    expect(parsed.columns).toBe(4);
    expect(parsed.compact).toBe(true);
    expect(parsed.rows).toBe(DEFAULT_DECK_SETTINGS.rows);
    expect(parsed.buttonSize).toBe(DEFAULT_DECK_SETTINGS.buttonSize);
  });

  it("replaces wrongly typed fields with defaults", () => {
    const parsed = parseDeckSettings({ columns: "five", alwaysOnTop: "yes" });
    expect(parsed.columns).toBe(DEFAULT_DECK_SETTINGS.columns);
    expect(parsed.alwaysOnTop).toBe(DEFAULT_DECK_SETTINGS.alwaysOnTop);
  });

  it("clamps out-of-range numbers", () => {
    const parsed = parseDeckSettings({ columns: 99, rows: 0, buttonSize: 10, gap: 500 });
    expect(parsed.columns).toBe(12);
    expect(parsed.rows).toBe(1);
    expect(parsed.buttonSize).toBe(48);
    expect(parsed.gap).toBe(32);
  });

  it("has the spec defaults", () => {
    expect(DEFAULT_DECK_SETTINGS).toEqual({
      columns: 5,
      rows: 3,
      buttonSize: 88,
      gap: 12,
      compact: false,
      alwaysOnTop: false,
    });
  });
});
