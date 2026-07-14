import { describe, expect, it } from "vitest";
import { MockDeckButtonProvider } from "./MockDeckButtonProvider";

describe("MockDeckButtonProvider", () => {
  it("returns at least two pages with buttons", async () => {
    const pages = await new MockDeckButtonProvider().getPages();
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].buttons.length).toBeGreaterThan(0);
  });

  it("uses globally unique button ids", async () => {
    const pages = await new MockDeckButtonProvider().getPages();
    const ids = pages.flatMap((page) => page.buttons.map((button) => button.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("demonstrates every visual status plus disabled and empty buttons", async () => {
    const pages = await new MockDeckButtonProvider().getPages();
    const buttons = pages.flatMap((page) => page.buttons);
    const statuses = new Set(buttons.map((button) => button.status));
    for (const status of ["active", "working", "done", "warning", "error"]) {
      expect(statuses).toContain(status);
    }
    expect(buttons.some((button) => button.disabled)).toBe(true);
    expect(
      buttons.some((button) => !button.title && !button.icon && !button.action),
    ).toBe(true);
  });

  it("returns fresh copies so callers cannot mutate the source data", async () => {
    const provider = new MockDeckButtonProvider();
    const first = await provider.getPages();
    first[0].buttons[0].title = "MUTATED";
    const second = await provider.getPages();
    expect(second[0].buttons[0].title).not.toBe("MUTATED");
  });
});
