import type { SettingsStorage } from "./SettingsStorage";

/**
 * Persists settings through the official tauri-plugin-store (a JSON file in
 * the app data directory). Only used inside Tauri; jsdom tests cover the
 * localStorage backend instead because the plugin needs a native host.
 */
export class TauriStoreSettingsStorage implements SettingsStorage {
  constructor(
    private readonly key: string,
    private readonly file: string = "settings.json",
  ) {}

  async load(): Promise<unknown> {
    try {
      const store = await this.openStore();
      return (await store.get(this.key)) ?? null;
    } catch (error) {
      console.error("[deck] failed to load settings store", error);
      return null;
    }
  }

  async save(value: unknown): Promise<void> {
    const store = await this.openStore();
    await store.set(this.key, value);
    await store.save();
  }

  private async openStore() {
    const { load } = await import("@tauri-apps/plugin-store");
    return load(this.file, { autoSave: false });
  }
}
