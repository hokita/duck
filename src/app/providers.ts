import { DeckActionDispatcher } from "../deck/actions/DeckActionDispatcher";
import type { DeckButtonProvider } from "../deck/providers/DeckButtonProvider";
import { MockDeckButtonProvider } from "../deck/providers/MockDeckButtonProvider";
import {
  createSettingsStorage,
  type SettingsStorage,
} from "../settings/storage/SettingsStorage";

export interface AppDependencies {
  provider: DeckButtonProvider;
  dispatcher: DeckActionDispatcher;
  settingsStorage: SettingsStorage;
}

export const SETTINGS_KEY = "duck.deck-settings";

/**
 * Composition root. Swapping the mock provider for a real one
 * (e.g. new ClaudeCodeButtonProvider()) happens here and only here.
 */
export function createAppDependencies(): AppDependencies {
  const dispatcher = new DeckActionDispatcher();
  dispatcher.register("log", (action) => {
    console.log(`[deck] ${action.message}`);
  });
  return {
    provider: new MockDeckButtonProvider(),
    dispatcher,
    settingsStorage: createSettingsStorage(SETTINGS_KEY),
  };
}
