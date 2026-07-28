import type { DeckButtonAction } from "../actions/DeckAction";

export type DeckButtonStatus =
  "idle" | "active" | "working" | "done" | "warning" | "error";

export interface DeckButton {
  id: string;
  title?: string;
  subtitle?: string;
  /** Emoji/short glyph, or a `data:image/...` URI rendered as an image. */
  icon?: string;
  status?: DeckButtonStatus;
  badge?: string;
  disabled?: boolean;
  action?: DeckButtonAction;
}

export function isImageIcon(icon?: string): boolean {
  return icon?.startsWith("data:image/") ?? false;
}
