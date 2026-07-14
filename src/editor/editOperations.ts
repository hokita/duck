import type { DeckButton } from "../deck/models/DeckButton";
import type { DeckPage } from "../deck/models/DeckPage";

export type MoveDirection = "left" | "right" | "up" | "down";

export function updateButton(
  pages: DeckPage[],
  pageId: string,
  buttonId: string,
  patch: Partial<Omit<DeckButton, "id">>,
): DeckPage[] {
  return pages.map((page) =>
    page.id !== pageId
      ? page
      : {
          ...page,
          buttons: page.buttons.map((button) =>
            button.id === buttonId ? { ...button, ...patch } : button,
          ),
        },
  );
}

function targetIndex(index: number, direction: MoveDirection, columns: number): number {
  switch (direction) {
    case "left":
      return index % columns === 0 ? -1 : index - 1;
    case "right":
      return index % columns === columns - 1 ? -1 : index + 1;
    case "up":
      return index - columns;
    case "down":
      return index + columns;
  }
}

export function moveButton(
  pages: DeckPage[],
  pageId: string,
  fromIndex: number,
  direction: MoveDirection,
  columns: number,
): DeckPage[] {
  return pages.map((page) => {
    if (page.id !== pageId) {
      return page;
    }
    const to = targetIndex(fromIndex, direction, columns);
    const inRange = (i: number) => i >= 0 && i < page.buttons.length;
    if (!inRange(fromIndex) || !inRange(to)) {
      return page;
    }
    const buttons = [...page.buttons];
    [buttons[fromIndex], buttons[to]] = [buttons[to], buttons[fromIndex]];
    return { ...page, buttons };
  });
}
