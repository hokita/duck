import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scaleFactor = vi.fn();
const outerPosition = vi.fn();
const setPosition = vi.fn();

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
    scaleFactor.mockReset().mockResolvedValue(2);
    outerPosition.mockReset().mockResolvedValue({
      toLogical: (factor: number) => ({ x: 100 / factor, y: 100 / factor }),
    });
    setPosition.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
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
    window.dispatchEvent(new MouseEvent("mousemove", { screenX: 70, screenY: 65, buttons: 1 }));
    expect(setPosition).toHaveBeenCalledTimes(1);
    expect(setPosition).toHaveBeenCalledWith(expect.objectContaining({ x: 70, y: 65 }));

    window.dispatchEvent(new MouseEvent("mouseup"));
    window.dispatchEvent(new MouseEvent("mousemove", { screenX: 999, screenY: 999, buttons: 1 }));
    expect(setPosition).toHaveBeenCalledTimes(1);
  });

  it("ignores a mouseup that arrives before the async window setup finishes", async () => {
    const { startWindowDrag } = await import("./tauri");
    const dragPromise = startWindowDrag({ screenX: 50, screenY: 50 });

    // A quick click releases before the dynamic import / Tauri calls resolve.
    window.dispatchEvent(new MouseEvent("mouseup"));
    await dragPromise;

    window.dispatchEvent(new MouseEvent("mousemove", { screenX: 999, screenY: 999, buttons: 1 }));
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("stops dragging when the window loses focus", async () => {
    const { startWindowDrag } = await import("./tauri");
    await startWindowDrag({ screenX: 50, screenY: 50 });

    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new MouseEvent("mousemove", { screenX: 999, screenY: 999, buttons: 1 }));
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("stops dragging once a mousemove reports the primary button released", async () => {
    const { startWindowDrag } = await import("./tauri");
    await startWindowDrag({ screenX: 50, screenY: 50 });

    // Mouse re-enters the webview after being released outside it.
    window.dispatchEvent(new MouseEvent("mousemove", { screenX: 999, screenY: 999, buttons: 0 }));
    expect(setPosition).not.toHaveBeenCalled();

    window.dispatchEvent(new MouseEvent("mousemove", { screenX: 998, screenY: 998, buttons: 1 }));
    expect(setPosition).not.toHaveBeenCalled();
  });
});
