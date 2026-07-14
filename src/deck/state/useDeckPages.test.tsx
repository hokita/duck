import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DeckPage } from "../models/DeckPage";
import type { DeckButtonProvider } from "../providers/DeckButtonProvider";
import { useDeckPages } from "./useDeckPages";

const somePages: DeckPage[] = [{ id: "p1", name: "P1", buttons: [{ id: "a" }] }];

describe("useDeckPages", () => {
  it("loads pages from the provider", async () => {
    const provider: DeckButtonProvider = { getPages: async () => somePages };
    const { result } = renderHook(() => useDeckPages(provider));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pages).toEqual(somePages);
    expect(result.current.error).toBe(false);
  });

  it("flags an error when the provider rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider: DeckButtonProvider = {
      getPages: async () => {
        throw new Error("offline");
      },
    };
    const { result } = renderHook(() => useDeckPages(provider));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
    error.mockRestore();
  });

  it("reload re-fetches from the provider", async () => {
    const getPages = vi
      .fn<() => Promise<DeckPage[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(somePages);
    const provider: DeckButtonProvider = { getPages };
    const { result } = renderHook(() => useDeckPages(provider));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pages).toEqual([]);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.pages).toEqual(somePages));
    expect(getPages).toHaveBeenCalledTimes(2);
  });

  it("keeps a push update that arrives before the initial fetch resolves", async () => {
    let resolveFetch: ((pages: DeckPage[]) => void) | undefined;
    const fetchPromise = new Promise<DeckPage[]>((resolve) => {
      resolveFetch = resolve;
    });
    let push: ((pages: DeckPage[]) => void) | undefined;
    const provider: DeckButtonProvider = {
      getPages: () => fetchPromise,
      subscribe: (listener) => {
        push = listener;
        return () => {
          push = undefined;
        };
      },
    };
    const { result } = renderHook(() => useDeckPages(provider));

    act(() => push?.(somePages));
    expect(result.current.pages).toEqual(somePages);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolveFetch?.([]);
      await fetchPromise;
    });
    expect(result.current.pages).toEqual(somePages);
  });

  it("applies pushed updates from subscribe", async () => {
    let push: ((pages: DeckPage[]) => void) | undefined;
    const provider: DeckButtonProvider = {
      getPages: async () => [],
      subscribe: (listener) => {
        push = listener;
        return () => {
          push = undefined;
        };
      },
    };
    const { result, unmount } = renderHook(() => useDeckPages(provider));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => push?.(somePages));
    expect(result.current.pages).toEqual(somePages);
    unmount();
    expect(push).toBeUndefined();
  });
});
