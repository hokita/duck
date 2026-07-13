import { useCallback, useEffect, useMemo, useState } from "react";
import { Deck } from "../deck/components/Deck";
import { DeckToolbar } from "../deck/components/DeckToolbar";
import type { DeckButton } from "../deck/models/DeckButton";
import { useDeckPages } from "../deck/state/useDeckPages";
import { usePageNavigation } from "../deck/state/usePageNavigation";
import { EditorPanel } from "../editor/components/EditorPanel";
import { moveButton, updateButton, type MoveDirection } from "../editor/editOperations";
import { SettingsPanel } from "../settings/components/SettingsPanel";
import { useDeckSettings } from "../settings/useDeckSettings";
import { closeAppWindow, setWindowAlwaysOnTop } from "../shared/tauri";
import { createAppDependencies, type AppDependencies } from "./providers";

export type { AppDependencies };

export default function App({ dependencies }: { dependencies?: AppDependencies }) {
  const deps = useMemo(() => dependencies ?? createAppDependencies(), [dependencies]);
  const { settings, ready, update } = useDeckSettings(deps.settingsStorage);
  const { pages, loading, error, setPages, reload } = useDeckPages(deps.provider);
  const navigation = usePageNavigation(pages);
  const [mode, setMode] = useState<"deck" | "edit">("deck");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);

  const { goToPage } = navigation;
  useEffect(
    () =>
      deps.dispatcher.register("navigate", (action) => {
        goToPage(action.pageId);
      }),
    [deps.dispatcher, goToPage],
  );

  useEffect(
    () =>
      deps.dispatcher.register("custom", (action) => {
        if (action.actionId === "open-settings") {
          setSettingsOpen(true);
          return;
        }
        console.warn(`[deck] unknown custom action "${action.actionId}"`);
      }),
    [deps.dispatcher],
  );

  useEffect(() => {
    if (ready) {
      void setWindowAlwaysOnTop(settings.alwaysOnTop);
    }
  }, [ready, settings.alwaysOnTop]);

  const handleActivate = useCallback(
    (button: DeckButton) => {
      void deps.dispatcher.dispatch(button.action);
    },
    [deps.dispatcher],
  );

  const currentPage = navigation.currentPage;
  const selectedButton =
    currentPage?.buttons.find((button) => button.id === selectedButtonId) ?? null;
  const selectedIndex =
    currentPage?.buttons.findIndex((button) => button.id === selectedButtonId) ?? -1;

  const handleToggleEdit = () => {
    setMode((current) => (current === "deck" ? "edit" : "deck"));
    setSelectedButtonId(null);
  };

  const handleUpdate = (patch: Partial<Omit<DeckButton, "id">>) => {
    if (currentPage && selectedButtonId) {
      setPages((current) =>
        updateButton(current, currentPage.id, selectedButtonId, patch),
      );
    }
  };

  const handleMove = (direction: MoveDirection) => {
    if (currentPage && selectedIndex >= 0) {
      setPages((current) =>
        moveButton(current, currentPage.id, selectedIndex, direction, settings.columns),
      );
    }
  };

  const handleRestore = () => {
    setSelectedButtonId(null);
    reload();
  };

  return (
    <div className={`deck-shell${settings.compact ? " deck-shell--compact" : ""}`}>
      <DeckToolbar
        pageIndex={navigation.pageIndex}
        pageCount={navigation.pageCount}
        mode={mode}
        onToggleEdit={handleToggleEdit}
        onOpenSettings={() => setSettingsOpen(true)}
        onClose={() => void closeAppWindow()}
      />
      <main className="deck-main">
        <Deck
          page={currentPage}
          loading={loading || !ready}
          error={error}
          settings={settings}
          mode={mode}
          selectedButtonId={selectedButtonId}
          onActivate={handleActivate}
          onSelect={(button) => setSelectedButtonId(button.id)}
          onRetry={reload}
        />
      </main>
      {mode === "edit" ? (
        <EditorPanel
          selectedButton={selectedButton}
          onUpdate={handleUpdate}
          onMove={handleMove}
          onRestore={handleRestore}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          onChange={update}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}
