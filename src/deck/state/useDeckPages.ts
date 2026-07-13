import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { DeckPage } from "../models/DeckPage";
import type { DeckButtonProvider } from "../providers/DeckButtonProvider";

export interface DeckPagesState {
  pages: DeckPage[];
  loading: boolean;
  error: boolean;
  /** Local edits (edit mode) — does not write back to the provider. */
  setPages: Dispatch<SetStateAction<DeckPage[]>>;
  reload(): void;
}

export function useDeckPages(provider: DeckButtonProvider): DeckPagesState {
  const [pages, setPages] = useState<DeckPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    provider
      .getPages()
      .then((loaded) => {
        if (!cancelled) {
          setPages(loaded);
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          console.error("[deck] button provider failed", cause);
          setError(true);
          setLoading(false);
        }
      });
    const unsubscribe = provider.subscribe?.((updated) => {
      if (!cancelled) {
        setPages(updated);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [provider, loadCount]);

  const reload = useCallback(() => setLoadCount((count) => count + 1), []);

  return { pages, loading, error, setPages, reload };
}
