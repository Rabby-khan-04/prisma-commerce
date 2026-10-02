export type DurationUnit = "d" | "h" | "m" | "s";

const UNIT_MS: Record<DurationUnit, number> = {
  d: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  m: 60 * 1000,
  s: 1000,
};

/**
 * Parse a short duration like "15m", "24h", "7d", "30s" into milliseconds.
 * Returns `fallbackMs` when the value is missing or malformed.
 */
export function parseDurationToMs(
  value: string | undefined,
  fallbackMs: number,
): number {
  const match = value?.match(/^(\d+)([dhms])$/);
  const unit = match?.[2] as DurationUnit | undefined;

  if (!match || !unit || !(unit in UNIT_MS)) {
    return fallbackMs;
  }

  return Number.parseInt(match[1] as string, 10) * UNIT_MS[unit];
}

/** Date `value` from now, parsed from a short duration string, with a fallback. */
export function expiresAtFromDuration(
  value: string | undefined,
  fallbackMs: number,
): Date {
  return new Date(Date.now() + parseDurationToMs(value, fallbackMs));
}
