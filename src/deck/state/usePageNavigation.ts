import { useCallback, useState } from "react";
import type { DeckPage } from "../models/DeckPage";

export interface PageNavigation {
  pageIndex: number;
  pageCount: number;
  currentPage: DeckPage | null;
  next(): void;
  previous(): void;
  home(): void;
  goToPage(pageId: string): boolean;
}

export function usePageNavigation(pages: DeckPage[]): PageNavigation {
  // Tracked by id (not array position) so a provider push that reorders or
  // inserts pages doesn't silently change which page is showing — only a
  // page's actual removal falls back to the first page.
  const [currentPageId, setCurrentPageId] = useState<string | null>(pages[0]?.id ?? null);
  const pageCount = pages.length;

  const resolvedIndex = pages.findIndex((page) => page.id === currentPageId);
  const pageIndex = resolvedIndex === -1 ? 0 : resolvedIndex;
  const currentPage = pages[pageIndex] ?? null;

  // Adjust during render (not an effect) when the tracked id no longer
  // resolves, so next/previous/goToPage below always act relative to
  // whichever page is actually being shown.
  if (currentPage && currentPage.id !== currentPageId) {
    setCurrentPageId(currentPage.id);
  }

  const next = useCallback(() => {
    setCurrentPageId((id) => {
      const from = pages.findIndex((page) => page.id === id);
      const base = from === -1 ? 0 : from;
      return pages[Math.min(base + 1, pages.length - 1)]?.id ?? id;
    });
  }, [pages]);

  const previous = useCallback(() => {
    setCurrentPageId((id) => {
      const from = pages.findIndex((page) => page.id === id);
      const base = from === -1 ? 0 : from;
      return pages[Math.max(base - 1, 0)]?.id ?? id;
    });
  }, [pages]);

  const home = useCallback(() => {
    setCurrentPageId(pages[0]?.id ?? null);
  }, [pages]);

  const goToPage = useCallback(
    (pageId: string): boolean => {
      if (pageId === "next") {
        next();
        return true;
      }
      if (pageId === "previous") {
        previous();
        return true;
      }
      if (pageId === "home") {
        home();
        return true;
      }
      const target = pages.find((page) => page.id === pageId);
      if (!target) {
        console.warn(`[deck] unknown page "${pageId}"`);
        return false;
      }
      setCurrentPageId(target.id);
      return true;
    },
    [pages, next, previous, home],
  );

  return {
    pageIndex,
    pageCount,
    currentPage,
    next,
    previous,
    home,
    goToPage,
  };
}
