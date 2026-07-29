# Duck

Duck is a generic, Stream Deck-inspired desktop control surface for macOS, built with
Tauri 2 + React + TypeScript. It renders a compact, floating, frameless window of
square buttons that can log messages, navigate between pages, or trigger custom
actions. Buttons come either from a built-in mock demo deck or from
[external sources](#external-sources) — directories of JSON files mapped onto
buttons by a hand-edited config file. Duck itself stays tool-agnostic: nothing in
the code knows about any particular producer of those files (see
[Provider abstraction](#provider-abstraction) below).

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

  sources/           External sources (frontend half)
    ExternalSourceProvider.ts   DeckButtonProvider serving configured sources
    activateSourceButton.ts     Forwards source button presses to Rust

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

Providers are wired into the app in exactly one place — the composition root:

```ts
// src/app/providers.ts
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
```

`ExternalSourceProvider` serves pages from configured
[external sources](#external-sources) and delegates to the wrapped
`MockDeckButtonProvider` (the demo deck) whenever no sources are configured or the
app runs outside Tauri. Swapping in any other data source means implementing
`DeckButtonProvider` and changing that one line. No UI component needs to change,
because none of them import a concrete provider — they only see `DeckPage[]` and
`DeckButton` values passed down as props.

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
and `custom` (recognizes `open-settings` and `source:activate` — see
[External sources](#external-sources)). A `navigate` to an unknown
page id, or a `custom` action with an unrecognized `actionId`, resolves to `"failed"`
(logged, never thrown past `dispatch()`) rather than silently reporting `"handled"`.
Unknown action _types_, or a button with no `action` at all, resolve to `"ignored"`.

`navigate` accepts three reserved page ids handled specially, in addition to real
page ids: `next`, `previous`, `home`.

## External sources

Duck can render buttons from directories of JSON files maintained by any external
tool, mapped through a hand-edited config file — Duck itself stays generic; all
knowledge of the producing tool lives in the config. Create
`~/Library/Application Support/com.hokita.duck/sources.json`:

```json
{
  "sources": [
    {
      "name": "Claude Code",
      "type": "json-directory",
      "path": "~/.local/state/claude-monitor/sessions",
      "button": {
        "title": "{tmux_session}",
        "subtitle": "{message}",
        "status": {
          "field": "status",
          "map": {
            "working": "working",
            "completed": "done",
            "input_required": "warning",
            "permission_required": "warning",
            "error": "error",
            "idle": "idle"
          }
        },
        "action": ["$HOME/bin/claude-monitor-open", "{tmux_session}", "{tmux_pane}"]
      }
    }
  ]
}
```

This example (the setup this feature was built for) turns per-session status files
written by Claude Code hooks into one button per active session: the button shows
the tmux session name and last activity, its status LED tracks the session state,
and pressing it focuses that tmux session in the terminal. Any tool that can drop
JSON files in a directory gets the same treatment — no Duck changes needed.

Semantics:

- Each source becomes one deck page; each `*.json` file in `path` becomes one
  button, sorted by filename. Malformed files are skipped, not fatal.
- `{field}` placeholders in `title`/`subtitle`/`icon`/`action` substitute the
  file's top-level values — strings as-is, numbers/booleans stringified,
  missing/non-scalar fields as the empty string.
- `icon` also accepts a `data:image/...;base64,...` URI, rendered as an image
  instead of a text glyph — e.g. to show a tool's logo instead of an emoji:
  `"icon": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..."`.
- `status.field` names a file field whose value is looked up in `status.map`; the
  result must be a valid button status (`idle`, `active`, `working`, `done`,
  `warning`, `error`), otherwise the button simply has no status LED.
- `action` is an argv array template. On press, the file is re-read and each
  element substituted; the command is spawned directly — never through a shell.
- `~` and `$VAR` expand **only in config values** (`path`, action elements),
  never in values substituted from watched files.
- Missing or empty `sources.json` → the built-in mock demo deck. A config that
  fails to parse logs an error (and the demo deck stays).

Security: the WebView never supplies paths or commands. It calls two fixed-purpose
Rust commands — `list_source_pages` (reads config, scans directories, returns
mapped pages) and `activate_source_button` (re-resolves the pressed button's file
from disk and spawns the configured argv). File values land as single argv
elements, so a hostile status file can't inject shell syntax or environment
expansions.

Limitations:

- Changes are picked up by polling (~1.5 s), not file watching.
- No staleness handling: a file left behind by a crashed producer keeps its
  button until the file is deleted.

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
- The toolbar header is the only drag region, so the window can be repositioned
  without swallowing clicks on grid buttons. It's implemented manually
  (`DeckToolbar`'s `onDragStart` → `startWindowDrag` in `src/shared/tauri.ts`),
  tracking mouse deltas and repositioning the window via `setPosition`, rather
  than the usual `data-tauri-drag-region` attribute. That attribute calls
  Tauri's built-in `start_dragging` command, backed by macOS's
  `performWindowDragWithEvent:` — which only works when invoked synchronously
  from a live mouseDown, and is a silent no-op when called asynchronously
  through the WKWebView bridge the way Tauri's own drag-region script calls it,
  so the window never actually moved.
- Capabilities are scoped to exactly what's used: `core:default`,
  `core:window:allow-set-always-on-top` (for the always-on-top setting),
  `core:window:allow-close` (for the toolbar's close button), and
  `core:window:allow-set-position` (for the manual drag implementation above).
  Notably, no `store:*` permission is granted — settings persistence
  goes through the fixed-path `load_settings`/`save_settings` commands instead (see
  [Persistence](#persistence)), so the WebView has no way to read or write an
  arbitrary file via the store plugin. External sources follow the same pattern
  (see [External sources](#external-sources)): fixed-purpose commands that
  resolve all paths and argv on the Rust side. No filesystem, shell, or network
  permissions are requested.
- A restrictive CSP is set in `tauri.conf.json` (`default-src 'self'`, no remote
  script/style origins).

## Known limitations

- Edit-mode changes (title/subtitle/status/disabled/position) are session-only —
  they're held in React state and never written back to the provider. "Restore mock
  configuration" simply reloads the provider's original data.
- No drag-and-drop reordering; edit mode uses directional move buttons instead.
- External sources poll rather than watch the filesystem, and have no staleness
  handling (see [External sources](#external-sources)).
