import { Days, Score, SportLevel } from '@prisma/client';

export const MEAL_POINTS: Record<Score, number> = {
  tresLeger: 2.5,
  leger: 2.25,
  normal: 1.5,
  copieux: 0.5,
  tresCopieux: 0.0,
};

// Mirrors SPORT_LEVELS in foody/src/lib/meal-levels.ts — keep the point values
// in sync across the two scoring implementations. The total score is still
// capped at 10, so intense (+3) just gives more headroom to reach a perfect day.
export const SPORT_POINTS: Record<SportLevel, number> = {
  none: 0,
  normal: 2,
  intense: 3,
};

function mealPoints(level: Score | null): number {
  if (level == null) return 0;
  return MEAL_POINTS[level] ?? 0;
}

export function sportPoints(day: Days): number {
  if (day.sport_level == null) return 0;
  return SPORT_POINTS[day.sport_level] ?? 0;
}

export function computeDayScore(day: Days): number {
  const meals =
    mealPoints(day.morning_score) +
    mealPoints(day.afternoon_score) +
    mealPoints(day.evening_score);
  const sport = sportPoints(day);
  const snack = day.snack == null ? 0 : 2 * (1 - day.snack);
  const capped = Math.min(10, meals + sport + snack);
  return Math.round(capped * 10) / 10;
}

export function isDayComplete(day: Days): boolean {
  return (
    day.morning_score != null &&
    day.afternoon_score != null &&
    day.evening_score != null &&
    day.snack != null &&
    day.sport_level != null
  );
}

export function isDayFullyTracked(day: Days): boolean {
  // For streak / records: at least the 3 meals were logged
  return (
    day.morning_score != null &&
    day.afternoon_score != null &&
    day.evening_score != null
  );
}

const HEAVY_LEVELS: Score[] = ['copieux', 'tresCopieux'];

export function hasHeavyMeal(day: Days): boolean {
  return [day.morning_score, day.afternoon_score, day.evening_score].some(
    (s) => s != null && HEAVY_LEVELS.includes(s),
  );
}

// Mirrors CATCHUP_DEADLINE_MINUTES (23h30) in foody/src/hooks/useCatchupTarget.ts
// — if the client catch-up window moves, move this with it.
export const GRACE_CUTOFF_MINUTES = 23 * 60 + 30;

// Day D counts for the streak only if its 3 meals were completed by D+1 23:30.
// Server clock is UTC on Vercel while the client cutoff is local time, so the
// server is ~1-2h more lenient for a Paris user — the safe direction (we never
// strip a flame the client promised).
export function graceDeadline(dayDate: Date): Date {
  return new Date(
    startOfDay(dayDate).getTime() + 86_400_000 + GRACE_CUTOFF_MINUTES * 60_000,
  );
}

export function countsForStreak(day: Days): boolean {
  if (!isDayFullyTracked(day)) return false;
  // Rows written before meals_completed_at existed are grandfathered.
  if (day.meals_completed_at == null) return true;
  return day.meals_completed_at.getTime() <= graceDeadline(day.date).getTime();
}

export function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000,
  );
}
