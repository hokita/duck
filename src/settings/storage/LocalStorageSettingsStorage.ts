import type { SettingsStorage } from "./SettingsStorage";

export class LocalStorageSettingsStorage implements SettingsStorage {
  constructor(private readonly key: string) {}

  async load(): Promise<unknown> {
    const raw = window.localStorage.getItem(this.key);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async save(value: unknown): Promise<void> {
    window.localStorage.setItem(this.key, JSON.stringify(value));
  }
}
