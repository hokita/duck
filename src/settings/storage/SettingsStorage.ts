import { isTauri } from "../../shared/tauri";
import { LocalStorageSettingsStorage } from "./LocalStorageSettingsStorage";
import { TauriStoreSettingsStorage } from "./TauriStoreSettingsStorage";

export interface SettingsStorage {
  /** Resolves to the stored JSON value, or null when absent/unreadable. */
  load(): Promise<unknown>;
  save(value: unknown): Promise<void>;
}

export function createSettingsStorage(key: string): SettingsStorage {
  return isTauri()
    ? new TauriStoreSettingsStorage()
    : new LocalStorageSettingsStorage(key);
}
