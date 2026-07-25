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
 *
 * Listeners are attached synchronously (before the first `await`) so a quick
 * click that releases before the Tauri window APIs resolve is never missed;
 * `active` then gates whether the async setup is allowed to start repositioning
 * at all. Because plain mouse events aren't captured outside the webview
 * bounds, a `blur` (window loses focus) also ends the drag, and every move is
 * double-checked against `event.buttons` in case a mouseup was released
 * outside the webview and never reached us.
 */
export async function startWindowDrag(origin: { screenX: number; screenY: number }): Promise<void> {
  if (!isTauri()) {
    return;
  }

  let active = true;
  let reposition: ((event: MouseEvent) => void) | null = null;

  const onMouseMove = (event: MouseEvent) => {
    if ((event.buttons & 1) === 0) {
      stopDragging();
      return;
    }
    reposition?.(event);
  };
  const stopDragging = () => {
    active = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stopDragging);
    window.removeEventListener("blur", stopDragging);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", stopDragging);
  window.addEventListener("blur", stopDragging);

  const { getCurrentWindow, LogicalPosition } = await import("@tauri-apps/api/window");
  if (!active) return;
  const win = getCurrentWindow();
  const scaleFactor = await win.scaleFactor();
  if (!active) return;
  const start = (await win.outerPosition()).toLogical(scaleFactor);
  if (!active) return;

  reposition = (event) => {
    win
      .setPosition(
        new LogicalPosition(
          start.x + (event.screenX - origin.screenX),
          start.y + (event.screenY - origin.screenY),
        ),
      )
      .catch((error) => {
        console.error("[deck] failed to reposition window", error);
      });
  };
}

export async function closeAppWindow(): Promise<void> {
  if (!isTauri()) {
    console.info("[deck] close requested outside Tauri; ignoring");
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}
