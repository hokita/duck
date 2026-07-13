import type { DeckButtonAction } from "../actions/DeckAction";

export type DeckButtonStatus =
  "idle" | "active" | "working" | "done" | "warning" | "error";

export interface DeckButton {
  id: string;
  title?: string;
  subtitle?: string;
  /** Emoji or short glyph rendered in the icon area. */
  icon?: string;
  status?: DeckButtonStatus;
  badge?: string;
  disabled?: boolean;
  action?: DeckButtonAction;
}
