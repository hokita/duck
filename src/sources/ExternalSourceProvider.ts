import type { DeckPage } from "../deck/models/DeckPage";
import type { DeckButtonProvider } from "../deck/providers/DeckButtonProvider";
import { isTauri } from "../shared/tauri";

type InvokeFn = (command: string) => Promise<unknown>;

interface ExternalSourceProviderOptions {
  invoke?: InvokeFn;
  tauri?: boolean;
  pollMs?: number;
}

async function defaultInvoke(command: string): Promise<unknown> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(command);
}

/**
 * Serves deck pages from the Rust-side list_source_pages command (backed by
 * the user's sources.json) and falls back to the wrapped provider when no
 * sources are configured or we're outside Tauri. Polls for file changes and
 * pushes fresh pages to subscribers.
 */
export class ExternalSourceProvider implements DeckButtonProvider {
  private readonly invoke: InvokeFn;
  private readonly tauri: boolean;
  private readonly pollMs: number;
  // The listener/caller replaces the app's whole page state (see
  // useDeckPages), which would otherwise clobber in-progress edit-mode
  // changes whenever a poll or fetch returns pages identical to what's
  // already showing. Shared across getPages() and subscribe() so a poll
  // immediately after the initial getPages() load — the common case, since
  // useDeckPages calls both on mount — doesn't treat unchanged content as new.
  private lastSeen: string | null = null;

  constructor(
    private readonly fallback: DeckButtonProvider,
    options: ExternalSourceProviderOptions = {},
  ) {
    this.invoke = options.invoke ?? defaultInvoke;
    this.tauri = options.tauri ?? isTauri();
    this.pollMs = options.pollMs ?? 1500;
  }

  /** Fetches configured source pages, or null when unconfigured/empty. */
  private async fetchSourcePages(): Promise<DeckPage[] | null> {
    const pages = (await this.invoke("list_source_pages")) as DeckPage[] | null;
    return pages && pages.length > 0 ? pages : null;
  }

  async getPages(): Promise<DeckPage[]> {
    if (!this.tauri) {
      return this.fallback.getPages();
    }
    let pages: DeckPage[];
    try {
      pages = (await this.fetchSourcePages()) ?? (await this.fallback.getPages());
    } catch (error) {
      console.error("[deck] failed to list source pages", error);
      pages = await this.fallback.getPages();
    }
    this.lastSeen = JSON.stringify(pages);
    return pages;
  }

  subscribe(listener: (pages: DeckPage[]) => void): () => void {
    if (!this.tauri) {
      return () => {};
    }
    let polling = false;
    const interval = setInterval(() => {
      if (polling) {
        return;
      }
      polling = true;
      this.fetchSourcePages()
        .then(async (pages) => pages ?? (await this.fallback.getPages()))
        .then((next) => {
          const serialized = JSON.stringify(next);
          if (serialized !== this.lastSeen) {
            this.lastSeen = serialized;
            listener(next);
          }
        })
        .catch((error: unknown) => {
          console.error("[deck] source poll failed", error);
        })
        .finally(() => {
          polling = false;
        });
    }, this.pollMs);
    return () => clearInterval(interval);
  }
}
