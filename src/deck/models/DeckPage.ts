import type { DeckButton } from "./DeckButton";

export interface DeckPage {
  id: string;
  name: string;
  buttons: DeckButton[];
}
