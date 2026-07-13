import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeckActionDispatcher } from "../deck/actions/DeckActionDispatcher";
import type { DeckPage } from "../deck/models/DeckPage";
import type { DeckButtonProvider } from "../deck/providers/DeckButtonProvider";
import { LocalStorageSettingsStorage } from "../settings/storage/LocalStorageSettingsStorage";
import App, { type AppDependencies } from "./App";

const pages: DeckPage[] = [
  {
    id: "main",
    name: "Main",
    buttons: [
      { id: "hello", title: "Hello", action: { type: "log", message: "hello!" } },
      { id: "next", title: "Next", action: { type: "navigate", pageId: "next" } },
    ],
  },
  {
    id: "second",
    name: "Second",
    buttons: [
      { id: "back", title: "Back", action: { type: "navigate", pageId: "previous" } },
      { id: "only-here", title: "Only Here" },
    ],
  },
];

const makeDeps = (overrides: Partial<AppDependencies> = {}): AppDependencies => {
  const dispatcher = new DeckActionDispatcher();
  dispatcher.register("log", (action) => console.log(action.message));
  return {
    provider: { getPages: async () => structuredClone(pages) },
    dispatcher,
    settingsStorage: new LocalStorageSettingsStorage("duck.test.settings"),
    ...overrides,
  };
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("App", () => {
  it("renders buttons that came from the provider", async () => {
    render(<App dependencies={makeDeps()} />);
    expect(await screen.findByRole("button", { name: "Hello" })).toBeInTheDocument();
  });

  it("dispatches a log action when a button is clicked", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    render(<App dependencies={makeDeps()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Hello" }));
    expect(log).toHaveBeenCalledWith("hello!");
    log.mockRestore();
  });

  it("navigates between pages with navigate actions", async () => {
    render(<App dependencies={makeDeps()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByRole("button", { name: "Only Here" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("button", { name: "Hello" })).toBeInTheDocument();
  });

  it("shows the empty state for a provider with no pages", async () => {
    const deps = makeDeps({ provider: { getPages: async () => [] } });
    render(<App dependencies={deps} />);
    expect(await screen.findByText(/no deck pages/i)).toBeInTheDocument();
  });

  it("survives invalid persisted settings", async () => {
    window.localStorage.setItem("duck.settings", '{"columns":"broken"}');
    const deps = makeDeps({
      settingsStorage: new LocalStorageSettingsStorage("duck.settings"),
    });
    render(<App dependencies={deps} />);
    expect(await screen.findByRole("button", { name: "Hello" })).toBeInTheDocument();
  });

  it("opens the settings panel via a custom action button", async () => {
    const withSettingsButton: DeckButtonProvider = {
      getPages: async () => [
        {
          id: "main",
          name: "Main",
          buttons: [
            {
              id: "settings",
              title: "Settings",
              action: { type: "custom", actionId: "open-settings" },
            },
          ],
        },
      ],
    };
    render(<App dependencies={makeDeps({ provider: withSettingsButton })} />);
    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(
      await screen.findByRole("dialog", { name: "Deck settings" }),
    ).toBeInTheDocument();
  });

  it("reports a failed dispatch for a navigate action with an unknown page id", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = makeDeps();
    render(<App dependencies={deps} />);
    await screen.findByRole("button", { name: "Hello" });
    const result = await deps.dispatcher.dispatch({
      type: "navigate",
      pageId: "missing",
    });
    expect(result.status).toBe("failed");
    error.mockRestore();
  });

  it("reports a failed dispatch for an unrecognized custom action", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = makeDeps();
    render(<App dependencies={deps} />);
    await screen.findByRole("button", { name: "Hello" });
    const result = await deps.dispatcher.dispatch({
      type: "custom",
      actionId: "does-not-exist",
    });
    expect(result.status).toBe("failed");
    error.mockRestore();
  });

  it("persists settings changes", async () => {
    const storage = new LocalStorageSettingsStorage("duck.settings");
    render(<App dependencies={makeDeps({ settingsStorage: storage })} />);
    await screen.findByRole("button", { name: "Hello" });
    await userEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const columns = await screen.findByLabelText("Columns");
    await userEvent.clear(columns);
    await userEvent.type(columns, "4");
    await waitFor(async () =>
      expect(((await storage.load()) as { columns: number }).columns).toBe(4),
    );
  });
});
