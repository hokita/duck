import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DeckPage } from "../models/DeckPage";
import { DEFAULT_DECK_SETTINGS } from "../models/DeckSettings";
import { DeckGrid } from "./DeckGrid";

const makePage = (count: number): DeckPage => ({
  id: "p1",
  name: "Page 1",
  buttons: Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    title: `Button ${i}`,
  })),
});

const renderGrid = (page: DeckPage, settings = DEFAULT_DECK_SETTINGS) =>
  render(
    <DeckGrid
      page={page}
      settings={settings}
      mode="deck"
      selectedButtonId={null}
      onActivate={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

describe("DeckGrid", () => {
  it("renders every provided button", () => {
    renderGrid(makePage(4));
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("pads sparse pages with empty filler slots up to capacity", () => {
    const { container } = renderGrid(makePage(4));
    expect(container.querySelectorAll(".deck-button--empty")).toHaveLength(11);
  });

  it("hides overflowing buttons and says how many", () => {
    renderGrid(makePage(20));
    expect(screen.getAllByRole("button")).toHaveLength(15);
    expect(screen.getByText(/5 buttons hidden/)).toBeInTheDocument();
  });

  it("is labelled with the page name", () => {
    renderGrid(makePage(1));
    expect(screen.getByRole("group", { name: "Deck page: Page 1" })).toBeInTheDocument();
  });
});
