import { Days, Score } from '@prisma/client';

/**
 * Prisma's @map on enum values separates the JS-side identifier from the
 * DB representation. Our wire/API contract uses kebab-case ("tres-leger",
 * "tres-copieux") because that matches the design tokens and what the
 * frontend persists in Redux. Prisma's TS client only accepts the JS
 * identifier ("tresLeger", "tresCopieux"). These helpers translate at the
 * service boundary so callers can keep using kebab-case end-to-end.
 */

const TO_PRISMA: Record<string, Score> = {
  'tres-leger': 'tresLeger',
  leger: 'leger',
  normal: 'normal',
  copieux: 'copieux',
  'tres-copieux': 'tresCopieux',
};

const FROM_PRISMA: Record<Score, string> = {
  tresLeger: 'tres-leger',
  leger: 'leger',
  normal: 'normal',
  copieux: 'copieux',
  tresCopieux: 'tres-copieux',
};

export function toPrismaScore(value: string | null | undefined): Score | null {
  if (value == null) return null;
  const mapped = TO_PRISMA[value];
  if (!mapped) throw new Error(`Unknown Score value: ${value}`);
  return mapped;
}

export function fromPrismaScore(value: Score | null): string | null {
  if (value == null) return null;
  return FROM_PRISMA[value];
}

export interface DayWire {
  id: number;
  user_id: number;
  morning_score: string | null;
  afternoon_score: string | null;
  evening_score: string | null;
  snack: number | null;
  sport: boolean;
  // Single-word lowercase enum (none/normal/intense) — identical Prisma/DB/wire
  // representation, so no mapping needed (unlike Score).
  sport_level: string | null;
  sport_type: string | null;
  date: Date;
}

export function toWire(day: Days): DayWire {
  return {
    id: day.id,
    user_id: day.user_id,
    morning_score: fromPrismaScore(day.morning_score),
    afternoon_score: fromPrismaScore(day.afternoon_score),
    evening_score: fromPrismaScore(day.evening_score),
    snack: day.snack,
    sport: day.sport,
    sport_level: day.sport_level,
    sport_type: day.sport_type,
    date: day.date,
  };
}
