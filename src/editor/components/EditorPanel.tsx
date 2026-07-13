import type { DeckButton, DeckButtonStatus } from "../../deck/models/DeckButton";
import type { MoveDirection } from "../editOperations";

const STATUSES: DeckButtonStatus[] = [
  "idle",
  "active",
  "working",
  "done",
  "warning",
  "error",
];

export interface EditorPanelProps {
  selectedButton: DeckButton | null;
  onUpdate(patch: Partial<Omit<DeckButton, "id">>): void;
  onMove(direction: MoveDirection): void;
  onRestore(): void;
}

export function EditorPanel({
  selectedButton,
  onUpdate,
  onMove,
  onRestore,
}: EditorPanelProps) {
  return (
    <section className="deck-panel" aria-label="Button editor">
      <div className="deck-panel__header">
        <h2 className="deck-panel__title">Edit mode</h2>
        <button type="button" onClick={onRestore}>
          Restore mock configuration
        </button>
      </div>
      {!selectedButton ? (
        <p>Select a button in the grid to edit it.</p>
      ) : (
        <>
          <div className="deck-panel__row">
            <label>
              Title
              <input
                type="text"
                value={selectedButton.title ?? ""}
                onChange={(event) => onUpdate({ title: event.target.value || undefined })}
              />
            </label>
            <label>
              Subtitle
              <input
                type="text"
                value={selectedButton.subtitle ?? ""}
                onChange={(event) =>
                  onUpdate({ subtitle: event.target.value || undefined })
                }
              />
            </label>
          </div>
          <div className="deck-panel__row">
            <label>
              Status
              <select
                value={selectedButton.status ?? "idle"}
                onChange={(event) =>
                  onUpdate({ status: event.target.value as DeckButtonStatus })
                }
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Disabled
              <input
                type="checkbox"
                checked={selectedButton.disabled ?? false}
                onChange={(event) => onUpdate({ disabled: event.target.checked })}
              />
            </label>
          </div>
          <div className="deck-panel__row">
            <button type="button" aria-label="Move left" onClick={() => onMove("left")}>
              ←
            </button>
            <button type="button" aria-label="Move right" onClick={() => onMove("right")}>
              →
            </button>
            <button type="button" aria-label="Move up" onClick={() => onMove("up")}>
              ↑
            </button>
            <button type="button" aria-label="Move down" onClick={() => onMove("down")}>
              ↓
            </button>
          </div>
        </>
      )}
    </section>
  );
}
