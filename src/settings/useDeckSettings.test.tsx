import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK_SETTINGS } from "../deck/models/DeckSettings";
import type { SettingsStorage } from "./storage/SettingsStorage";
import { useDeckSettings } from "./useDeckSettings";

class MemoryStorage implements SettingsStorage {
  constructor(public value: unknown = null) {}
  async load(): Promise<unknown> {
    return this.value;
  }
  async save(value: unknown): Promise<void> {
    this.value = value;
  }
}

describe("useDeckSettings", () => {
  it("loads and validates persisted settings", async () => {
    const storage = new MemoryStorage({ columns: 4, rows: 2 });
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.settings.columns).toBe(4);
    expect(result.current.settings.rows).toBe(2);
  });

  it("falls back to defaults for invalid persisted data", async () => {
    const storage = new MemoryStorage("total garbage");
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.settings).toEqual(DEFAULT_DECK_SETTINGS);
  });

  it("falls back to defaults when storage.load rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const storage: SettingsStorage = {
      load: async () => {
        throw new Error("io");
      },
      save: async () => {},
    };
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.settings).toEqual(DEFAULT_DECK_SETTINGS);
    error.mockRestore();
  });

  it("update merges, clamps, and persists", async () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.update({ columns: 99, compact: true }));
    expect(result.current.settings.columns).toBe(12);
    expect(result.current.settings.compact).toBe(true);
    await waitFor(() => expect((storage.value as { columns: number }).columns).toBe(12));
  });
});
