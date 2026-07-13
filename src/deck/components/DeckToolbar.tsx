export interface DeckToolbarProps {
  pageIndex: number;
  pageCount: number;
  mode: "deck" | "edit";
  onToggleEdit(): void;
  onOpenSettings(): void;
  onClose(): void;
}

export function DeckToolbar({
  pageIndex,
  pageCount,
  mode,
  onToggleEdit,
  onOpenSettings,
  onClose,
}: DeckToolbarProps) {
  const shownCount = Math.max(pageCount, 1);
  return (
    <header className="deck-toolbar" data-tauri-drag-region>
      <span className="deck-toolbar__title" data-tauri-drag-region>
        DUCK
      </span>
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
