import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK_SETTINGS } from "../models/DeckSettings";
import { Deck } from "./Deck";

const baseProps = {
  page: null,
  loading: false,
  error: false,
  settings: DEFAULT_DECK_SETTINGS,
  mode: "deck" as const,
  selectedButtonId: null,
  onActivate: vi.fn(),
  onSelect: vi.fn(),
  onRetry: vi.fn(),
};

describe("Deck", () => {
  it("shows an error state with retry when the provider failed", async () => {
    const onRetry = vi.fn();
    render(<Deck {...baseProps} error onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t load/i);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows a loading state", () => {
    render(<Deck {...baseProps} loading />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no pages", () => {
    render(<Deck {...baseProps} />);
    expect(screen.getByText(/no deck pages/i)).toBeInTheDocument();
  });

  it("renders the grid when a page is available", () => {
    render(
      <Deck
        {...baseProps}
        page={{ id: "p1", name: "P1", buttons: [{ id: "a", title: "A" }] }}
      />,
    );
    expect(screen.getByRole("button", { name: "A" })).toBeInTheDocument();
  });
});
