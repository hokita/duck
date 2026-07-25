import type { MouseEvent as ReactMouseEvent } from "react";

export interface DeckToolbarProps {
  pageIndex: number;
  pageCount: number;
  mode: "deck" | "edit";
  onToggleEdit(): void;
  onOpenSettings(): void;
  onClose(): void;
  onDragStart(event: ReactMouseEvent<HTMLElement>): void;
}

export function DeckToolbar({
  pageIndex,
  pageCount,
  mode,
  onToggleEdit,
  onOpenSettings,
  onClose,
  onDragStart,
}: DeckToolbarProps) {
  const shownCount = Math.max(pageCount, 1);
  const handleMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    onDragStart(event);
  };
  return (
    <header className="deck-toolbar" onMouseDown={handleMouseDown}>
      <span className="deck-toolbar__title">DUCK</span>
      <span
        className="deck-toolbar__pages"
        role="status"
        aria-label={`Page ${pageIndex + 1} of ${shownCount}`}
      >
        {Array.from({ length: shownCount }, (_, index) => (
          <span
            key={index}
            className={
              index === pageIndex
                ? "deck-toolbar__dot deck-toolbar__dot--active"
                : "deck-toolbar__dot"
            }
          />
        ))}
      </span>
      <span className="deck-toolbar__actions">
        <button
          type="button"
          className="deck-toolbar__button"
          aria-label="Toggle edit mode"
          aria-pressed={mode === "edit"}
          onClick={onToggleEdit}
        >
          ✎
        </button>
        <button
          type="button"
          className="deck-toolbar__button"
          aria-label="Open settings"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
        <button
          type="button"
          className="deck-toolbar__button"
          aria-label="Close window"
          onClick={onClose}
        >
          ✕
        </button>
      </span>
    </header>
  );
}
