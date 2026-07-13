import type { CSSProperties } from "react";
import type { DeckButton } from "../models/DeckButton";

export interface DeckButtonViewProps {
  button: DeckButton | null;
  size: number;
  compact: boolean;
  mode: "deck" | "edit";
  selected?: boolean;
  onActivate?(button: DeckButton): void;
  onSelect?(button: DeckButton): void;
}

export function DeckButtonView({
  button,
  size,
  compact,
  mode,
  selected = false,
  onActivate,
  onSelect,
}: DeckButtonViewProps) {
  const style = { "--button-size": `${size}px` } as CSSProperties;

  if (!button) {
    return (
      <div className="deck-button deck-button--empty" style={style} aria-hidden="true" />
    );
  }

  const isPlaceholder = !button.title && !button.icon && !button.action;
  const classes = [
    "deck-button",
    compact ? "deck-button--compact" : "",
    selected ? "deck-button--selected" : "",
    isPlaceholder ? "deck-button--placeholder" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    if (mode === "edit") {
      onSelect?.(button);
      return;
    }
    if (!isPlaceholder) {
      onActivate?.(button);
    }
  };

  return (
    <button
      type="button"
      className={classes}
      style={style}
      disabled={mode === "deck" && (button.disabled ?? false)}
      aria-label={button.title ?? "Empty button"}
      onClick={handleClick}
    >
      {button.badge ? <span className="deck-button__badge">{button.badge}</span> : null}
      <span className="deck-button__icon" aria-hidden="true">
        {button.icon ?? ""}
      </span>
      {button.title ? <span className="deck-button__title">{button.title}</span> : null}
      {!compact && button.subtitle ? (
        <span className="deck-button__subtitle">{button.subtitle}</span>
      ) : null}
      <span
        className="deck-button__status"
        data-status={button.status ?? "idle"}
        aria-hidden="true"
      />
    </button>
  );
}
