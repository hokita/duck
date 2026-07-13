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
