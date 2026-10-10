export type DurationUnit = "d" | "h" | "m" | "s";

const UNIT_MS: Record<DurationUnit, number> = {
  d: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  m: 60 * 1000,
  s: 1000,
};

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

export function expiresAtFromDuration(
  value: string | undefined,
  fallbackMs: number,
): Date {
  return new Date(Date.now() + parseDurationToMs(value, fallbackMs));
}
