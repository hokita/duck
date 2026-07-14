import type { SettingsStorage } from "./SettingsStorage";

/**
 * Persists settings through fixed-path Rust commands (load_settings /
 * save_settings in src-tauri/src/lib.rs), backed by tauri-plugin-store's
 * Rust-side API. The WebView is granted no store:* permission — deliberately,
 * so it can't choose an arbitrary file path to read or write — only these two
 * commands, whose store file and key are hardcoded on the Rust side. Only
 * used inside Tauri; jsdom tests cover the localStorage backend instead
 * because these commands need a native host.
 */
export class TauriStoreSettingsStorage implements SettingsStorage {
  async load(): Promise<unknown> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("load_settings");
    } catch (error) {
      console.error("[deck] failed to load settings store", error);
      return null;
    }
  }

  async save(value: unknown): Promise<void> {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_settings", { value });
  }
}
