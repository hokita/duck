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

export async function closeAppWindow(): Promise<void> {
  if (!isTauri()) {
    console.info("[deck] close requested outside Tauri; ignoring");
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}
