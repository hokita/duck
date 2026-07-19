/** True when running inside a Tauri WebView (vs plain browser or jsdom). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function setWindowAlwaysOnTop(value: boolean): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setAlwaysOnTop(value);
}

/**
 * Manually drags the window by tracking mouse deltas and repositioning it via
 * `setPosition`. `data-tauri-drag-region` (which calls the built-in
 * `start_dragging` command, backed by macOS's `performWindowDragWithEvent:`)
 * is a silent no-op for this window: that native API only works when invoked
 * synchronously from a live mouseDown, and Tauri's WKWebView bridge calls it
 * asynchronously, so the call succeeds but never actually moves the window.
 */
export async function startWindowDrag(origin: { screenX: number; screenY: number }): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const { getCurrentWindow, LogicalPosition } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  const scaleFactor = await win.scaleFactor();
  const start = (await win.outerPosition()).toLogical(scaleFactor);

  const onMouseMove = (event: MouseEvent) => {
    void win.setPosition(
      new LogicalPosition(
        start.x + (event.screenX - origin.screenX),
        start.y + (event.screenY - origin.screenY),
      ),
    );
  };
  const stopDragging = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stopDragging);
  };
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", stopDragging);
}

export async function closeAppWindow(): Promise<void> {
  if (!isTauri()) {
    console.info("[deck] close requested outside Tauri; ignoring");
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}
