import { describe, expect, it } from "vitest";
import type { DeckPage } from "../deck/models/DeckPage";
import { moveButton, updateButton } from "./editOperations";

const page = (buttons: { id: string }[]): DeckPage => ({
  id: "p1",
  name: "Page 1",
  buttons,
});

describe("updateButton", () => {
  it("patches only the targeted button and returns new objects", () => {
    const pages = [page([{ id: "a" }, { id: "b" }])];
    const next = updateButton(pages, "p1", "a", { title: "Hello" });
    expect(next[0].buttons[0].title).toBe("Hello");
    expect(next[0].buttons[1].title).toBeUndefined();
    expect(pages[0].buttons[0].title).toBeUndefined();
  });
});

describe("moveButton", () => {
  // 3-column layout:  a b c
  //                    d e
  const pages = () => [
    page([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }]),
  ];

  it("swaps horizontally within a row", () => {
    const next = moveButton(pages(), "p1", 0, "right", 3);
    expect(next[0].buttons.map((b) => b.id)).toEqual(["b", "a", "c", "d", "e"]);
  });

  it("does not wrap across row edges", () => {
    const next = moveButton(pages(), "p1", 2, "right", 3);
    expect(next[0].buttons.map((b) => b.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("swaps vertically by one row", () => {
    const next = moveButton(pages(), "p1", 0, "down", 3);
    expect(next[0].buttons.map((b) => b.id)).toEqual(["d", "b", "c", "a", "e"]);
  });

  it("ignores moves that leave the button list", () => {
    const next = moveButton(pages(), "p1", 4, "down", 3);
    expect(next[0].buttons.map((b) => b.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
