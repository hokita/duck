export type DeckButtonAction =
  | { type: "log"; message: string }
  | { type: "navigate"; pageId: string }
  | { type: "custom"; actionId: string; payload?: Record<string, unknown> };

/** Reserved pageId values understood by the navigate handler. */
export const RESERVED_PAGE_IDS = ["next", "previous", "home"] as const;
