import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scaleFactor = vi.fn(async () => 2);
const outerPosition = vi.fn(async () => ({
  toLogical: (factor: number) => ({ x: 100 / factor, y: 100 / factor }),
}));
const setPosition = vi.fn(async () => undefined);

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ scaleFactor, outerPosition, setPosition }),
  LogicalPosition: class {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

describe("startWindowDrag", () => {
  beforeEach(() => {
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  });

  afterEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    vi.clearAllMocks();
  });

  it("does nothing outside Tauri", async () => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    const { startWindowDrag } = await import("./tauri");
    await startWindowDrag({ screenX: 0, screenY: 0 });
    window.dispatchEvent(new MouseEvent("mousemove", { screenX: 10, screenY: 10 }));
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("moves the window by the mouse delta while dragging, and stops on mouseup", async () => {
    const { startWindowDrag } = await import("./tauri");
    await startWindowDrag({ screenX: 50, screenY: 50 });

    // origin is physical (100, 100) / scaleFactor 2 = logical (50, 50)
    window.dispatchEvent(new MouseEvent("mousemove", { screenX: 70, screenY: 65 }));
    expect(setPosition).toHaveBeenCalledTimes(1);
    expect(setPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 70, y: 65 }));

    window.dispatchEvent(new MouseEvent("mouseup"));
    window.dispatchEvent(new MouseEvent("mousemove", { screenX: 999, screenY: 999 }));
    expect(setPosition).toHaveBeenCalledTimes(1);
  });
});
