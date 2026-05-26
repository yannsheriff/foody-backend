import { Days, Score } from '@prisma/client';

const MEAL_POINTS: Record<Score, number> = {
  tresLeger: 2.5,
  leger: 2.25,
  normal: 1.5,
  copieux: 0.5,
  tresCopieux: 0.0,
};

function mealPoints(level: Score | null): number {
  if (level == null) return 0;
  return MEAL_POINTS[level] ?? 0;
}

export function computeDayScore(day: Days): number {
  const meals =
    mealPoints(day.morning_score) +
    mealPoints(day.afternoon_score) +
    mealPoints(day.evening_score);
  const sport = day.sport ? 2 : 0;
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
    day.sport != null
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
