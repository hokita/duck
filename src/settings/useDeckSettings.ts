import { useCallback, useEffect, useState } from "react";
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

  const update = useCallback(
    (patch: Partial<DeckSettings>) => {
      setSettings((current) => {
        const next = parseDeckSettings({ ...current, ...patch });
        storage.save(next).catch((error) => {
          console.error("[deck] failed to save settings", error);
        });
        return next;
      });
    },
    [storage],
  );

  return { settings, ready, update };
}
