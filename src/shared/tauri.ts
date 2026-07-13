/** True when running inside a Tauri WebView (vs plain browser or jsdom). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
