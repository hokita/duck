import { describe, expect, it } from "vitest";
import { isImageIcon } from "./DeckButton";

describe("isImageIcon", () => {
  it("returns true for a data:image URI", () => {
    expect(isImageIcon("data:image/png;base64,AAA")).toBe(true);
  });

  it("returns false for an emoji glyph", () => {
    expect(isImageIcon("🖥️")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isImageIcon(undefined)).toBe(false);
  });

  it("returns true for an uppercase/mixed-case media type", () => {
    expect(isImageIcon("data:IMAGE/PNG;base64,AAA")).toBe(true);
  });
});
