# Image Button Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `DeckButton.icon` render as an image (via a `data:image/...` URI) in addition to today's emoji/glyph text, so external sources (e.g. a Claude Code session monitor configured through `sources.json`) can show an icon image without Duck's code knowing about any specific tool.

**Architecture:** Reuse the existing `icon` string field end-to-end (model → Rust source substitution → React rendering) rather than adding a parallel field. A new pure helper, `isImageIcon`, detects the `data:image/` prefix; `DeckButtonView` renders an `<img>` when it matches and falls back to today's text rendering otherwise. No CSP or permission changes — the app's CSP already allows `img-src 'self' data:`.

**Tech Stack:** React + TypeScript (Vitest + Testing Library) for the frontend; Rust (Tauri, `cargo test`) for the external-sources backend.

## Global Constraints

- TDD throughout: write the failing test before the implementation, per the project's red/green workflow.
- Reuse the existing `icon` field — no new field (e.g. no `iconImage`).
- A string is treated as an image icon iff it starts with the literal prefix `data:image/`; everything else renders as text, exactly as today.
- No changes to CSP (`src-tauri/tauri.conf.json`), Tauri capabilities (`src-tauri/capabilities/default.json`), or filesystem/network permissions.
- No bundled icon assets shipped with the app, and no EditorPanel UI changes — `icon` isn't editable in edit mode today either.
- Image icon sizing mirrors the existing emoji proportions exactly: `calc(var(--button-size) * 0.3)` non-compact, `calc(var(--button-size) * 0.4)` compact.

---

### Task 1: `isImageIcon` model helper

**Files:**
- Modify: `src/deck/models/DeckButton.ts:10-11`
- Test: `src/deck/models/DeckButton.test.ts` (new file)

**Interfaces:**
- Produces: `isImageIcon(icon?: string): boolean`, exported from `src/deck/models/DeckButton.ts`. Returns `true` iff `icon` is a string starting with `data:image/`.

- [ ] **Step 1: Write the failing test**

Create `src/deck/models/DeckButton.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isImageIcon } from "./DeckButton";

describe("isImageIcon", () => {
  it("returns true for a data:image URI", () => {
    expect(isImageIcon("data:image/png;base64,AAA")).toBe(true);
  });

  it("returns false for an emoji glyph", () => {
    expect(isImageIcon("🖥️")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isImageIcon(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- DeckButton.test.ts`
Expected: FAIL — `isImageIcon` is not exported from `./DeckButton` (module has no such export).

- [ ] **Step 3: Implement `isImageIcon`**

In `src/deck/models/DeckButton.ts`, update the `icon` field's doc comment and add the helper below the `DeckButton` interface:

```ts
export interface DeckButton {
  id: string;
  title?: string;
  subtitle?: string;
  /** Emoji/short glyph, or a `data:image/...` URI rendered as an image. */
  icon?: string;
  status?: DeckButtonStatus;
  badge?: string;
  disabled?: boolean;
  action?: DeckButtonAction;
}

export function isImageIcon(icon?: string): boolean {
  return icon?.startsWith("data:image/") ?? false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- DeckButton.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/deck/models/DeckButton.ts src/deck/models/DeckButton.test.ts
git commit -m "Add isImageIcon helper for data-URI icon detection"
```

---

### Task 2: Render image icons in `DeckButtonView`

**Files:**
- Modify: `src/deck/components/DeckButtonView.tsx:1-2,61-63`
- Modify: `src/styles/global.css:214-221`
- Test: `src/deck/components/DeckButtonView.test.tsx`

**Interfaces:**
- Consumes: `isImageIcon(icon?: string): boolean` from `../models/DeckButton` (Task 1).
- Produces: `DeckButtonView` renders `<img class="deck-button__icon-image" src={button.icon} alt="">` inside `.deck-button__icon` when `isImageIcon(button.icon)` is true; otherwise renders `button.icon` as text, unchanged from today.

- [ ] **Step 1: Write the failing tests**

In `src/deck/components/DeckButtonView.test.tsx`, add two tests inside the existing `describe("DeckButtonView", ...)` block (after the `"renders title, subtitle, icon, and badge"` test):

```tsx
  it("renders an image when icon is a data:image URI", () => {
    const { container } = renderButton({
      button: { ...button, icon: "data:image/png;base64,AAA" },
    });
    const img = container.querySelector(".deck-button__icon-image");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "data:image/png;base64,AAA");
  });

  it("renders a plain glyph as text, not an image", () => {
    const { container } = renderButton();
    expect(container.querySelector(".deck-button__icon-image")).toBeNull();
    expect(screen.getByText("🖥️")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `npm test -- DeckButtonView.test.tsx`
Expected: `"renders an image when icon is a data:image URI"` FAILS (no `.deck-button__icon-image` element exists yet); `"renders a plain glyph as text, not an image"` already passes (no behavior change needed for that case).

- [ ] **Step 3: Implement the conditional render**

In `src/deck/components/DeckButtonView.tsx`, change the import on line 2 and the icon span on lines 61-63:

```tsx
import type { CSSProperties } from "react";
import { isImageIcon, type DeckButton } from "../models/DeckButton";
```

```tsx
      <span className="deck-button__icon" aria-hidden="true">
        {isImageIcon(button.icon) ? (
          <img className="deck-button__icon-image" src={button.icon} alt="" />
        ) : (
          (button.icon ?? "")
        )}
      </span>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- DeckButtonView.test.tsx`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 5: Add image icon sizing to the stylesheet**

In `src/styles/global.css`, immediately after the existing rule at lines 219-221 (`.deck-button--compact .deck-button__icon { ... }`), add:

```css
.deck-button__icon-image {
  width: calc(var(--button-size) * 0.3);
  height: calc(var(--button-size) * 0.3);
  object-fit: contain;
}

.deck-button--compact .deck-button__icon-image {
  width: calc(var(--button-size) * 0.4);
  height: calc(var(--button-size) * 0.4);
}
```

- [ ] **Step 6: Manually verify sizing**

Run: `npm run dev`, open the printed local URL in a browser. The dev build uses `MockDeckButtonProvider`, which has no image icons, so temporarily edit one mock button's `icon` in `src/deck/providers/MockDeckButtonProvider.ts` to a small `data:image/png;base64,...` value (any valid tiny PNG data URI), confirm it renders sized comparably to the emoji icons in both normal and compact toolbar modes, then revert that temporary edit (`git checkout -- src/deck/providers/MockDeckButtonProvider.ts`).

- [ ] **Step 7: Run the full frontend test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/deck/components/DeckButtonView.tsx src/deck/components/DeckButtonView.test.tsx src/styles/global.css
git commit -m "Render data-URI icons as images in DeckButtonView"
```

---

### Task 3: Confirm Rust-side pass-through and document the field

**Files:**
- Modify: `src-tauri/src/sources.rs:27` (doc comment)
- Modify: `src-tauri/src/sources.rs` (new test in the existing `#[cfg(test)] mod tests` block, near `builds_a_deck_button_from_a_file`)

**Interfaces:**
- Consumes: `button_from_file(source_index: usize, file_stem: &str, mapping: &ButtonMapping, file: &serde_json::Value) -> serde_json::Value` (existing, `src-tauri/src/sources.rs:126`).

No production code changes are needed for this task: `substitute()` (`src-tauri/src/sources.rs:96`) already scans for `{`/`}` and returns any string containing neither unchanged, and standard base64 data URIs contain neither character. This task adds a regression test that locks that behavior in explicitly, and documents it — it is not expected to fail before the test is added, since no new logic is being introduced.

- [ ] **Step 1: Write the characterization test**

In `src-tauri/src/sources.rs`, add this test immediately after `builds_a_deck_button_from_a_file` (which ends around line 481):

```rust
    #[test]
    fn button_from_file_passes_through_data_uri_icon_unchanged() {
        let mut source = claude_source();
        source.button.icon = Some("data:image/png;base64,iVBORw0KGgo=".to_string());
        let button = button_from_file(0, "corgi-30", &source.button, &session_file());
        assert_eq!(button["icon"], "data:image/png;base64,iVBORw0KGgo=");
    }
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd src-tauri && cargo test button_from_file_passes_through_data_uri_icon_unchanged`
Expected: PASS. (Unlike a typical red/green cycle, this test is expected to pass immediately — see the note above the step list.)

- [ ] **Step 3: Add the doc comment**

In `src-tauri/src/sources.rs`, update the `ButtonMapping` struct (currently at lines 23-30) to document the `icon` field:

```rust
#[derive(Debug, Deserialize)]
pub struct ButtonMapping {
    pub title: String,
    pub subtitle: Option<String>,
    /// Emoji/short glyph, or a `data:image/...` URI rendered as an image by
    /// the frontend (see `isImageIcon` in `src/deck/models/DeckButton.ts`).
    pub icon: Option<String>,
    pub status: Option<StatusMapping>,
    pub action: Option<Vec<String>>,
}
```

- [ ] **Step 4: Run the full Rust test suite**

Run: `cd src-tauri && cargo test`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/sources.rs
git commit -m "Document and test data-URI icon pass-through in sources.rs"
```

---

### Task 4: Document image icons in the README

**Files:**
- Modify: `README.md:206-208` (External sources → Semantics section)

**Interfaces:** None (documentation only).

- [ ] **Step 1: Add a semantics bullet and example**

In `README.md`, immediately after the existing bullet (currently lines 206-208):

```
- `{field}` placeholders in `title`/`subtitle`/`icon`/`action` substitute the
  file's top-level values — strings as-is, numbers/booleans stringified,
  missing/non-scalar fields as the empty string.
```

add a new bullet:

```
- `icon` also accepts a `data:image/...;base64,...` URI, rendered as an image
  instead of a text glyph — e.g. to show a tool's logo instead of an emoji:
  `"icon": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..."`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document image icon support for external sources"
```
