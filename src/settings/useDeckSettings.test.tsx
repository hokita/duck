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

  it("merges multiple synchronous updates against each other, not just the pre-update state", async () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => {
      result.current.update({ columns: 4 });
      result.current.update({ rows: 2 });
    });
    expect(result.current.settings.columns).toBe(4);
    expect(result.current.settings.rows).toBe(2);
  });

  it("keeps a user edit made before the initial load resolves", async () => {
    let resolveLoad: ((value: unknown) => void) | undefined;
    const loadPromise = new Promise<unknown>((resolve) => {
      resolveLoad = resolve;
    });
    const storage: SettingsStorage = {
      load: () => loadPromise,
      save: async () => {},
    };
    const { result } = renderHook(() => useDeckSettings(storage));

    act(() => result.current.update({ columns: 4 }));
    expect(result.current.settings.columns).toBe(4);

    await act(async () => {
      resolveLoad?.({ columns: 9 });
      await loadPromise;
    });
    expect(result.current.ready).toBe(true);
    expect(result.current.settings.columns).toBe(4);
  });

  it("serializes saves so an older write can't finish after a newer one and leave stale data", async () => {
    const pending: { value: unknown; resolve: () => void }[] = [];
    const storage: SettingsStorage = {
      load: async () => null,
      save: (value) =>
        new Promise<void>((resolve) => {
          pending.push({ value, resolve });
        }),
    };
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.update({ columns: 4 }));
    await waitFor(() => expect(pending).toHaveLength(1));

    act(() => result.current.update({ columns: 6 }));
    // The second save must not be dispatched until the first resolves.
    expect(pending).toHaveLength(1);

    pending[0].resolve();
    await waitFor(() => expect(pending).toHaveLength(2));
    expect((pending[0].value as { columns: number }).columns).toBe(4);
    expect((pending[1].value as { columns: number }).columns).toBe(6);
  });
});
