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
  // Set as soon as the user changes anything, so a slow initial load can't
  // clobber an edit that happened before it resolved.
  const hasUserUpdate = useRef(false);
  // Chains saves so an older write's I/O can never finish after a newer
  // one's and leave stale data on disk — each save starts only once the
  // previous one has settled.
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    storage
      .load()
      .then((value) => {
        if (cancelled) {
          return;
        }
        if (!hasUserUpdate.current) {
          skipNextSave.current = true;
          setSettings(parseDeckSettings(value));
        }
        setReady(true);
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
    saveQueue.current = saveQueue.current
      .then(() => storage.save(settings))
      .catch((error) => {
        console.error("[deck] failed to save settings", error);
      });
  }, [settings, ready, storage]);

  const update = useCallback((patch: Partial<DeckSettings>) => {
    hasUserUpdate.current = true;
    // An update before `ready` bails out of the persistence effect via its
    // own `!ready` check, without ever reaching the skipNextSave branch below
    // — so skipNextSave.current is still whatever it was initialized to
    // (true) and would otherwise cause that edit to be silently skipped once
    // `ready` flips. Clear it here so the eventual save actually happens.
    skipNextSave.current = false;
    setSettings((current) => parseDeckSettings({ ...current, ...patch }));
  }, []);

  return { settings, ready, update };
}
