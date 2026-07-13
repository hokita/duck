import { useState } from "react";
import { DECK_SETTINGS_LIMITS, type DeckSettings } from "../../deck/models/DeckSettings";

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

/**
 * Buffers the raw text so clearing the field doesn't get overwritten by the
 * parent's (unchanged, or clamped-mid-edit) value on the next render, which
 * would otherwise make typed digits append to or overwrite the stale value
 * instead of replacing it. The parent value only wins once the field is
 * blurred, so a value that clamps low while still being typed (e.g. "1" of
 * "120" hitting a 48 minimum) doesn't stomp the in-progress text.
 */
function NumericField({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange(parsed: number): void;
}) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  if (lastValue !== value) {
    setLastValue(value);
    if (!isFocused) {
      setText(String(value));
    }
  }

  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={text}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          setText(String(value));
        }}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = Number(event.target.value);
          if (event.target.value !== "" && Number.isFinite(parsed)) {
            onChange(parsed);
          }
        }}
      />
    </label>
  );
}

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
          <NumericField
            key={key}
            label={label}
            min={DECK_SETTINGS_LIMITS[key].min}
            max={DECK_SETTINGS_LIMITS[key].max}
            value={settings[key]}
            onChange={(parsed) => onChange({ [key]: parsed })}
          />
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
