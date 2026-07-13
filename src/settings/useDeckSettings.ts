import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_DECK_SETTINGS,
  parseDeckSettings,
  type DeckSettings,
} from "../deck/models/DeckSettings";
import type { SettingsStorage } from "./storage/SettingsStorage";

export interface DeckSettingsState {
  settings: DeckSettings;
  /** False until the initial load resolved (prevents flashing defaults). */
  ready: boolean;
  update(patch: Partial<DeckSettings>): void;
}

export function useDeckSettings(storage: SettingsStorage): DeckSettingsState {
  const [settings, setSettings] = useState<DeckSettings>(DEFAULT_DECK_SETTINGS);
  const [ready, setReady] = useState(false);
  // Skips persisting the settings load itself; only user-driven updates
  // (below) should write back to storage.
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    storage
      .load()
      .then((value) => {
        if (!cancelled) {
          setSettings(parseDeckSettings(value));
          setReady(true);
        }
      })
      .catch((error) => {
        console.error("[deck] failed to load settings", error);
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Persisting here (rather than inside the setSettings updater in `update`)
  // keeps the updater pure — a state updater can run twice under Strict Mode,
  // which would otherwise cause duplicate/racing writes.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    storage.save(settings).catch((error) => {
      console.error("[deck] failed to save settings", error);
    });
  }, [settings, ready, storage]);

  const update = useCallback((patch: Partial<DeckSettings>) => {
    setSettings((current) => parseDeckSettings({ ...current, ...patch }));
  }, []);

  return { settings, ready, update };
}
