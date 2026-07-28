# Image button icons

## Problem

`DeckButton.icon` is a plain string rendered as text — used today for emoji/glyphs
(see `src/deck/models/DeckButton.ts`, `src/deck/components/DeckButtonView.tsx`).
The user runs Duck to monitor Claude Code sessions via the external-sources
config (`sources.json`, see README's "External sources" section) and wants a
Claude icon *image* on those buttons instead of an emoji.

## Goals

- Let a button's icon be an image, not just an emoji/glyph.
- Keep Duck itself tool-agnostic: no code that knows about "Claude" specifically.
  All icon content stays data-driven through `sources.json`, matching the
  existing external-sources design.
- Stay within the app's current security posture: no CSP changes, no new
  filesystem/network permissions. The CSP already allows `img-src 'self' data:`,
  so a `data:image/...;base64,...` URI needs no policy change.

## Non-goals

- No bundled/built-in icon assets shipped with the app.
- No local file path or remote URL icon support (would require loosening CSP
  and granting filesystem/asset-protocol permissions Duck currently avoids).
- No EditorPanel UI for picking/uploading an icon image — `icon` isn't editable
  in the edit-mode panel today either, and this doesn't change that.

## Design

Reuse the existing `icon` field for both cases rather than adding a parallel
field, auto-detected by prefix:

- A string starting with `data:image/` renders as an image.
- Anything else renders as text/emoji, exactly as today.

This mirrors how `icon` already flows: templated via `{field}` substitution
from external-source JSON files in `src-tauri/src/sources.rs`, unchanged
end-to-end through to `DeckButtonView`. A user who wants a Claude icon embeds
it as a base64 data URI in their own `sources.json` `button.icon` mapping —
Duck's source never mentions Claude.

### Model layer

`src/deck/models/DeckButton.ts`:

- Add a pure helper `isImageIcon(icon?: string): boolean` — true iff the value
  starts with `data:image/`.
- Update the `icon` field's doc comment to mention image support.

### Rendering

`src/deck/components/DeckButtonView.tsx`:

- Inside the existing `.deck-button__icon` span, render
  `<img src={icon} alt="" />` when `isImageIcon(button.icon)` is true;
  otherwise keep today's plain-text rendering.
- No new props, no new DOM structure beyond the conditional `<img>`.

### Styling

`src/styles/global.css`:

- Add `.deck-button__icon-image`: `width`/`height: calc(var(--button-size) * 0.3)`,
  `object-fit: contain` — mirroring the existing non-compact `.deck-button__icon`
  font-size proportion.
- Add a compact-mode variant at `0.4`, mirroring the existing
  `.deck-button--compact .deck-button__icon` font-size proportion.

### Rust side

`src-tauri/src/sources.rs`:

- No functional change: `substitute()` already passes a data URI through
  unchanged (base64 has no `{`/`}` characters to trigger substitution).
- Add a test confirming a data-URI `icon` value survives `button_from_file`
  unchanged, and a doc-comment note on `ButtonMapping.icon` mentioning image
  support.

### Documentation

`README.md`: document that `icon` accepts either an emoji/glyph or a
`data:image/...;base64,...` URI, with an example embedding a Claude icon this
way in `sources.json`.

## Testing

TDD throughout (per project convention):

- `isImageIcon`: unit tests for data-image-URI strings, emoji/glyph strings,
  and `undefined`.
- `DeckButtonView`: test that a `data:image/...` icon renders an `<img>` with
  that `src`, and that a non-image icon still renders as text (regression).
- `sources.rs`: test that `button_from_file` leaves a data-URI icon value
  byte-for-byte unchanged.

## Security notes

- `<img src>` cannot execute script even if a malformed/malicious value is
  supplied (e.g. `javascript:` URIs are not executable via `img src`); worst
  case is a broken image icon.
- `sources.json` is user-authored trusted config, same trust level as other
  `button` mapping fields already substituted from watched files today (e.g.
  `title`, `subtitle`) — this doesn't introduce a new class of untrusted input.
