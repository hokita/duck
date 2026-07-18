import { DeckActionDispatcher } from "../deck/actions/DeckActionDispatcher";
import type { DeckButtonProvider } from "../deck/providers/DeckButtonProvider";
import { MockDeckButtonProvider } from "../deck/providers/MockDeckButtonProvider";
import {
  createSettingsStorage,
  type SettingsStorage,
} from "../settings/storage/SettingsStorage";
import { ExternalSourceProvider } from "../sources/ExternalSourceProvider";

export interface AppDependencies {
  provider: DeckButtonProvider;
  dispatcher: DeckActionDispatcher;
  settingsStorage: SettingsStorage;
}

export const SETTINGS_KEY = "duck.deck-settings";

/**
 * Composition root. Pages come from configured external sources when a
 * sources.json exists; the mock deck remains the fallback demo.
 */
export function createAppDependencies(): AppDependencies {
  const dispatcher = new DeckActionDispatcher();
  dispatcher.register("log", (action) => {
    console.log(`[deck] ${action.message}`);
  });
  return {
    provider: new ExternalSourceProvider(new MockDeckButtonProvider()),
    dispatcher,
    settingsStorage: createSettingsStorage(SETTINGS_KEY),
  };
}
