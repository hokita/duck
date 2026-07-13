# Duck

Duck is a generic, Stream Deck-inspired desktop control surface for macOS, built with
Tauri 2 + React + TypeScript. It renders a compact, floating, frameless window of
square buttons that can log messages, navigate between pages, or trigger custom
actions — driven entirely by mock data in this version. No Claude Code integration,
no Elgato branding or assets: it's a blank slate meant to be pointed at a real button
source later (see [Provider abstraction](#provider-abstraction) below).

_(screenshot placeholder)_

## Install

- Node.js (for `npm`)
- Rust toolchain ≥ 1.77, via [rustup](https://rustup.rs)

```bash
npm install
```

## Develop

```bash
npm run tauri dev   # full desktop app with hot reload
npm run dev          # frontend only, in a regular browser tab
```

Other scripts:

```bash
npm test             # run the test suite once
npm run test:watch   # run tests in watch mode
npm run lint         # eslint
npm run format       # prettier --write
npm run format:check # prettier --check
npm run typecheck    # tsc --noEmit
```

## Build

```bash
npm run tauri build
```

Produces `src-tauri/target/release/bundle/macos/Duck Deck.app`.

## Architecture

Four layers, kept strictly separate so any one of them can be replaced without
touching the others:

```
src/
  app/               Composition root — wires everything together
    providers.ts       createAppDependencies(): builds the provider, dispatcher,
                        and settings storage used by the app
    App.tsx             Top-level component: navigation, edit mode, settings

  deck/              Deck UI + button data contracts
    models/            DeckButton, DeckPage, DeckSettings (+ parsing/limits)
    providers/          DeckButtonProvider interface, MockDeckButtonProvider
    actions/            DeckButtonAction union, DeckActionDispatcher
    state/              usePageNavigation, useDeckPages (data-loading hooks)
    components/         Deck, DeckGrid, DeckButtonView, DeckToolbar

  editor/            Edit mode
    editOperations.ts   Pure functions: updateButton, moveButton
    components/         EditorPanel

  settings/          Settings persistence + UI
    storage/            SettingsStorage interface, localStorage/Tauri-store impls
    useDeckSettings.ts  Hook: load/save/validate settings
    components/         SettingsPanel

  shared/            Cross-cutting Tauri helpers (isTauri, window controls)
  styles/            Global stylesheet (grid, button states, panels)
```

- **Desktop shell** — the Tauri window config (`src-tauri/`) and `src/shared/tauri.ts`.
- **Deck UI** — `src/deck/components` and `src/styles`, which only ever render
  `DeckButton`/`DeckPage` data; they know nothing about where that data comes from.
- **Button data** — `src/deck/providers`, behind the `DeckButtonProvider` interface.
- **Actions** — `src/deck/actions`, a generic dispatcher keyed by action `type`.

## Provider abstraction

All button content flows through one interface:

```ts
// src/deck/providers/DeckButtonProvider.ts
export interface DeckButtonProvider {
  getPages(): Promise<DeckPage[]>;
  subscribe?(listener: (pages: DeckPage[]) => void): () => void;
}
```

It returns _pages_ (not a flat button list) because paging is a first-class concept
here — `navigate` actions jump between them, and `usePageNavigation` clamps/derives
the current page from whatever the provider returns.

The mock implementation, `MockDeckButtonProvider`, is wired into the app in exactly
one place — the composition root:

```ts
// src/app/providers.ts
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
```

Adding a future `ClaudeCodeButtonProvider` (or any other real data source) means
implementing `DeckButtonProvider` and swapping the one line above:

```ts
// src/app/providers.ts
export function createAppDependencies(): AppDependencies {
  ...
  return {
    provider: new ClaudeCodeButtonProvider(), // ← only change needed
    ...
  };
}
```

No UI component needs to change, because none of them import a concrete provider —
they only see `DeckPage[]` and `DeckButton` values passed down as props.

## Actions

Buttons carry an optional `action`, one of:

```ts
type DeckButtonAction =
  | { type: "log"; message: string }
  | { type: "navigate"; pageId: string }
  | { type: "custom"; actionId: string; payload?: Record<string, unknown> };
```

`DeckActionDispatcher` maps an action's `type` to a registered handler:

```ts
dispatcher.register("log", (action) => console.log(action.message));
const result = await dispatcher.dispatch(button.action);
// result.status: "handled" | "ignored" | "failed" — dispatch never throws
```

`App.tsx` registers handlers for `navigate` (calls `usePageNavigation`'s `goToPage`)
and `custom` (currently only recognizes `open-settings`). A `navigate` to an unknown
page id, or a `custom` action with an unrecognized `actionId`, resolves to `"failed"`
(logged, never thrown past `dispatch()`) rather than silently reporting `"handled"`.
Unknown action _types_, or a button with no `action` at all, resolve to `"ignored"`.

`navigate` accepts three reserved page ids handled specially, in addition to real
page ids: `next`, `previous`, `home`.

## Persistence

- **Deck settings** (columns/rows/button size/gap/compact/always-on-top) persist via
  two fixed-path Rust commands, `load_settings`/`save_settings`
  (`src-tauri/src/lib.rs`), backed by `tauri-plugin-store`'s Rust API writing a
  `settings.json` file in the app's data directory. The store's file path and key
  are hardcoded in Rust rather than passed from the frontend — the WebView is
  granted no `store:*` permission at all, only these two commands, so a compromised
  or malicious script in the WebView can't point the store at an arbitrary path.
  Outside of Tauri (e.g. `npm run dev` in a browser, or tests), the same
  `SettingsStorage` interface falls back to `localStorage` — selected automatically
  by `createSettingsStorage()` based on an `isTauri()` runtime check. Persisted
  values are re-validated and clamped on load (`parseDeckSettings`), so a corrupted
  or hand-edited settings file can't crash the app. Saves are serialized (queued
  one after another) so an older write can't finish after a newer one and leave
  stale data on disk.
- **Window geometry** (position/size) persists via `tauri-plugin-window-state`.

## macOS / Tauri notes

- The window is frameless (`decorations: false`) and transparent
  (`transparent: true`); the shell's border/shadow/radius are drawn in CSS instead
  of by the OS (`shadow: false`).
- `macOSPrivateApi: true` is required for window transparency to render correctly
  on macOS.
- The toolbar header is the only drag region (`data-tauri-drag-region`), so the
  window can be repositioned without swallowing clicks on grid buttons.
- Capabilities are scoped to exactly what's used: `core:default`,
  `core:window:allow-set-always-on-top` (for the always-on-top setting), and
  `core:window:allow-close` (for the toolbar's close button). Notably, no
  `store:*` permission is granted — settings persistence goes through the
  fixed-path `load_settings`/`save_settings` commands instead (see
  [Persistence](#persistence)), so the WebView has no way to read or write an
  arbitrary file via the store plugin. No filesystem, shell, or network
  permissions are requested.
- A restrictive CSP is set in `tauri.conf.json` (`default-src 'self'`, no remote
  script/style origins).

## Known limitations

- Edit-mode changes (title/subtitle/status/disabled/position) are session-only —
  they're held in React state and never written back to the provider. "Restore mock
  configuration" simply reloads the provider's original data.
- No drag-and-drop reordering; edit mode uses directional move buttons instead.
- `DeckButtonProvider.subscribe` is optional and currently unused by
  `MockDeckButtonProvider` — it exists so a future push-based provider (e.g. one
  reflecting live external state) doesn't require an interface change.
