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

  constructor(
    private readonly fallback: DeckButtonProvider,
    options: ExternalSourceProviderOptions = {},
  ) {
    this.invoke = options.invoke ?? defaultInvoke;
    this.tauri = options.tauri ?? isTauri();
    this.pollMs = options.pollMs ?? 1500;
  }

  async getPages(): Promise<DeckPage[]> {
    if (!this.tauri) {
      return this.fallback.getPages();
    }
    try {
      const pages = (await this.invoke("list_source_pages")) as DeckPage[] | null;
      if (!pages || pages.length === 0) {
        return this.fallback.getPages();
      }
      return pages;
    } catch (error) {
      console.error("[deck] failed to list source pages", error);
      return this.fallback.getPages();
    }
  }

  subscribe(listener: (pages: DeckPage[]) => void): () => void {
    if (!this.tauri) {
      return () => {};
    }
    let polling = false;
    // The listener replaces the app's whole page state (see useDeckPages),
    // which would otherwise clobber in-progress edit-mode changes on every
    // tick even when nothing actually changed upstream. Only push when the
    // resolved pages differ from what was last pushed.
    let lastPushed: string | null = null;
    const interval = setInterval(() => {
      if (polling) {
        return;
      }
      polling = true;
      this.invoke("list_source_pages")
        .then(async (result) => {
          const pages = result as DeckPage[] | null;
          const next = pages && pages.length > 0 ? pages : await this.fallback.getPages();
          const serialized = JSON.stringify(next);
          if (serialized !== lastPushed) {
            lastPushed = serialized;
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
