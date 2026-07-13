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
  const [rawIndex, setRawIndex] = useState(0);
  const pageCount = pages.length;
  const pageIndex = pageCount === 0 ? 0 : Math.min(rawIndex, pageCount - 1);

  const next = useCallback(
    () => setRawIndex((index) => Math.min(index + 1, Math.max(pageCount - 1, 0))),
    [pageCount],
  );
  const previous = useCallback(() => setRawIndex((index) => Math.max(index - 1, 0)), []);
  const home = useCallback(() => setRawIndex(0), []);

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
      const index = pages.findIndex((page) => page.id === pageId);
      if (index === -1) {
        console.warn(`[deck] unknown page "${pageId}"`);
        return false;
      }
      setRawIndex(index);
      return true;
    },
    [pages, next, previous, home],
  );

  return {
    pageIndex,
    pageCount,
    currentPage: pages[pageIndex] ?? null,
    next,
    previous,
    home,
    goToPage,
  };
}
