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

  // Reset loading/error for a new request while rendering (rather than in the
  // effect below), so a stale error doesn't linger across a provider swap or
  // reload() and no cascading post-effect render is needed.
  const [requestKey, setRequestKey] = useState<[DeckButtonProvider, number]>([
    provider,
    loadCount,
  ]);
  if (requestKey[0] !== provider || requestKey[1] !== loadCount) {
    setRequestKey([provider, loadCount]);
    setLoading(true);
    setError(false);
  }

  useEffect(() => {
    let cancelled = false;
    // A push can resolve before the initial fetch does; once that happens the
    // fetch's (now stale) snapshot must not overwrite the newer pushed pages.
    let pushed = false;
    const unsubscribe = provider.subscribe?.((updated) => {
      if (!cancelled) {
        pushed = true;
        setPages(updated);
        setLoading(false);
      }
    });
    provider
      .getPages()
      .then((loaded) => {
        if (!cancelled && !pushed) {
          setPages(loaded);
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!cancelled && !pushed) {
          console.error("[deck] button provider failed", cause);
          setError(true);
          setLoading(false);
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
