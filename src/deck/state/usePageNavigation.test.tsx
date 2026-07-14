import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DeckPage } from "../models/DeckPage";
import { usePageNavigation } from "./usePageNavigation";

const pages: DeckPage[] = [
  { id: "main", name: "Main", buttons: [] },
  { id: "tools", name: "Tools", buttons: [] },
  { id: "wall", name: "Wall", buttons: [] },
];

describe("usePageNavigation", () => {
  it("starts at the first page", () => {
    const { result } = renderHook(() => usePageNavigation(pages));
    expect(result.current.pageIndex).toBe(0);
    expect(result.current.currentPage?.id).toBe("main");
  });

  it("moves next and previous within bounds", () => {
    const { result } = renderHook(() => usePageNavigation(pages));
    act(() => result.current.next());
    expect(result.current.pageIndex).toBe(1);
    act(() => result.current.previous());
    act(() => result.current.previous());
    expect(result.current.pageIndex).toBe(0);
  });

  it("stops at the last page instead of wrapping", () => {
    const { result } = renderHook(() => usePageNavigation(pages));
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.pageIndex).toBe(2);
  });

  it("goToPage resolves reserved ids, page ids, and rejects unknown ids", () => {
    const { result } = renderHook(() => usePageNavigation(pages));
    act(() => {
      expect(result.current.goToPage("tools")).toBe(true);
    });
    expect(result.current.pageIndex).toBe(1);
    act(() => {
      expect(result.current.goToPage("home")).toBe(true);
    });
    expect(result.current.pageIndex).toBe(0);
    act(() => {
      expect(result.current.goToPage("nope")).toBe(false);
    });
    expect(result.current.pageIndex).toBe(0);
  });

  it("clamps the index when pages shrink", () => {
    const { result, rerender } = renderHook(({ p }) => usePageNavigation(p), {
      initialProps: { p: pages },
    });
    act(() => {
      result.current.goToPage("wall");
    });
    rerender({ p: pages.slice(0, 1) });
    expect(result.current.pageIndex).toBe(0);
    expect(result.current.currentPage?.id).toBe("main");
  });

  it("stays on the same page by id when a push reorders or inserts pages", () => {
    const { result, rerender } = renderHook(({ p }) => usePageNavigation(p), {
      initialProps: { p: pages },
    });
    act(() => {
      result.current.goToPage("wall");
    });
    expect(result.current.pageIndex).toBe(2);

    // A provider push inserts a page before "wall", shifting its numeric
    // position without removing it — the tracked page must not change.
    const reordered: DeckPage[] = [
      pages[0],
      { id: "inserted", name: "Inserted", buttons: [] },
      pages[1],
      pages[2],
    ];
    rerender({ p: reordered });
    expect(result.current.pageIndex).toBe(3);
    expect(result.current.currentPage?.id).toBe("wall");
  });
});
