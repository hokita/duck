import type { DeckPage } from "../models/DeckPage";

/**
 * Source of deck content. The UI depends only on this interface;
 * swapping in e.g. a ClaudeCodeButtonProvider requires no UI changes.
 */
export interface DeckButtonProvider {
  getPages(): Promise<DeckPage[]>;
  /** Optional push updates. Returns an unsubscribe function. */
  subscribe?(listener: (pages: DeckPage[]) => void): () => void;
}
