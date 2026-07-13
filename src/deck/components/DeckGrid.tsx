import type { CSSProperties } from "react";
import type { DeckButton } from "../models/DeckButton";
import type { DeckPage } from "../models/DeckPage";
import type { DeckSettings } from "../models/DeckSettings";
import { DeckButtonView } from "./DeckButtonView";

export interface DeckGridProps {
  page: DeckPage;
  settings: DeckSettings;
  mode: "deck" | "edit";
  selectedButtonId: string | null;
  onActivate(button: DeckButton): void;
  onSelect(button: DeckButton): void;
}

export function DeckGrid({
  page,
  settings,
  mode,
  selectedButtonId,
  onActivate,
  onSelect,
}: DeckGridProps) {
  const capacity = settings.columns * settings.rows;
  const visible = page.buttons.slice(0, capacity);
  const hiddenCount = page.buttons.length - visible.length;
  const slots: (DeckButton | null)[] = [
    ...visible,
    ...Array<null>(Math.max(capacity - visible.length, 0)).fill(null),
  ];
  const gridStyle = {
    "--deck-columns": settings.columns,
    "--deck-gap": `${settings.gap}px`,
  } as CSSProperties;

  return (
    <div className="deck-grid-wrap">
      <div
        className="deck-grid"
        role="group"
        aria-label={`Deck page: ${page.name}`}
        style={gridStyle}
      >
        {slots.map((slot, index) => (
          <DeckButtonView
            key={slot?.id ?? `filler-${index}`}
            button={slot}
            size={settings.buttonSize}
            compact={settings.compact}
            mode={mode}
            selected={slot !== null && slot.id === selectedButtonId}
            onActivate={onActivate}
            onSelect={onSelect}
          />
        ))}
      </div>
      {hiddenCount > 0 ? (
        <p className="deck-grid__overflow">
          {hiddenCount} button{hiddenCount === 1 ? "" : "s"} hidden — add rows or columns
          in settings
        </p>
      ) : null}
    </div>
  );
}
