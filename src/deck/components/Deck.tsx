import type { DeckButton } from "../models/DeckButton";
import type { DeckPage } from "../models/DeckPage";
import type { DeckSettings } from "../models/DeckSettings";
import { DeckGrid } from "./DeckGrid";

export interface DeckProps {
  page: DeckPage | null;
  loading: boolean;
  error: boolean;
  settings: DeckSettings;
  mode: "deck" | "edit";
  selectedButtonId: string | null;
  onActivate(button: DeckButton): void;
  onSelect(button: DeckButton): void;
  onRetry(): void;
}

export function Deck({
  page,
  loading,
  error,
  settings,
  mode,
  selectedButtonId,
  onActivate,
  onSelect,
  onRetry,
}: DeckProps) {
  if (error) {
    return (
      <div className="deck-state" role="alert">
        <p>Couldn’t load deck buttons.</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="deck-state">
        <p>Loading…</p>
      </div>
    );
  }
  if (!page) {
    return (
      <div className="deck-state">
        <p>No deck pages available.</p>
      </div>
    );
  }
  return (
    <DeckGrid
      page={page}
      settings={settings}
      mode={mode}
      selectedButtonId={selectedButtonId}
      onActivate={onActivate}
      onSelect={onSelect}
    />
  );
}
