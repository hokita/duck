import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckPage } from "../deck/models/DeckPage";
import type { DeckButtonProvider } from "../deck/providers/DeckButtonProvider";
import { ExternalSourceProvider } from "./ExternalSourceProvider";

const FALLBACK_PAGES: DeckPage[] = [{ id: "mock", name: "Mock", buttons: [] }];
const SOURCE_PAGES: DeckPage[] = [
  {
    id: "s0",
    name: "Claude Code",
    buttons: [{ id: "s0:corgi-30", title: "duck", status: "working" }],
  },
];

function fallbackProvider(): DeckButtonProvider {
  return { getPages: vi.fn(async () => FALLBACK_PAGES) };
}

describe("ExternalSourceProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns fallback pages outside Tauri without invoking", async () => {
    const invoke = vi.fn();
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: false,
    });
    expect(await provider.getPages()).toEqual(FALLBACK_PAGES);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns fallback pages when no sources are configured", async () => {
    const invoke = vi.fn(async () => null);
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: true,
    });
    expect(await provider.getPages()).toEqual(FALLBACK_PAGES);
    expect(invoke).toHaveBeenCalledWith("list_source_pages");
  });

  it("returns fallback pages when the config yields zero pages", async () => {
    const invoke = vi.fn(async () => []);
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: true,
    });
    expect(await provider.getPages()).toEqual(FALLBACK_PAGES);
  });

  it("returns source pages when configured", async () => {
    const invoke = vi.fn(async () => SOURCE_PAGES);
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: true,
    });
    expect(await provider.getPages()).toEqual(SOURCE_PAGES);
  });

  it("falls back and logs when the command fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const invoke = vi.fn(async () => {
      throw new Error("boom");
    });
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: true,
    });
    expect(await provider.getPages()).toEqual(FALLBACK_PAGES);
    expect(error).toHaveBeenCalled();
  });

  it("subscribe outside Tauri is a no-op", async () => {
    const invoke = vi.fn();
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: false,
    });
    const listener = vi.fn();
    const unsubscribe = provider.subscribe(listener);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(listener).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("polls and pushes source pages to the listener", async () => {
    const invoke = vi.fn(async () => SOURCE_PAGES);
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: true,
      pollMs: 1500,
    });
    const listener = vi.fn();
    const unsubscribe = provider.subscribe(listener);
    await vi.advanceTimersByTimeAsync(1500);
    expect(listener).toHaveBeenCalledWith(SOURCE_PAGES);
    unsubscribe();
  });

  it("pushes fallback pages when sources disappear mid-run", async () => {
    const invoke = vi.fn(async () => null);
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: true,
      pollMs: 1500,
    });
    const listener = vi.fn();
    const unsubscribe = provider.subscribe(listener);
    await vi.advanceTimersByTimeAsync(1500);
    expect(listener).toHaveBeenCalledWith(FALLBACK_PAGES);
    unsubscribe();
  });

  it("stops polling after unsubscribe", async () => {
    const invoke = vi.fn(async () => SOURCE_PAGES);
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: true,
      pollMs: 1500,
    });
    const listener = vi.fn();
    const unsubscribe = provider.subscribe(listener);
    await vi.advanceTimersByTimeAsync(1500);
    unsubscribe();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("skips a poll while the previous one is still in flight", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const invoke = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFirst ??= resolve;
        }),
    );
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: true,
      pollMs: 1500,
    });
    const listener = vi.fn();
    const unsubscribe = provider.subscribe(listener);
    await vi.advanceTimersByTimeAsync(1500);
    await vi.advanceTimersByTimeAsync(1500);
    expect(invoke).toHaveBeenCalledTimes(1);
    resolveFirst?.(SOURCE_PAGES);
    await vi.advanceTimersByTimeAsync(1500);
    expect(invoke).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("logs poll failures without notifying the listener", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const invoke = vi.fn(async () => {
      throw new Error("poll failed");
    });
    const provider = new ExternalSourceProvider(fallbackProvider(), {
      invoke,
      tauri: true,
      pollMs: 1500,
    });
    const listener = vi.fn();
    const unsubscribe = provider.subscribe(listener);
    await vi.advanceTimersByTimeAsync(1500);
    expect(listener).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    unsubscribe();
  });
});
