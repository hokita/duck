# Duck Deck — Stream Deck-Style macOS Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A compact, floating, Stream Deck-style macOS desktop app that renders a grid of interactive buttons fed by a swappable provider abstraction, with pages, edit mode, and persisted settings.

**Architecture:** Tauri 2 native shell (frameless transparent window, window-state + store plugins) hosting a React/TypeScript deck UI. The UI depends only on a `DeckButtonProvider` interface (mock implementation for now) and a generic `DeckActionDispatcher`; a future `ClaudeCodeButtonProvider` plugs in at the composition root (`app/providers.ts`) without UI changes.

**Tech Stack:** Tauri 2, React 19, TypeScript (strict), Vite 7, Vitest + Testing Library, plain CSS. Rust only for the native shell.

## Global Constraints

- Tauri 2 / React / TypeScript / Vite. No Next.js. No large UI frameworks. No Redux.
- No Claude Code integration and no `ClaudeCodeButtonProvider` in this version.
- No Elgato branding, logos, or copyrighted icons (emoji + text only).
- Deck UI components must not import `MockDeckButtonProvider` directly — only the `DeckButtonProvider` interface. Wiring happens in `src/app/providers.ts`.
- Defaults: columns 5, rows 3, button size 88px, gap 12px.
- Settings persist across restarts (Tauri store plugin file; localStorage fallback outside Tauri).
- Strict TS, small components, TDD (red/green) for every logic module and component behavior.
- All mock actions are inert: `log` writes to console, `navigate` switches deck pages, unknown actions fail safely.

## Already Completed (uncommitted in working tree)

- `create-tauri-app` scaffold (react-ts template) merged into repo root.
- npm deps installed: vitest, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom, eslint (flat config), typescript-eslint, eslint-plugin-react-hooks, prettier, @tauri-apps/plugin-store, @tauri-apps/plugin-window-state. Removed @tauri-apps/plugin-opener from package.json (Rust side still pending, Task 18).
- `vite.config.ts` vitest section, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `src/test/setup.ts`.
- Rust toolchain updated to 1.97.

## Final File Structure

```text
src/
├── main.tsx                       — entry; imports global.css
├── app/
│   ├── App.tsx                    — composition: hooks + panels + shell layout
│   └── providers.ts               — createAppDependencies(): provider, dispatcher, storage
├── deck/
│   ├── components/
│   │   ├── Deck.tsx               — loading / error / empty / grid switcher
│   │   ├── DeckGrid.tsx           — CSS grid, pads empty slots, overflow note
│   │   ├── DeckButtonView.tsx     — one button; press/disabled/status/badge/a11y
│   │   └── DeckToolbar.tsx        — drag region, page dots, edit/settings/close
│   ├── models/
│   │   ├── DeckButton.ts          — DeckButton, DeckButtonStatus
│   │   ├── DeckPage.ts            — DeckPage
│   │   └── DeckSettings.ts        — DeckSettings, defaults, parseDeckSettings
│   ├── providers/
│   │   ├── DeckButtonProvider.ts  — provider interface
│   │   └── MockDeckButtonProvider.ts
│   ├── actions/
│   │   ├── DeckAction.ts          — DeckButtonAction union
│   │   └── DeckActionDispatcher.ts
│   └── state/
│       ├── useDeckPages.ts        — load pages from provider (+subscribe, reload)
│       └── usePageNavigation.ts   — index, next/previous/home/goToPage
├── editor/
│   ├── editOperations.ts          — pure updateButton / moveButton
│   └── components/
│       └── EditorPanel.tsx
├── settings/
│   ├── storage/
│   │   ├── SettingsStorage.ts     — interface + createSettingsStorage()
│   │   ├── LocalStorageSettingsStorage.ts
│   │   └── TauriStoreSettingsStorage.ts
│   ├── useDeckSettings.ts
│   └── components/
│       └── SettingsPanel.tsx
├── shared/
│   └── tauri.ts                   — isTauri, setWindowAlwaysOnTop, closeAppWindow
├── styles/
│   └── global.css                 — tokens + all component styles
└── test/
    └── setup.ts
src-tauri/
├── tauri.conf.json                — frameless transparent window, macOSPrivateApi
├── Cargo.toml                     — store + window-state plugins, macos-private-api
├── capabilities/default.json
└── src/lib.rs                     — plugin registration only
```

Key interface decision (improvement over the spec sketch, allowed by spec): the provider returns **pages**, not a flat button list, because pages are a first-class feature. `DeckButtonProvider.getPages(): Promise<DeckPage[]>` + optional `subscribe`. Navigation actions use `{ type: "navigate"; pageId: string }` where `pageId` is a page id or one of the reserved words `next` / `previous` / `home`.

---

### Task 0: Commit the scaffold

**Files:** everything currently uncommitted (scaffold + tooling configs + this plan).

- [ ] **Step 1: Commit**

```bash
git add -A
git commit -m "chore: scaffold tauri react-ts app with test and lint tooling"
```

---

### Task 1: Deck models and action types

Types only — no test cycle (verified by `tsc` and consumed by every later task).

**Files:**
- Create: `src/deck/models/DeckButton.ts`
- Create: `src/deck/models/DeckPage.ts`
- Create: `src/deck/actions/DeckAction.ts`

**Interfaces:**
- Produces: `DeckButton`, `DeckButtonStatus`, `DeckPage`, `DeckButtonAction` — exact shapes below; every later task imports these.

- [ ] **Step 1: Write the types**

`src/deck/actions/DeckAction.ts`:

```ts
export type DeckButtonAction =
  | { type: "log"; message: string }
  | { type: "navigate"; pageId: string }
  | { type: "custom"; actionId: string; payload?: Record<string, unknown> };

/** Reserved pageId values understood by the navigate handler. */
export const RESERVED_PAGE_IDS = ["next", "previous", "home"] as const;
```

`src/deck/models/DeckButton.ts`:

```ts
import type { DeckButtonAction } from "../actions/DeckAction";

export type DeckButtonStatus =
  | "idle"
  | "active"
  | "working"
  | "done"
  | "warning"
  | "error";

export interface DeckButton {
  id: string;
  title?: string;
  subtitle?: string;
  /** Emoji or short glyph rendered in the icon area. */
  icon?: string;
  status?: DeckButtonStatus;
  badge?: string;
  disabled?: boolean;
  action?: DeckButtonAction;
}
```

`src/deck/models/DeckPage.ts`:

```ts
import type { DeckButton } from "./DeckButton";

export interface DeckPage {
  id: string;
  name: string;
  buttons: DeckButton[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/deck
git commit -m "feat: add deck button, page, and action models"
```

---

### Task 2: DeckActionDispatcher

**Files:**
- Create: `src/deck/actions/DeckActionDispatcher.ts`
- Test: `src/deck/actions/DeckActionDispatcher.test.ts`

**Interfaces:**
- Consumes: `DeckButtonAction` (Task 1).
- Produces: `class DeckActionDispatcher` with `register<T extends DeckButtonAction["type"]>(type: T, handler: (action: Extract<DeckButtonAction, { type: T }>) => void | Promise<void>): () => void` and `dispatch(action: DeckButtonAction | undefined): Promise<DispatchResult>`; `DispatchResult = { status: "handled" | "ignored" | "failed"; error?: unknown }`.

- [ ] **Step 1: Write the failing tests**

`src/deck/actions/DeckActionDispatcher.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { DeckActionDispatcher } from "./DeckActionDispatcher";

describe("DeckActionDispatcher", () => {
  it("dispatches an action to its registered handler", async () => {
    const dispatcher = new DeckActionDispatcher();
    const handler = vi.fn();
    dispatcher.register("log", handler);

    const result = await dispatcher.dispatch({ type: "log", message: "hello" });

    expect(handler).toHaveBeenCalledWith({ type: "log", message: "hello" });
    expect(result.status).toBe("handled");
  });

  it("ignores undefined actions", async () => {
    const dispatcher = new DeckActionDispatcher();
    expect((await dispatcher.dispatch(undefined)).status).toBe("ignored");
  });

  it("ignores actions without a registered handler instead of throwing", async () => {
    const dispatcher = new DeckActionDispatcher();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await dispatcher.dispatch({ type: "log", message: "x" });
    expect(result.status).toBe("ignored");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reports failure without throwing when a handler throws", async () => {
    const dispatcher = new DeckActionDispatcher();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    dispatcher.register("log", () => {
      throw new Error("boom");
    });
    const result = await dispatcher.dispatch({ type: "log", message: "x" });
    expect(result.status).toBe("failed");
    expect(result.error).toBeInstanceOf(Error);
    error.mockRestore();
  });

  it("register returns an unsubscribe function", async () => {
    const dispatcher = new DeckActionDispatcher();
    const handler = vi.fn();
    const unregister = dispatcher.register("log", handler);
    unregister();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await dispatcher.dispatch({ type: "log", message: "x" });
    expect(handler).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/deck/actions/DeckActionDispatcher.test.ts`
Expected: FAIL — module `./DeckActionDispatcher` not found.

- [ ] **Step 3: Write minimal implementation**

`src/deck/actions/DeckActionDispatcher.ts`:

```ts
import type { DeckButtonAction } from "./DeckAction";

export interface DispatchResult {
  status: "handled" | "ignored" | "failed";
  error?: unknown;
}

type AnyHandler = (action: DeckButtonAction) => void | Promise<void>;

export class DeckActionDispatcher {
  private readonly handlers = new Map<DeckButtonAction["type"], AnyHandler>();

  register<T extends DeckButtonAction["type"]>(
    type: T,
    handler: (action: Extract<DeckButtonAction, { type: T }>) => void | Promise<void>,
  ): () => void {
    const anyHandler = handler as AnyHandler;
    this.handlers.set(type, anyHandler);
    return () => {
      if (this.handlers.get(type) === anyHandler) {
        this.handlers.delete(type);
      }
    };
  }

  async dispatch(action: DeckButtonAction | undefined): Promise<DispatchResult> {
    if (!action) {
      return { status: "ignored" };
    }
    const handler = this.handlers.get(action.type);
    if (!handler) {
      console.warn(`[deck] no handler registered for action type "${action.type}"`);
      return { status: "ignored" };
    }
    try {
      await handler(action);
      return { status: "handled" };
    } catch (error) {
      console.error(`[deck] action "${action.type}" failed`, error);
      return { status: "failed", error };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/deck/actions/DeckActionDispatcher.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/deck/actions
git commit -m "feat: add generic deck action dispatcher"
```

---

### Task 3: Provider interface and MockDeckButtonProvider

**Files:**
- Create: `src/deck/providers/DeckButtonProvider.ts`
- Create: `src/deck/providers/MockDeckButtonProvider.ts`
- Test: `src/deck/providers/MockDeckButtonProvider.test.ts`

**Interfaces:**
- Consumes: `DeckPage`, `DeckButton` (Task 1).
- Produces: `interface DeckButtonProvider { getPages(): Promise<DeckPage[]>; subscribe?(listener: (pages: DeckPage[]) => void): () => void }`; `class MockDeckButtonProvider implements DeckButtonProvider`.

- [ ] **Step 1: Write the failing tests**

`src/deck/providers/MockDeckButtonProvider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MockDeckButtonProvider } from "./MockDeckButtonProvider";

describe("MockDeckButtonProvider", () => {
  it("returns at least two pages with buttons", async () => {
    const pages = await new MockDeckButtonProvider().getPages();
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].buttons.length).toBeGreaterThan(0);
  });

  it("uses globally unique button ids", async () => {
    const pages = await new MockDeckButtonProvider().getPages();
    const ids = pages.flatMap((page) => page.buttons.map((button) => button.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("demonstrates every visual status plus disabled and empty buttons", async () => {
    const pages = await new MockDeckButtonProvider().getPages();
    const buttons = pages.flatMap((page) => page.buttons);
    const statuses = new Set(buttons.map((button) => button.status));
    for (const status of ["active", "working", "done", "warning", "error"]) {
      expect(statuses).toContain(status);
    }
    expect(buttons.some((button) => button.disabled)).toBe(true);
    expect(
      buttons.some((button) => !button.title && !button.icon && !button.action),
    ).toBe(true);
  });

  it("returns fresh copies so callers cannot mutate the source data", async () => {
    const provider = new MockDeckButtonProvider();
    const first = await provider.getPages();
    first[0].buttons[0].title = "MUTATED";
    const second = await provider.getPages();
    expect(second[0].buttons[0].title).not.toBe("MUTATED");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/deck/providers/MockDeckButtonProvider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/deck/providers/DeckButtonProvider.ts`:

```ts
import type { DeckPage } from "../models/DeckPage";

/**
 * Source of deck content. The UI depends only on this interface;
 * swapping in e.g. a ClaudeCodeButtonProvider requires no UI changes.
 */
export interface DeckButtonProvider {
  getPages(): Promise<DeckPage[]>;
  /** Optional push updates. Returns an unsubscribe function. */
  subscribe?(listener: (pages: DeckPage[]) => void): () => void;
}
```

`src/deck/providers/MockDeckButtonProvider.ts` (data below is the exact mock deck; page 1 fills a 5×3 grid, page 2 is sparse, page 3 overflows on purpose):

```ts
import type { DeckPage } from "../models/DeckPage";
import type { DeckButtonProvider } from "./DeckButtonProvider";

const MOCK_PAGES: DeckPage[] = [
  {
    id: "main",
    name: "Main",
    buttons: [
      { id: "backend", title: "Backend", subtitle: "Running", icon: "🖥️", status: "active", action: { type: "log", message: "Backend clicked" } },
      { id: "frontend", title: "Frontend", subtitle: "Running", icon: "🎨", status: "active", action: { type: "log", message: "Frontend clicked" } },
      { id: "batch", title: "Batch", subtitle: "3 jobs", icon: "📦", status: "working", badge: "3", action: { type: "log", message: "Batch clicked" } },
      { id: "working", title: "Working", subtitle: "Building…", icon: "🔄", status: "working", action: { type: "log", message: "Working clicked" } },
      { id: "next", title: "Next", icon: "➡️", action: { type: "navigate", pageId: "next" } },
      { id: "done", title: "Done", subtitle: "Completed", icon: "✅", status: "done", action: { type: "log", message: "Done clicked" } },
      { id: "warning", title: "Warning", subtitle: "Check logs", icon: "⚠️", status: "warning", badge: "!", action: { type: "log", message: "Warning clicked" } },
      { id: "error", title: "Error", subtitle: "Failed", icon: "⛔", status: "error", action: { type: "log", message: "Error clicked" } },
      { id: "mystery", title: "Mystery", subtitle: "Unknown action", icon: "🧪", action: { type: "custom", actionId: "does-not-exist" } },
      { id: "offline", title: "Offline", subtitle: "Disabled", icon: "🚫", disabled: true, action: { type: "log", message: "unreachable" } },
      { id: "tools-folder", title: "Tools", subtitle: "Folder", icon: "📁", action: { type: "navigate", pageId: "tools" } },
      { id: "open-app", title: "Open App", icon: "🚀", action: { type: "log", message: "Open App clicked" } },
      { id: "empty-1" },
      { id: "empty-2" },
      { id: "settings", title: "Settings", icon: "⚙️", action: { type: "custom", actionId: "open-settings" } },
    ],
  },
  {
    id: "tools",
    name: "Tools",
    buttons: [
      { id: "back", title: "Back", icon: "⬅️", action: { type: "navigate", pageId: "previous" } },
      { id: "home", title: "Home", icon: "🏠", action: { type: "navigate", pageId: "home" } },
      { id: "terminal", title: "Terminal", icon: "💻", action: { type: "log", message: "Terminal clicked" } },
      { id: "logs", title: "Logs", icon: "📜", action: { type: "log", message: "Logs clicked" } },
      { id: "deploy", title: "Deploy", subtitle: "In progress", icon: "🛳️", status: "working", action: { type: "log", message: "Deploy clicked" } },
      { id: "wall-folder", title: "Wall", subtitle: "Overflow demo", icon: "🧱", action: { type: "navigate", pageId: "wall" } },
    ],
  },
  {
    id: "wall",
    name: "Wall",
    buttons: [
      { id: "wall-back", title: "Back", icon: "⬅️", action: { type: "navigate", pageId: "previous" } },
      { id: "wall-home", title: "Home", icon: "🏠", action: { type: "navigate", pageId: "home" } },
      ...Array.from({ length: 18 }, (_, i) => ({
        id: `wall-${i + 1}`,
        title: `Tile ${i + 1}`,
        icon: "🔹",
        action: { type: "log" as const, message: `Tile ${i + 1} clicked` },
      })),
    ],
  },
];

export class MockDeckButtonProvider implements DeckButtonProvider {
  async getPages(): Promise<DeckPage[]> {
    return structuredClone(MOCK_PAGES);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/deck/providers/MockDeckButtonProvider.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/deck/providers
git commit -m "feat: add provider interface and mock deck data"
```

---

### Task 4: DeckSettings model with safe parsing

**Files:**
- Create: `src/deck/models/DeckSettings.ts`
- Test: `src/deck/models/DeckSettings.test.ts`

**Interfaces:**
- Produces: `interface DeckSettings { columns: number; rows: number; buttonSize: number; gap: number; compact: boolean; alwaysOnTop: boolean }`, `DEFAULT_DECK_SETTINGS: DeckSettings`, `parseDeckSettings(value: unknown): DeckSettings`.

- [ ] **Step 1: Write the failing tests**

`src/deck/models/DeckSettings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_DECK_SETTINGS, parseDeckSettings } from "./DeckSettings";

describe("parseDeckSettings", () => {
  it("returns defaults for non-object input", () => {
    expect(parseDeckSettings(null)).toEqual(DEFAULT_DECK_SETTINGS);
    expect(parseDeckSettings("garbage")).toEqual(DEFAULT_DECK_SETTINGS);
    expect(parseDeckSettings(42)).toEqual(DEFAULT_DECK_SETTINGS);
  });

  it("keeps valid fields and fills missing ones with defaults", () => {
    const parsed = parseDeckSettings({ columns: 4, compact: true });
    expect(parsed.columns).toBe(4);
    expect(parsed.compact).toBe(true);
    expect(parsed.rows).toBe(DEFAULT_DECK_SETTINGS.rows);
    expect(parsed.buttonSize).toBe(DEFAULT_DECK_SETTINGS.buttonSize);
  });

  it("replaces wrongly typed fields with defaults", () => {
    const parsed = parseDeckSettings({ columns: "five", alwaysOnTop: "yes" });
    expect(parsed.columns).toBe(DEFAULT_DECK_SETTINGS.columns);
    expect(parsed.alwaysOnTop).toBe(DEFAULT_DECK_SETTINGS.alwaysOnTop);
  });

  it("clamps out-of-range numbers", () => {
    const parsed = parseDeckSettings({ columns: 99, rows: 0, buttonSize: 10, gap: 500 });
    expect(parsed.columns).toBe(12);
    expect(parsed.rows).toBe(1);
    expect(parsed.buttonSize).toBe(48);
    expect(parsed.gap).toBe(32);
  });

  it("has the spec defaults", () => {
    expect(DEFAULT_DECK_SETTINGS).toEqual({
      columns: 5,
      rows: 3,
      buttonSize: 88,
      gap: 12,
      compact: false,
      alwaysOnTop: false,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/deck/models/DeckSettings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/deck/models/DeckSettings.ts`:

```ts
export interface DeckSettings {
  columns: number;
  rows: number;
  buttonSize: number;
  gap: number;
  compact: boolean;
  alwaysOnTop: boolean;
}

export const DECK_SETTINGS_LIMITS = {
  columns: { min: 1, max: 12 },
  rows: { min: 1, max: 8 },
  buttonSize: { min: 48, max: 160 },
  gap: { min: 0, max: 32 },
} as const;

export const DEFAULT_DECK_SETTINGS: DeckSettings = {
  columns: 5,
  rows: 3,
  buttonSize: 88,
  gap: 12,
  compact: false,
  alwaysOnTop: false,
};

function readNumber(
  source: Record<string, unknown>,
  key: keyof typeof DECK_SETTINGS_LIMITS,
): number {
  const value = source[key];
  const { min, max } = DECK_SETTINGS_LIMITS[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DECK_SETTINGS[key];
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readBoolean(
  source: Record<string, unknown>,
  key: "compact" | "alwaysOnTop",
): boolean {
  const value = source[key];
  return typeof value === "boolean" ? value : DEFAULT_DECK_SETTINGS[key];
}

/** Parses persisted settings of unknown shape, falling back per-field. */
export function parseDeckSettings(value: unknown): DeckSettings {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_DECK_SETTINGS };
  }
  const source = value as Record<string, unknown>;
  return {
    columns: readNumber(source, "columns"),
    rows: readNumber(source, "rows"),
    buttonSize: readNumber(source, "buttonSize"),
    gap: readNumber(source, "gap"),
    compact: readBoolean(source, "compact"),
    alwaysOnTop: readBoolean(source, "alwaysOnTop"),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/deck/models/DeckSettings.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/deck/models
git commit -m "feat: add deck settings model with safe parsing"
```

---

### Task 5: Settings storage

**Files:**
- Create: `src/settings/storage/SettingsStorage.ts`
- Create: `src/settings/storage/LocalStorageSettingsStorage.ts`
- Create: `src/settings/storage/TauriStoreSettingsStorage.ts`
- Test: `src/settings/storage/LocalStorageSettingsStorage.test.ts`

**Interfaces:**
- Consumes: `isTauri()` (Task 6 — forward reference resolved by implementing `createSettingsStorage` here but importing from `../../shared/tauri`; Task 6 must land before this compiles — **order swap:** implement Task 6 first if running strictly sequentially; kept here for readability).
- Produces: `interface SettingsStorage { load(): Promise<unknown>; save(value: unknown): Promise<void> }`, `LocalStorageSettingsStorage(key)`, `TauriStoreSettingsStorage(key, file?)`, `createSettingsStorage(key): SettingsStorage`.

**NOTE:** To avoid the forward reference, Step 3 includes the tiny `src/shared/tauri.ts` `isTauri()` helper; Task 6 adds the window helpers to the same file.

- [ ] **Step 1: Write the failing tests**

`src/settings/storage/LocalStorageSettingsStorage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageSettingsStorage } from "./LocalStorageSettingsStorage";

describe("LocalStorageSettingsStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a value", async () => {
    const storage = new LocalStorageSettingsStorage("duck.test");
    await storage.save({ columns: 4 });
    expect(await storage.load()).toEqual({ columns: 4 });
  });

  it("returns null when nothing is stored", async () => {
    expect(await new LocalStorageSettingsStorage("duck.test").load()).toBeNull();
  });

  it("returns null for corrupted JSON instead of throwing", async () => {
    window.localStorage.setItem("duck.test", "{not json");
    expect(await new LocalStorageSettingsStorage("duck.test").load()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/settings/storage/LocalStorageSettingsStorage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/shared/tauri.ts` (first half; Task 6 extends it):

```ts
/** True when running inside a Tauri WebView (vs plain browser or jsdom). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
```

`src/settings/storage/SettingsStorage.ts`:

```ts
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
    ? new TauriStoreSettingsStorage(key)
    : new LocalStorageSettingsStorage(key);
}
```

`src/settings/storage/LocalStorageSettingsStorage.ts`:

```ts
import type { SettingsStorage } from "./SettingsStorage";

export class LocalStorageSettingsStorage implements SettingsStorage {
  constructor(private readonly key: string) {}

  async load(): Promise<unknown> {
    const raw = window.localStorage.getItem(this.key);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async save(value: unknown): Promise<void> {
    window.localStorage.setItem(this.key, JSON.stringify(value));
  }
}
```

`src/settings/storage/TauriStoreSettingsStorage.ts` (thin wrapper over the official store plugin; exercised manually in the packaged app, not unit-tested — jsdom cannot load the plugin):

```ts
import type { SettingsStorage } from "./SettingsStorage";

export class TauriStoreSettingsStorage implements SettingsStorage {
  constructor(
    private readonly key: string,
    private readonly file: string = "settings.json",
  ) {}

  async load(): Promise<unknown> {
    try {
      const store = await this.openStore();
      return (await store.get(this.key)) ?? null;
    } catch (error) {
      console.error("[deck] failed to load settings store", error);
      return null;
    }
  }

  async save(value: unknown): Promise<void> {
    const store = await this.openStore();
    await store.set(this.key, value);
    await store.save();
  }

  private async openStore() {
    const { load } = await import("@tauri-apps/plugin-store");
    return load(this.file, { autoSave: false });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/settings/storage/LocalStorageSettingsStorage.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/settings/storage src/shared/tauri.ts
git commit -m "feat: add settings storage with tauri store and localStorage backends"
```

---

### Task 6: Tauri window helpers

Thin wrappers over the Tauri window API (no unit tests — nothing meaningful to assert in jsdom; behavior verified manually in Task 18).

**Files:**
- Modify: `src/shared/tauri.ts`

**Interfaces:**
- Produces: `setWindowAlwaysOnTop(value: boolean): Promise<void>`, `closeAppWindow(): Promise<void>` — both no-ops outside Tauri.

- [ ] **Step 1: Extend `src/shared/tauri.ts`**

```ts
/** True when running inside a Tauri WebView (vs plain browser or jsdom). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function setWindowAlwaysOnTop(value: boolean): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setAlwaysOnTop(value);
}

export async function closeAppWindow(): Promise<void> {
  if (!isTauri()) {
    console.info("[deck] close requested outside Tauri; ignoring");
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

```bash
git add src/shared/tauri.ts
git commit -m "feat: add tauri window helpers"
```

---

### Task 7: Edit operations (pure functions)

**Files:**
- Create: `src/editor/editOperations.ts`
- Test: `src/editor/editOperations.test.ts`

**Interfaces:**
- Consumes: `DeckPage`, `DeckButton` (Task 1).
- Produces: `type MoveDirection = "left" | "right" | "up" | "down"`, `updateButton(pages: DeckPage[], pageId: string, buttonId: string, patch: Partial<Omit<DeckButton, "id">>): DeckPage[]`, `moveButton(pages: DeckPage[], pageId: string, fromIndex: number, direction: MoveDirection, columns: number): DeckPage[]`.

- [ ] **Step 1: Write the failing tests**

`src/editor/editOperations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { DeckPage } from "../deck/models/DeckPage";
import { moveButton, updateButton } from "./editOperations";

const page = (buttons: { id: string }[]): DeckPage => ({
  id: "p1",
  name: "Page 1",
  buttons,
});

describe("updateButton", () => {
  it("patches only the targeted button and returns new objects", () => {
    const pages = [page([{ id: "a" }, { id: "b" }])];
    const next = updateButton(pages, "p1", "a", { title: "Hello" });
    expect(next[0].buttons[0].title).toBe("Hello");
    expect(next[0].buttons[1].title).toBeUndefined();
    expect(pages[0].buttons[0].title).toBeUndefined();
  });
});

describe("moveButton", () => {
  // 3-column layout:  a b c
  //                    d e
  const pages = () => [page([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }])];

  it("swaps horizontally within a row", () => {
    const next = moveButton(pages(), "p1", 0, "right", 3);
    expect(next[0].buttons.map((b) => b.id)).toEqual(["b", "a", "c", "d", "e"]);
  });

  it("does not wrap across row edges", () => {
    const next = moveButton(pages(), "p1", 2, "right", 3);
    expect(next[0].buttons.map((b) => b.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("swaps vertically by one row", () => {
    const next = moveButton(pages(), "p1", 0, "down", 3);
    expect(next[0].buttons.map((b) => b.id)).toEqual(["d", "b", "c", "a", "e"]);
  });

  it("ignores moves that leave the button list", () => {
    const next = moveButton(pages(), "p1", 4, "down", 3);
    expect(next[0].buttons.map((b) => b.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/editor/editOperations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/editor/editOperations.ts`:

```ts
import type { DeckButton } from "../deck/models/DeckButton";
import type { DeckPage } from "../deck/models/DeckPage";

export type MoveDirection = "left" | "right" | "up" | "down";

export function updateButton(
  pages: DeckPage[],
  pageId: string,
  buttonId: string,
  patch: Partial<Omit<DeckButton, "id">>,
): DeckPage[] {
  return pages.map((page) =>
    page.id !== pageId
      ? page
      : {
          ...page,
          buttons: page.buttons.map((button) =>
            button.id === buttonId ? { ...button, ...patch } : button,
          ),
        },
  );
}

function targetIndex(index: number, direction: MoveDirection, columns: number): number {
  switch (direction) {
    case "left":
      return index % columns === 0 ? -1 : index - 1;
    case "right":
      return index % columns === columns - 1 ? -1 : index + 1;
    case "up":
      return index - columns;
    case "down":
      return index + columns;
  }
}

export function moveButton(
  pages: DeckPage[],
  pageId: string,
  fromIndex: number,
  direction: MoveDirection,
  columns: number,
): DeckPage[] {
  return pages.map((page) => {
    if (page.id !== pageId) {
      return page;
    }
    const to = targetIndex(fromIndex, direction, columns);
    const inRange = (i: number) => i >= 0 && i < page.buttons.length;
    if (!inRange(fromIndex) || !inRange(to)) {
      return page;
    }
    const buttons = [...page.buttons];
    [buttons[fromIndex], buttons[to]] = [buttons[to], buttons[fromIndex]];
    return { ...page, buttons };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/editor/editOperations.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/editor
git commit -m "feat: add pure edit operations for button update and move"
```

---

### Task 8: usePageNavigation hook

**Files:**
- Create: `src/deck/state/usePageNavigation.ts`
- Test: `src/deck/state/usePageNavigation.test.tsx`

**Interfaces:**
- Consumes: `DeckPage` (Task 1).
- Produces: `usePageNavigation(pages: DeckPage[]): PageNavigation` where `PageNavigation = { pageIndex: number; pageCount: number; currentPage: DeckPage | null; next(): void; previous(): void; home(): void; goToPage(pageId: string): boolean }`. `goToPage` resolves reserved ids `next`/`previous`/`home`, else matches page id; returns false for unknown ids.

- [ ] **Step 1: Write the failing tests**

`src/deck/state/usePageNavigation.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DeckPage } from "../models/DeckPage";
import { usePageNavigation } from "./usePageNavigation";

const pages: DeckPage[] = [
  { id: "main", name: "Main", buttons: [] },
  { id: "tools", name: "Tools", buttons: [] },
  { id: "wall", name: "Wall", buttons: [] },
];

describe("usePageNavigation", () => {
  it("starts at the first page", () => {
    const { result } = renderHook(() => usePageNavigation(pages));
    expect(result.current.pageIndex).toBe(0);
    expect(result.current.currentPage?.id).toBe("main");
  });

  it("moves next and previous within bounds", () => {
    const { result } = renderHook(() => usePageNavigation(pages));
    act(() => result.current.next());
    expect(result.current.pageIndex).toBe(1);
    act(() => result.current.previous());
    act(() => result.current.previous());
    expect(result.current.pageIndex).toBe(0);
  });

  it("stops at the last page instead of wrapping", () => {
    const { result } = renderHook(() => usePageNavigation(pages));
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.pageIndex).toBe(2);
  });

  it("goToPage resolves reserved ids, page ids, and rejects unknown ids", () => {
    const { result } = renderHook(() => usePageNavigation(pages));
    act(() => {
      expect(result.current.goToPage("tools")).toBe(true);
    });
    expect(result.current.pageIndex).toBe(1);
    act(() => {
      expect(result.current.goToPage("home")).toBe(true);
    });
    expect(result.current.pageIndex).toBe(0);
    act(() => {
      expect(result.current.goToPage("nope")).toBe(false);
    });
    expect(result.current.pageIndex).toBe(0);
  });

  it("clamps the index when pages shrink", () => {
    const { result, rerender } = renderHook(({ p }) => usePageNavigation(p), {
      initialProps: { p: pages },
    });
    act(() => result.current.goToPage("wall"));
    rerender({ p: pages.slice(0, 1) });
    expect(result.current.pageIndex).toBe(0);
    expect(result.current.currentPage?.id).toBe("main");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/deck/state/usePageNavigation.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/deck/state/usePageNavigation.ts`:

```ts
import { useCallback, useState } from "react";
import type { DeckPage } from "../models/DeckPage";

export interface PageNavigation {
  pageIndex: number;
  pageCount: number;
  currentPage: DeckPage | null;
  next(): void;
  previous(): void;
  home(): void;
  goToPage(pageId: string): boolean;
}

export function usePageNavigation(pages: DeckPage[]): PageNavigation {
  const [rawIndex, setRawIndex] = useState(0);
  const pageCount = pages.length;
  const pageIndex = pageCount === 0 ? 0 : Math.min(rawIndex, pageCount - 1);

  const next = useCallback(
    () => setRawIndex((index) => Math.min(index + 1, Math.max(pageCount - 1, 0))),
    [pageCount],
  );
  const previous = useCallback(
    () => setRawIndex((index) => Math.max(index - 1, 0)),
    [],
  );
  const home = useCallback(() => setRawIndex(0), []);

  const goToPage = useCallback(
    (pageId: string): boolean => {
      if (pageId === "next") {
        next();
        return true;
      }
      if (pageId === "previous") {
        previous();
        return true;
      }
      if (pageId === "home") {
        home();
        return true;
      }
      const index = pages.findIndex((page) => page.id === pageId);
      if (index === -1) {
        console.warn(`[deck] unknown page "${pageId}"`);
        return false;
      }
      setRawIndex(index);
      return true;
    },
    [pages, next, previous, home],
  );

  return {
    pageIndex,
    pageCount,
    currentPage: pages[pageIndex] ?? null,
    next,
    previous,
    home,
    goToPage,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/deck/state/usePageNavigation.test.tsx`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/deck/state
git commit -m "feat: add page navigation hook"
```

---

### Task 9: useDeckPages hook

**Files:**
- Create: `src/deck/state/useDeckPages.ts`
- Test: `src/deck/state/useDeckPages.test.tsx`

**Interfaces:**
- Consumes: `DeckButtonProvider` (Task 3).
- Produces: `useDeckPages(provider: DeckButtonProvider): DeckPagesState` where `DeckPagesState = { pages: DeckPage[]; loading: boolean; error: boolean; setPages: Dispatch<SetStateAction<DeckPage[]>>; reload(): void }`. `setPages` is exposed so edit mode can apply local edits; `reload` re-fetches from the provider (used by “Restore mock configuration” and the error retry).

- [ ] **Step 1: Write the failing tests**

`src/deck/state/useDeckPages.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DeckPage } from "../models/DeckPage";
import type { DeckButtonProvider } from "../providers/DeckButtonProvider";
import { useDeckPages } from "./useDeckPages";

const somePages: DeckPage[] = [{ id: "p1", name: "P1", buttons: [{ id: "a" }] }];

describe("useDeckPages", () => {
  it("loads pages from the provider", async () => {
    const provider: DeckButtonProvider = { getPages: async () => somePages };
    const { result } = renderHook(() => useDeckPages(provider));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pages).toEqual(somePages);
    expect(result.current.error).toBe(false);
  });

  it("flags an error when the provider rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider: DeckButtonProvider = {
      getPages: async () => {
        throw new Error("offline");
      },
    };
    const { result } = renderHook(() => useDeckPages(provider));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
    error.mockRestore();
  });

  it("reload re-fetches from the provider", async () => {
    const getPages = vi
      .fn<() => Promise<DeckPage[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(somePages);
    const { result } = renderHook(() => useDeckPages({ getPages }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pages).toEqual([]);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.pages).toEqual(somePages));
    expect(getPages).toHaveBeenCalledTimes(2);
  });

  it("applies pushed updates from subscribe", async () => {
    let push: ((pages: DeckPage[]) => void) | undefined;
    const provider: DeckButtonProvider = {
      getPages: async () => [],
      subscribe: (listener) => {
        push = listener;
        return () => {
          push = undefined;
        };
      },
    };
    const { result, unmount } = renderHook(() => useDeckPages(provider));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => push?.(somePages));
    expect(result.current.pages).toEqual(somePages);
    unmount();
    expect(push).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/deck/state/useDeckPages.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/deck/state/useDeckPages.ts`:

```ts
import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { DeckPage } from "../models/DeckPage";
import type { DeckButtonProvider } from "../providers/DeckButtonProvider";

export interface DeckPagesState {
  pages: DeckPage[];
  loading: boolean;
  error: boolean;
  /** Local edits (edit mode) — does not write back to the provider. */
  setPages: Dispatch<SetStateAction<DeckPage[]>>;
  reload(): void;
}

export function useDeckPages(provider: DeckButtonProvider): DeckPagesState {
  const [pages, setPages] = useState<DeckPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    provider
      .getPages()
      .then((loaded) => {
        if (!cancelled) {
          setPages(loaded);
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          console.error("[deck] button provider failed", cause);
          setError(true);
          setLoading(false);
        }
      });
    const unsubscribe = provider.subscribe?.((updated) => {
      if (!cancelled) {
        setPages(updated);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [provider, loadCount]);

  const reload = useCallback(() => setLoadCount((count) => count + 1), []);

  return { pages, loading, error, setPages, reload };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/deck/state/useDeckPages.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/deck/state
git commit -m "feat: add provider-backed deck pages hook"
```

---

### Task 10: useDeckSettings hook

**Files:**
- Create: `src/settings/useDeckSettings.ts`
- Test: `src/settings/useDeckSettings.test.tsx`

**Interfaces:**
- Consumes: `SettingsStorage` (Task 5), `parseDeckSettings`/`DEFAULT_DECK_SETTINGS` (Task 4).
- Produces: `useDeckSettings(storage: SettingsStorage): DeckSettingsState` where `DeckSettingsState = { settings: DeckSettings; ready: boolean; update(patch: Partial<DeckSettings>): void }`. `update` validates/clamps via `parseDeckSettings` and persists fire-and-forget.

- [ ] **Step 1: Write the failing tests**

`src/settings/useDeckSettings.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK_SETTINGS } from "../deck/models/DeckSettings";
import type { SettingsStorage } from "./storage/SettingsStorage";
import { useDeckSettings } from "./useDeckSettings";

class MemoryStorage implements SettingsStorage {
  constructor(public value: unknown = null) {}
  async load(): Promise<unknown> {
    return this.value;
  }
  async save(value: unknown): Promise<void> {
    this.value = value;
  }
}

describe("useDeckSettings", () => {
  it("loads and validates persisted settings", async () => {
    const storage = new MemoryStorage({ columns: 4, rows: 2 });
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.settings.columns).toBe(4);
    expect(result.current.settings.rows).toBe(2);
  });

  it("falls back to defaults for invalid persisted data", async () => {
    const storage = new MemoryStorage("total garbage");
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.settings).toEqual(DEFAULT_DECK_SETTINGS);
  });

  it("falls back to defaults when storage.load rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const storage: SettingsStorage = {
      load: async () => {
        throw new Error("io");
      },
      save: async () => {},
    };
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.settings).toEqual(DEFAULT_DECK_SETTINGS);
    error.mockRestore();
  });

  it("update merges, clamps, and persists", async () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useDeckSettings(storage));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.update({ columns: 99, compact: true }));
    expect(result.current.settings.columns).toBe(12);
    expect(result.current.settings.compact).toBe(true);
    await waitFor(() =>
      expect((storage.value as { columns: number }).columns).toBe(12),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/settings/useDeckSettings.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/settings/useDeckSettings.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/settings/useDeckSettings.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/settings
git commit -m "feat: add persisted deck settings hook"
```

---

### Task 11: Global styles

No unit tests (visual); reviewed manually in dev. All styling lives in one token-driven stylesheet.

**Files:**
- Create: `src/styles/global.css`
- Delete: `src/App.css`, `src/assets/` (template leftovers)

- [ ] **Step 1: Write `src/styles/global.css`**

```css
:root {
  --shell-bg: #17181c;
  --shell-border: rgba(255, 255, 255, 0.08);
  --shell-radius: 16px;
  --button-bg: linear-gradient(180deg, #26272e 0%, #1c1d23 100%);
  --button-border: rgba(255, 255, 255, 0.07);
  --button-radius: 12px;
  --text-primary: rgba(255, 255, 255, 0.92);
  --text-secondary: rgba(255, 255, 255, 0.55);
  --focus-ring: #6ea8fe;
  --status-idle: rgba(255, 255, 255, 0.18);
  --status-active: #4da3ff;
  --status-working: #f5b942;
  --status-done: #43c96f;
  --status-warning: #ff9f43;
  --status-error: #ff5c5c;
  --press-duration: 90ms;
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
  background: transparent;
  font-family:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
  color: var(--text-primary);
  user-select: none;
  -webkit-user-select: none;
}

/* ---------- Shell ---------- */

.deck-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--shell-bg);
  border: 1px solid var(--shell-border);
  border-radius: var(--shell-radius);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.deck-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  overflow: auto;
}

.deck-shell--compact .deck-main {
  padding: 8px;
}

/* ---------- Toolbar ---------- */

.deck-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--shell-border);
  background: rgba(255, 255, 255, 0.03);
  cursor: grab;
}

.deck-toolbar__title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--text-secondary);
}

.deck-toolbar__pages {
  display: flex;
  gap: 5px;
  margin-inline: auto;
}

.deck-toolbar__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
}

.deck-toolbar__dot--active {
  background: var(--status-active);
}

.deck-toolbar__actions {
  display: flex;
  gap: 4px;
}

.deck-toolbar__button {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.deck-toolbar__button:hover {
  background: rgba(255, 255, 255, 0.09);
  color: var(--text-primary);
}

.deck-toolbar__button[aria-pressed="true"] {
  background: rgba(110, 168, 254, 0.22);
  color: var(--text-primary);
}

/* ---------- Grid ---------- */

.deck-grid-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.deck-grid {
  display: grid;
  grid-template-columns: repeat(var(--deck-columns), max-content);
  gap: var(--deck-gap);
}

.deck-grid__overflow {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
}

/* ---------- Button ---------- */

.deck-button {
  position: relative;
  width: var(--button-size);
  height: var(--button-size);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px;
  border: 1px solid var(--button-border);
  border-radius: var(--button-radius);
  background: var(--button-bg);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 2px 6px rgba(0, 0, 0, 0.35);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--press-duration) ease,
    filter var(--press-duration) ease,
    box-shadow var(--press-duration) ease;
}

.deck-button:hover:not(:disabled) {
  filter: brightness(1.15);
}

.deck-button:active:not(:disabled) {
  transform: scale(0.94) translateY(1px);
  filter: brightness(0.8);
}

.deck-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.deck-button:disabled {
  opacity: 0.45;
  cursor: default;
  filter: grayscale(0.6);
}

.deck-button--empty,
.deck-button--placeholder {
  background: rgba(255, 255, 255, 0.02);
  border-style: dashed;
  box-shadow: none;
  cursor: default;
}

.deck-button--selected {
  outline: 2px dashed var(--focus-ring);
  outline-offset: 2px;
}

.deck-button__icon {
  font-size: calc(var(--button-size) * 0.3);
  line-height: 1.1;
}

.deck-button--compact .deck-button__icon {
  font-size: calc(var(--button-size) * 0.4);
}

.deck-button__title {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
}

.deck-button__subtitle {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
  color: var(--text-secondary);
}

.deck-button__badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 15px;
  padding: 1px 4px;
  border-radius: 8px;
  background: var(--status-error);
  font-size: 9px;
  font-weight: 700;
  text-align: center;
}

.deck-button__status {
  position: absolute;
  bottom: 5px;
  left: 50%;
  translate: -50% 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--status-idle);
}

.deck-button__status[data-status="active"] {
  background: var(--status-active);
  box-shadow: 0 0 6px var(--status-active);
}

.deck-button__status[data-status="working"] {
  background: var(--status-working);
  box-shadow: 0 0 6px var(--status-working);
  animation: deck-pulse 1.2s ease-in-out infinite;
}

.deck-button__status[data-status="done"] {
  background: var(--status-done);
}

.deck-button__status[data-status="warning"] {
  background: var(--status-warning);
  box-shadow: 0 0 6px var(--status-warning);
}

.deck-button__status[data-status="error"] {
  background: var(--status-error);
  box-shadow: 0 0 6px var(--status-error);
}

@keyframes deck-pulse {
  50% {
    opacity: 0.35;
  }
}

/* ---------- States (loading / empty / error) ---------- */

.deck-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
}

.deck-state button {
  padding: 6px 14px;
  border: 1px solid var(--button-border);
  border-radius: 8px;
  background: var(--button-bg);
  color: var(--text-primary);
  cursor: pointer;
}

/* ---------- Panels (editor / settings) ---------- */

.deck-panel {
  border-top: 1px solid var(--shell-border);
  background: rgba(255, 255, 255, 0.03);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
}

.deck-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.deck-panel__title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.deck-panel__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.deck-panel label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.deck-panel input[type="text"],
.deck-panel input[type="number"],
.deck-panel select {
  background: #101116;
  border: 1px solid var(--button-border);
  border-radius: 6px;
  color: var(--text-primary);
  padding: 4px 8px;
  font-size: 12px;
  width: 110px;
}

.deck-panel input[type="number"] {
  width: 64px;
}

.deck-panel button {
  padding: 4px 10px;
  border: 1px solid var(--button-border);
  border-radius: 6px;
  background: var(--button-bg);
  color: var(--text-primary);
  cursor: pointer;
}

.deck-panel button:hover {
  filter: brightness(1.15);
}

/* ---------- Reduced motion ---------- */

@media (prefers-reduced-motion: reduce) {
  .deck-button {
    transition: none;
  }
  .deck-button:active:not(:disabled) {
    transform: none;
  }
  .deck-button__status[data-status="working"] {
    animation: none;
  }
}
```

- [ ] **Step 2: Point the entry at it**

Modify `src/main.tsx` to:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

(`src/app/App.tsx` does not exist until Task 15 — create a placeholder now so the build stays green:)

```tsx
export default function App() {
  return null;
}
```

Also delete `src/App.tsx`, `src/App.css`, and `src/assets/`.

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

```bash
git add -A src
git commit -m "feat: add stream deck visual styling and app entry"
```

---

### Task 12: DeckButtonView component

**Files:**
- Create: `src/deck/components/DeckButtonView.tsx`
- Test: `src/deck/components/DeckButtonView.test.tsx`

**Interfaces:**
- Consumes: `DeckButton` (Task 1).
- Produces: `DeckButtonView(props: DeckButtonViewProps)` with `DeckButtonViewProps = { button: DeckButton | null; size: number; compact: boolean; mode: "deck" | "edit"; selected?: boolean; onActivate?(button: DeckButton): void; onSelect?(button: DeckButton): void }`. `button: null` renders a non-interactive filler slot. Buttons without title/icon/action are placeholder “empty buttons” (rendered, focusable in edit mode only via select).

- [ ] **Step 1: Write the failing tests**

`src/deck/components/DeckButtonView.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DeckButton } from "../models/DeckButton";
import { DeckButtonView } from "./DeckButtonView";

const button: DeckButton = {
  id: "backend",
  title: "Backend",
  subtitle: "Running",
  icon: "🖥️",
  status: "active",
  badge: "3",
  action: { type: "log", message: "hi" },
};

const renderButton = (overrides: Partial<Parameters<typeof DeckButtonView>[0]> = {}) =>
  render(
    <DeckButtonView
      button={button}
      size={88}
      compact={false}
      mode="deck"
      {...overrides}
    />,
  );

describe("DeckButtonView", () => {
  it("renders title, subtitle, icon, and badge", () => {
    renderButton();
    expect(screen.getByRole("button", { name: "Backend" })).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("🖥️")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("activates on click in deck mode", async () => {
    const onActivate = vi.fn();
    renderButton({ onActivate });
    await userEvent.click(screen.getByRole("button", { name: "Backend" }));
    expect(onActivate).toHaveBeenCalledWith(button);
  });

  it("activates with the keyboard (Enter and Space)", async () => {
    const onActivate = vi.fn();
    renderButton({ onActivate });
    const element = screen.getByRole("button", { name: "Backend" });
    element.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it("does not activate when disabled", async () => {
    const onActivate = vi.fn();
    renderButton({ button: { ...button, disabled: true }, onActivate });
    await userEvent.click(screen.getByRole("button", { name: "Backend" }));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("selects instead of activating in edit mode", async () => {
    const onActivate = vi.fn();
    const onSelect = vi.fn();
    renderButton({ mode: "edit", onActivate, onSelect });
    await userEvent.click(screen.getByRole("button", { name: "Backend" }));
    expect(onSelect).toHaveBeenCalledWith(button);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("renders a non-interactive filler for null slots", () => {
    const { container } = renderButton({ button: null });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".deck-button--empty")).not.toBeNull();
  });

  it("labels icon-less, title-less buttons as empty", () => {
    renderButton({ button: { id: "empty-1" } });
    expect(screen.getByRole("button", { name: "Empty button" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/deck/components/DeckButtonView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/deck/components/DeckButtonView.tsx`:

```tsx
import type { CSSProperties } from "react";
import type { DeckButton } from "../models/DeckButton";

export interface DeckButtonViewProps {
  button: DeckButton | null;
  size: number;
  compact: boolean;
  mode: "deck" | "edit";
  selected?: boolean;
  onActivate?(button: DeckButton): void;
  onSelect?(button: DeckButton): void;
}

export function DeckButtonView({
  button,
  size,
  compact,
  mode,
  selected = false,
  onActivate,
  onSelect,
}: DeckButtonViewProps) {
  const style = { "--button-size": `${size}px` } as CSSProperties;

  if (!button) {
    return <div className="deck-button deck-button--empty" style={style} aria-hidden="true" />;
  }

  const isPlaceholder = !button.title && !button.icon && !button.action;
  const classes = [
    "deck-button",
    compact ? "deck-button--compact" : "",
    selected ? "deck-button--selected" : "",
    isPlaceholder ? "deck-button--placeholder" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    if (mode === "edit") {
      onSelect?.(button);
      return;
    }
    if (!isPlaceholder) {
      onActivate?.(button);
    }
  };

  return (
    <button
      type="button"
      className={classes}
      style={style}
      disabled={mode === "deck" && (button.disabled ?? false)}
      aria-label={button.title ?? "Empty button"}
      onClick={handleClick}
    >
      {button.badge ? <span className="deck-button__badge">{button.badge}</span> : null}
      <span className="deck-button__icon" aria-hidden="true">
        {button.icon ?? ""}
      </span>
      {button.title ? <span className="deck-button__title">{button.title}</span> : null}
      {!compact && button.subtitle ? (
        <span className="deck-button__subtitle">{button.subtitle}</span>
      ) : null}
      <span
        className="deck-button__status"
        data-status={button.status ?? "idle"}
        aria-hidden="true"
      />
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/deck/components/DeckButtonView.test.tsx`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/deck/components
git commit -m "feat: add deck button component with press states and a11y"
```

---

### Task 13: DeckGrid component

**Files:**
- Create: `src/deck/components/DeckGrid.tsx`
- Test: `src/deck/components/DeckGrid.test.tsx`

**Interfaces:**
- Consumes: `DeckButtonView` (Task 12), `DeckPage` (Task 1), `DeckSettings` (Task 4).
- Produces: `DeckGrid(props: DeckGridProps)` with `DeckGridProps = { page: DeckPage; settings: DeckSettings; mode: "deck" | "edit"; selectedButtonId: string | null; onActivate(button: DeckButton): void; onSelect(button: DeckButton): void }`.

- [ ] **Step 1: Write the failing tests**

`src/deck/components/DeckGrid.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK_SETTINGS } from "../models/DeckSettings";
import type { DeckPage } from "../models/DeckPage";
import { DeckGrid } from "./DeckGrid";

const makePage = (count: number): DeckPage => ({
  id: "p1",
  name: "Page 1",
  buttons: Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    title: `Button ${i}`,
  })),
});

const renderGrid = (page: DeckPage, settings = DEFAULT_DECK_SETTINGS) =>
  render(
    <DeckGrid
      page={page}
      settings={settings}
      mode="deck"
      selectedButtonId={null}
      onActivate={vi.fn()}
      onSelect={vi.fn()}
    />,
  );

describe("DeckGrid", () => {
  it("renders every provided button", () => {
    renderGrid(makePage(4));
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("pads sparse pages with empty filler slots up to capacity", () => {
    const { container } = renderGrid(makePage(4));
    expect(container.querySelectorAll(".deck-button--empty")).toHaveLength(11);
  });

  it("hides overflowing buttons and says how many", () => {
    renderGrid(makePage(20));
    expect(screen.getAllByRole("button")).toHaveLength(15);
    expect(screen.getByText(/5 buttons hidden/)).toBeInTheDocument();
  });

  it("is labelled with the page name", () => {
    renderGrid(makePage(1));
    expect(screen.getByRole("group", { name: "Deck page: Page 1" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/deck/components/DeckGrid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/deck/components/DeckGrid.tsx`:

```tsx
import type { CSSProperties } from "react";
import type { DeckButton } from "../models/DeckButton";
import type { DeckPage } from "../models/DeckPage";
import type { DeckSettings } from "../models/DeckSettings";
import { DeckButtonView } from "./DeckButtonView";

export interface DeckGridProps {
  page: DeckPage;
  settings: DeckSettings;
  mode: "deck" | "edit";
  selectedButtonId: string | null;
  onActivate(button: DeckButton): void;
  onSelect(button: DeckButton): void;
}

export function DeckGrid({
  page,
  settings,
  mode,
  selectedButtonId,
  onActivate,
  onSelect,
}: DeckGridProps) {
  const capacity = settings.columns * settings.rows;
  const visible = page.buttons.slice(0, capacity);
  const hiddenCount = page.buttons.length - visible.length;
  const slots: (DeckButton | null)[] = [
    ...visible,
    ...Array<null>(Math.max(capacity - visible.length, 0)).fill(null),
  ];
  const gridStyle = {
    "--deck-columns": settings.columns,
    "--deck-gap": `${settings.gap}px`,
  } as CSSProperties;

  return (
    <div className="deck-grid-wrap">
      <div
        className="deck-grid"
        role="group"
        aria-label={`Deck page: ${page.name}`}
        style={gridStyle}
      >
        {slots.map((slot, index) => (
          <DeckButtonView
            key={slot?.id ?? `filler-${index}`}
            button={slot}
            size={settings.buttonSize}
            compact={settings.compact}
            mode={mode}
            selected={slot !== null && slot.id === selectedButtonId}
            onActivate={onActivate}
            onSelect={onSelect}
          />
        ))}
      </div>
      {hiddenCount > 0 ? (
        <p className="deck-grid__overflow">
          {hiddenCount} button{hiddenCount === 1 ? "" : "s"} hidden — add rows or columns
          in settings
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/deck/components/DeckGrid.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/deck/components
git commit -m "feat: add deck grid with slot padding and overflow handling"
```

---

### Task 14: DeckToolbar component

**Files:**
- Create: `src/deck/components/DeckToolbar.tsx`
- Test: `src/deck/components/DeckToolbar.test.tsx`

**Interfaces:**
- Produces: `DeckToolbar(props: DeckToolbarProps)` with `DeckToolbarProps = { pageIndex: number; pageCount: number; mode: "deck" | "edit"; onToggleEdit(): void; onOpenSettings(): void; onClose(): void }`. Root element carries `data-tauri-drag-region` (the Tauri drag handle); the three control buttons remain clickable because the attribute only affects the element itself.

- [ ] **Step 1: Write the failing tests**

`src/deck/components/DeckToolbar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeckToolbar } from "./DeckToolbar";

const renderToolbar = (overrides: Partial<Parameters<typeof DeckToolbar>[0]> = {}) =>
  render(
    <DeckToolbar
      pageIndex={1}
      pageCount={3}
      mode="deck"
      onToggleEdit={vi.fn()}
      onOpenSettings={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />,
  );

describe("DeckToolbar", () => {
  it("marks itself as the window drag region", () => {
    const { container } = renderToolbar();
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
  });

  it("announces the current page position", () => {
    renderToolbar();
    expect(screen.getByLabelText("Page 2 of 3")).toBeInTheDocument();
  });

  it("wires the edit, settings, and close controls", async () => {
    const onToggleEdit = vi.fn();
    const onOpenSettings = vi.fn();
    const onClose = vi.fn();
    renderToolbar({ onToggleEdit, onOpenSettings, onClose });
    await userEvent.click(screen.getByRole("button", { name: "Toggle edit mode" }));
    await userEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Close window" }));
    expect(onToggleEdit).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("reflects edit mode on the edit control", () => {
    renderToolbar({ mode: "edit" });
    expect(screen.getByRole("button", { name: "Toggle edit mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/deck/components/DeckToolbar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/deck/components/DeckToolbar.tsx`:

```tsx
export interface DeckToolbarProps {
  pageIndex: number;
  pageCount: number;
  mode: "deck" | "edit";
  onToggleEdit(): void;
  onOpenSettings(): void;
  onClose(): void;
}

export function DeckToolbar({
  pageIndex,
  pageCount,
  mode,
  onToggleEdit,
  onOpenSettings,
  onClose,
}: DeckToolbarProps) {
  const shownCount = Math.max(pageCount, 1);
  return (
    <header className="deck-toolbar" data-tauri-drag-region>
      <span className="deck-toolbar__title" data-tauri-drag-region>
        DUCK
      </span>
      <span
        className="deck-toolbar__pages"
        role="status"
        aria-label={`Page ${pageIndex + 1} of ${shownCount}`}
      >
        {Array.from({ length: shownCount }, (_, index) => (
          <span
            key={index}
            className={
              index === pageIndex
                ? "deck-toolbar__dot deck-toolbar__dot--active"
                : "deck-toolbar__dot"
            }
          />
        ))}
      </span>
      <span className="deck-toolbar__actions">
        <button
          type="button"
          className="deck-toolbar__button"
          aria-label="Toggle edit mode"
          aria-pressed={mode === "edit"}
          onClick={onToggleEdit}
        >
          ✎
        </button>
        <button
          type="button"
          className="deck-toolbar__button"
          aria-label="Open settings"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
        <button
          type="button"
          className="deck-toolbar__button"
          aria-label="Close window"
          onClick={onClose}
        >
          ✕
        </button>
      </span>
    </header>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/deck/components/DeckToolbar.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/deck/components
git commit -m "feat: add toolbar with drag region and window controls"
```

---

### Task 15: Deck switcher, App composition, providers

**Files:**
- Create: `src/deck/components/Deck.tsx`
- Create: `src/app/providers.ts`
- Modify: `src/app/App.tsx` (replace Task 11 placeholder)
- Test: `src/deck/components/Deck.test.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `Deck(props: DeckProps)` with `DeckProps = { page: DeckPage | null; loading: boolean; error: boolean; settings: DeckSettings; mode: "deck" | "edit"; selectedButtonId: string | null; onActivate(button: DeckButton): void; onSelect(button: DeckButton): void; onRetry(): void }`.
  - `createAppDependencies(): AppDependencies` with `AppDependencies = { provider: DeckButtonProvider; dispatcher: DeckActionDispatcher; settingsStorage: SettingsStorage }` — registers the `log` handler at creation.
  - `App({ dependencies }: { dependencies?: AppDependencies })` — default export; injectable for tests.

- [ ] **Step 1: Write the failing Deck tests**

`src/deck/components/Deck.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK_SETTINGS } from "../models/DeckSettings";
import { Deck } from "./Deck";

const baseProps = {
  page: null,
  loading: false,
  error: false,
  settings: DEFAULT_DECK_SETTINGS,
  mode: "deck" as const,
  selectedButtonId: null,
  onActivate: vi.fn(),
  onSelect: vi.fn(),
  onRetry: vi.fn(),
};

describe("Deck", () => {
  it("shows an error state with retry when the provider failed", async () => {
    const onRetry = vi.fn();
    render(<Deck {...baseProps} error onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t load/i);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows a loading state", () => {
    render(<Deck {...baseProps} loading />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no pages", () => {
    render(<Deck {...baseProps} />);
    expect(screen.getByText(/no deck pages/i)).toBeInTheDocument();
  });

  it("renders the grid when a page is available", () => {
    render(
      <Deck
        {...baseProps}
        page={{ id: "p1", name: "P1", buttons: [{ id: "a", title: "A" }] }}
      />,
    );
    expect(screen.getByRole("button", { name: "A" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/deck/components/Deck.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Deck**

`src/deck/components/Deck.tsx`:

```tsx
import type { DeckButton } from "../models/DeckButton";
import type { DeckPage } from "../models/DeckPage";
import type { DeckSettings } from "../models/DeckSettings";
import { DeckGrid } from "./DeckGrid";

export interface DeckProps {
  page: DeckPage | null;
  loading: boolean;
  error: boolean;
  settings: DeckSettings;
  mode: "deck" | "edit";
  selectedButtonId: string | null;
  onActivate(button: DeckButton): void;
  onSelect(button: DeckButton): void;
  onRetry(): void;
}

export function Deck({
  page,
  loading,
  error,
  settings,
  mode,
  selectedButtonId,
  onActivate,
  onSelect,
  onRetry,
}: DeckProps) {
  if (error) {
    return (
      <div className="deck-state" role="alert">
        <p>Couldn’t load deck buttons.</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="deck-state">
        <p>Loading…</p>
      </div>
    );
  }
  if (!page) {
    return (
      <div className="deck-state">
        <p>No deck pages available.</p>
      </div>
    );
  }
  return (
    <DeckGrid
      page={page}
      settings={settings}
      mode={mode}
      selectedButtonId={selectedButtonId}
      onActivate={onActivate}
      onSelect={onSelect}
    />
  );
}
```

Run: `npx vitest run src/deck/components/Deck.test.tsx`
Expected: 4 passed. Commit:

```bash
git add src/deck/components
git commit -m "feat: add deck state switcher component"
```

- [ ] **Step 4: Write the failing App tests**

`src/app/App.test.tsx`:

```tsx
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
    expect(await screen.findByRole("dialog", { name: "Deck settings" })).toBeInTheDocument();
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
```

**NOTE:** the last two tests depend on `SettingsPanel` (Task 17). Write all App tests now, but add `.todo` markers for the two settings-panel tests until Task 17, then un-todo them. Alternatively run Tasks 15–17 before expecting full green; the plan executes them consecutively.

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx vitest run src/app/App.test.tsx`
Expected: FAIL — `./App` has no `AppDependencies` export yet.

- [ ] **Step 6: Implement providers.ts and App.tsx**

`src/app/providers.ts`:

```ts
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
```

`src/app/App.tsx`:

```tsx
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
```

**NOTE:** `EditorPanel` and `SettingsPanel` don’t exist until Tasks 16–17. To keep each task compiling, Tasks 15–17 are one commit series: implement `App.tsx` in this task with the two panel imports commented out and `.todo` on their tests, then un-comment in Tasks 16/17. If executing tasks strictly one-by-one, prefer: land Deck + providers here, land App.tsx at the end of Task 17.

- [ ] **Step 7: Run the non-panel App tests to verify they pass**

Run: `npx vitest run src/app/App.test.tsx`
Expected: first 5 pass; 2 marked `.todo`.

- [ ] **Step 8: Commit**

```bash
git add src/app src/deck/components
git commit -m "feat: compose app shell with provider, dispatcher, and navigation"
```

---

### Task 16: EditorPanel

**Files:**
- Create: `src/editor/components/EditorPanel.tsx`
- Test: `src/editor/components/EditorPanel.test.tsx`

**Interfaces:**
- Consumes: `DeckButton` (Task 1), `MoveDirection` (Task 7).
- Produces: `EditorPanel(props: EditorPanelProps)` with `EditorPanelProps = { selectedButton: DeckButton | null; onUpdate(patch: Partial<Omit<DeckButton, "id">>): void; onMove(direction: MoveDirection): void; onRestore(): void }`.

- [ ] **Step 1: Write the failing tests**

`src/editor/components/EditorPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DeckButton } from "../../deck/models/DeckButton";
import { EditorPanel } from "./EditorPanel";

const button: DeckButton = { id: "a", title: "Alpha", status: "active" };

const renderPanel = (overrides: Partial<Parameters<typeof EditorPanel>[0]> = {}) => {
  const props = {
    selectedButton: button,
    onUpdate: vi.fn(),
    onMove: vi.fn(),
    onRestore: vi.fn(),
    ...overrides,
  };
  render(<EditorPanel {...props} />);
  return props;
};

describe("EditorPanel", () => {
  it("asks for a selection when nothing is selected", () => {
    renderPanel({ selectedButton: null });
    expect(screen.getByText(/select a button/i)).toBeInTheDocument();
  });

  it("edits the title", async () => {
    const { onUpdate } = renderPanel();
    await userEvent.type(screen.getByLabelText("Title"), "!");
    expect(onUpdate).toHaveBeenCalledWith({ title: "Alpha!" });
  });

  it("changes the visual status", async () => {
    const { onUpdate } = renderPanel();
    await userEvent.selectOptions(screen.getByLabelText("Status"), "error");
    expect(onUpdate).toHaveBeenCalledWith({ status: "error" });
  });

  it("toggles disabled", async () => {
    const { onUpdate } = renderPanel();
    await userEvent.click(screen.getByLabelText("Disabled"));
    expect(onUpdate).toHaveBeenCalledWith({ disabled: true });
  });

  it("moves the button", async () => {
    const { onMove } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Move right" }));
    expect(onMove).toHaveBeenCalledWith("right");
  });

  it("restores the mock configuration", async () => {
    const { onRestore } = renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Restore mock configuration" }),
    );
    expect(onRestore).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/editor/components/EditorPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/editor/components/EditorPanel.tsx`:

```tsx
import type { DeckButton, DeckButtonStatus } from "../../deck/models/DeckButton";
import type { MoveDirection } from "../editOperations";

const STATUSES: DeckButtonStatus[] = [
  "idle",
  "active",
  "working",
  "done",
  "warning",
  "error",
];

export interface EditorPanelProps {
  selectedButton: DeckButton | null;
  onUpdate(patch: Partial<Omit<DeckButton, "id">>): void;
  onMove(direction: MoveDirection): void;
  onRestore(): void;
}

export function EditorPanel({
  selectedButton,
  onUpdate,
  onMove,
  onRestore,
}: EditorPanelProps) {
  return (
    <section className="deck-panel" aria-label="Button editor">
      <div className="deck-panel__header">
        <h2 className="deck-panel__title">Edit mode</h2>
        <button type="button" onClick={onRestore}>
          Restore mock configuration
        </button>
      </div>
      {!selectedButton ? (
        <p>Select a button in the grid to edit it.</p>
      ) : (
        <>
          <div className="deck-panel__row">
            <label>
              Title
              <input
                type="text"
                value={selectedButton.title ?? ""}
                onChange={(event) =>
                  onUpdate({ title: event.target.value || undefined })
                }
              />
            </label>
            <label>
              Subtitle
              <input
                type="text"
                value={selectedButton.subtitle ?? ""}
                onChange={(event) =>
                  onUpdate({ subtitle: event.target.value || undefined })
                }
              />
            </label>
          </div>
          <div className="deck-panel__row">
            <label>
              Status
              <select
                value={selectedButton.status ?? "idle"}
                onChange={(event) =>
                  onUpdate({ status: event.target.value as DeckButtonStatus })
                }
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Disabled
              <input
                type="checkbox"
                checked={selectedButton.disabled ?? false}
                onChange={(event) => onUpdate({ disabled: event.target.checked })}
              />
            </label>
          </div>
          <div className="deck-panel__row">
            <button type="button" aria-label="Move left" onClick={() => onMove("left")}>
              ←
            </button>
            <button type="button" aria-label="Move right" onClick={() => onMove("right")}>
              →
            </button>
            <button type="button" aria-label="Move up" onClick={() => onMove("up")}>
              ↑
            </button>
            <button type="button" aria-label="Move down" onClick={() => onMove("down")}>
              ↓
            </button>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/editor/components/EditorPanel.test.tsx`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/editor
git commit -m "feat: add edit mode panel"
```

---

### Task 17: SettingsPanel

**Files:**
- Create: `src/settings/components/SettingsPanel.tsx`
- Test: `src/settings/components/SettingsPanel.test.tsx`
- Modify: `src/app/App.tsx` (enable panel imports), `src/app/App.test.tsx` (un-todo the two panel tests)

**Interfaces:**
- Consumes: `DeckSettings`, `DECK_SETTINGS_LIMITS` (Task 4).
- Produces: `SettingsPanel(props: SettingsPanelProps)` with `SettingsPanelProps = { settings: DeckSettings; onChange(patch: Partial<DeckSettings>): void; onClose(): void }`. Rendered as `role="dialog"` labelled “Deck settings”.

- [ ] **Step 1: Write the failing tests**

`src/settings/components/SettingsPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DECK_SETTINGS } from "../../deck/models/DeckSettings";
import { SettingsPanel } from "./SettingsPanel";

const renderPanel = (overrides: Partial<Parameters<typeof SettingsPanel>[0]> = {}) => {
  const props = {
    settings: DEFAULT_DECK_SETTINGS,
    onChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<SettingsPanel {...props} />);
  return props;
};

describe("SettingsPanel", () => {
  it("is an accessible dialog", () => {
    renderPanel();
    expect(screen.getByRole("dialog", { name: "Deck settings" })).toBeInTheDocument();
  });

  it("shows current values", () => {
    renderPanel();
    expect(screen.getByLabelText("Columns")).toHaveValue(5);
    expect(screen.getByLabelText("Rows")).toHaveValue(3);
    expect(screen.getByLabelText("Button size")).toHaveValue(88);
    expect(screen.getByLabelText("Gap")).toHaveValue(12);
  });

  it("emits numeric changes", async () => {
    const { onChange } = renderPanel();
    const rows = screen.getByLabelText("Rows");
    await userEvent.clear(rows);
    await userEvent.type(rows, "4");
    expect(onChange).toHaveBeenLastCalledWith({ rows: 4 });
  });

  it("emits boolean changes", async () => {
    const { onChange } = renderPanel();
    await userEvent.click(screen.getByLabelText("Always on top"));
    expect(onChange).toHaveBeenCalledWith({ alwaysOnTop: true });
    await userEvent.click(screen.getByLabelText("Compact mode"));
    expect(onChange).toHaveBeenCalledWith({ compact: true });
  });

  it("closes", async () => {
    const { onClose } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/settings/components/SettingsPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/settings/components/SettingsPanel.tsx`:

```tsx
import {
  DECK_SETTINGS_LIMITS,
  type DeckSettings,
} from "../../deck/models/DeckSettings";

export interface SettingsPanelProps {
  settings: DeckSettings;
  onChange(patch: Partial<DeckSettings>): void;
  onClose(): void;
}

type NumericKey = keyof typeof DECK_SETTINGS_LIMITS;

const NUMERIC_FIELDS: { key: NumericKey; label: string }[] = [
  { key: "columns", label: "Columns" },
  { key: "rows", label: "Rows" },
  { key: "buttonSize", label: "Button size" },
  { key: "gap", label: "Gap" },
];

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  return (
    <section className="deck-panel" role="dialog" aria-label="Deck settings">
      <div className="deck-panel__header">
        <h2 className="deck-panel__title">Settings</h2>
        <button type="button" aria-label="Close settings" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="deck-panel__row">
        {NUMERIC_FIELDS.map(({ key, label }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min={DECK_SETTINGS_LIMITS[key].min}
              max={DECK_SETTINGS_LIMITS[key].max}
              value={settings[key]}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (Number.isFinite(parsed)) {
                  onChange({ [key]: parsed });
                }
              }}
            />
          </label>
        ))}
      </div>
      <div className="deck-panel__row">
        <label>
          Compact mode
          <input
            type="checkbox"
            checked={settings.compact}
            onChange={(event) => onChange({ compact: event.target.checked })}
          />
        </label>
        <label>
          Always on top
          <input
            type="checkbox"
            checked={settings.alwaysOnTop}
            onChange={(event) => onChange({ alwaysOnTop: event.target.checked })}
          />
        </label>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Enable the panels in App and un-todo the App tests**

Uncomment the `EditorPanel`/`SettingsPanel` imports and JSX in `src/app/App.tsx`; remove `.todo` from the two panel tests in `src/app/App.test.tsx`.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (all files).

- [ ] **Step 6: Commit**

```bash
git add src/settings src/app
git commit -m "feat: add settings panel wired to persisted deck settings"
```

---

### Task 18: Tauri native shell configuration

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `index.html`

No unit tests (native config); verified by `cargo check` + manual `npm run tauri dev`.

- [ ] **Step 1: Update `src-tauri/tauri.conf.json`**

Replace the `app` section and window list:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Duck Deck",
  "version": "0.1.0",
  "identifier": "com.hokita.duck",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "macOSPrivateApi": true,
    "windows": [
      {
        "title": "Duck Deck",
        "width": 560,
        "height": 400,
        "minWidth": 320,
        "minHeight": 240,
        "resizable": true,
        "decorations": false,
        "transparent": true,
        "shadow": false,
        "acceptFirstMouse": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

Why: `decorations: false` + `transparent: true` produce the frameless rounded-corner shell (CSS draws the visible window); `macOSPrivateApi: true` is required for transparency on macOS; `shadow: false` because the CSS shell draws its own shadow; `acceptFirstMouse` makes buttons clickable on first click when the window is unfocused (utility-window feel).

- [ ] **Step 2: Update `src-tauri/Cargo.toml` dependencies**

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-store = "2"
tauri-plugin-window-state = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

(removes `tauri-plugin-opener`, adds the two persistence plugins and the `macos-private-api` feature required by `macOSPrivateApi: true`).

- [ ] **Step 3: Update `src-tauri/src/lib.rs`**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

(window-state persists window size/position automatically; store backs `TauriStoreSettingsStorage`).

- [ ] **Step 4: Update `src-tauri/capabilities/default.json`**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main deck window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-always-on-top",
    "core:window:allow-close",
    "store:default"
  ]
}
```

(`core:default` already includes `start-dragging` for the toolbar drag region; `set-always-on-top` and `close` are opt-in; `store:default` lets the frontend read/write the settings store.)

- [ ] **Step 5: Update `index.html`**

Set `<title>Duck Deck</title>` and remove template styling references so the body stays transparent (global.css handles it). Final head/body:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Duck Deck</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Verify the Rust side compiles**

Run: `cd src-tauri && cargo check`
Expected: `Finished` with no errors (first run downloads crates; takes minutes).

- [ ] **Step 7: Smoke-test dev mode**

Run: `npm run tauri dev`
Expected: frameless dark rounded window with the mock deck; toolbar drags the window; buttons press; close button works. (Manual check.)

- [ ] **Step 8: Commit**

```bash
git add src-tauri index.html
git commit -m "feat: configure frameless persistent tauri shell"
```

---

### Task 19: Full verification pass

**Files:** whatever the tools flag.

- [ ] **Step 1: Format**

Run: `npx prettier --write .`

- [ ] **Step 2: Lint**

Run: `npx eslint .`
Expected: no errors; fix any findings.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Production build**

Run: `npm run tauri build`
Expected: `.app` bundle produced under `src-tauri/target/release/bundle/macos/`. Fix any errors and re-run.

- [ ] **Step 6: Add npm scripts for the toolchain**

Add to `package.json` scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit -p tsconfig.json"
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: formatting, lint fixes, and toolchain scripts"
```

---

### Task 20: README

**Files:**
- Modify: `README.md` (replace template README)

- [ ] **Step 1: Write the README** covering, in this order:
  1. What the app is (generic Stream Deck-style desktop deck; screenshot placeholder).
  2. Install: `npm install` (+ Rust toolchain ≥ 1.77 via rustup).
  3. Develop: `npm run tauri dev`; frontend-only: `npm run dev`; tests: `npm test`; lint/format/typecheck scripts.
  4. Build: `npm run tauri build` → `src-tauri/target/release/bundle/macos/Duck Deck.app`.
  5. Architecture: the four layers (desktop shell / deck UI / button data / actions) with the actual directory tree.
  6. Provider abstraction: `DeckButtonProvider` contract, why pages, how `MockDeckButtonProvider` is wired in `app/providers.ts`, and a concrete “add a ClaudeCodeButtonProvider later” snippet:

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
  7. Actions: the `DeckButtonAction` union, dispatcher registration, reserved navigate ids.
  8. Persistence: settings via tauri-plugin-store (`settings.json` in app data dir; localStorage fallback in plain browsers), window geometry via tauri-plugin-window-state.
  9. macOS/Tauri notes: `macOSPrivateApi` (transparency), frameless window, capability permissions used and why, no other macOS permissions required.
  10. Known limitations: edit-mode changes are session-only (Restore reloads mock data), no drag-and-drop reordering, provider `subscribe` unused by the mock.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document architecture, usage, and provider extension"
```

---

## Self-Review Notes

- **Spec coverage:** provider abstraction (T3), dispatcher (T2), pages (T8), edit mode (T7/T16), settings persistence (T4/T5/T10/T18), window behavior (T18), a11y + reduced motion (T11/T12), error/empty/overflow states (T13/T15), mock content incl. folder/settings/empty buttons (T3), tests for all six required areas (T2, T15 app tests, T8, T15 empty, T10 invalid settings, T12 keyboard), README (T20). Drag-and-drop deliberately deferred (spec allows move buttons).
- **Known compromise:** Tasks 15–17 form one compile unit (App imports both panels); the plan sequences their tests with `.todo` markers to keep every intermediate state green.
- **Type consistency check:** `DeckButtonAction` (not `DeckAction`) is the action union everywhere; `MoveDirection` lives in `editOperations.ts`; provider returns `DeckPage[]` (never flat buttons); `AppDependencies` re-exported from `App.tsx` for tests.
