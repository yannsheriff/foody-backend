import { Days } from '@prisma/client';
import {
  computeDayScore,
  hasHeavyMeal,
  isDayFullyTracked,
  startOfDay,
  ymd,
} from '../insights/insights.scoring';
import { WeeklyChallengeDef } from './weekly-catalog.constants';

// Mirror of SNACK_THRESHOLD (challenges) / the no-snack badge (0.15) — keep in
// sync with insights.constants.ts's no-snack qualifier if it ever moves.
export const SNACK_THRESHOLD = 0.15;
// Minimum score for each day of a clean weekend (mirrors the legacy weekend
// challenge WEEKEND_MIN_SCORE).
export const WEEKEND_MIN_SCORE = 6.5;

const DAY_MS = 86_400_000;

export interface WeekBounds {
  weekStart: Date; // Monday 00:00:00.000 UTC
  weekEnd: Date; // Sunday 23:59:59.999 UTC
  isoWeek: string; // "2026-W30"
}

function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * DAY_MS);
}

// Monday-index of a date (Mon=0 … Sun=6), UTC.
function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

// ISO-8601 week key, e.g. "2026-W30". Year is the ISO week-year (may differ from
// the calendar year for the first/last days of a year).
export function isoWeekOf(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // Shift to the Thursday of this week — ISO weeks are numbered by their Thursday.
  d.setUTCDate(d.getUTCDate() - mondayIndex(d) + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - mondayIndex(firstThursday) + 3,
  );
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// The Monday→Sunday UTC bounds of the calendar week containing `date`.
export function weekBounds(date: Date): WeekBounds {
  const weekStart = addDays(startOfDay(date), -mondayIndex(date));
  const weekEnd = new Date(addDays(weekStart, 7).getTime() - 1); // Sun 23:59:59.999
  return { weekStart, weekEnd, isoWeek: isoWeekOf(weekStart) };
}

// Days remaining in the current week, today included (Mon=7 … Sun=1).
export function daysLeftInWeek(now: Date = new Date()): number {
  return 7 - mondayIndex(now);
}

// Objective scaled to a late start: picking on day D of the week only requires a
// share of the target. Weekend (total 1, non-prorable) is excluded upstream.
export function proratedTarget(baseTarget: number, daysLeft: number): number {
  return Math.max(1, Math.round((baseTarget * daysLeft) / 7));
}

// Does a single day satisfy the challenge's metric?
export function qualifiesWeekly(def: WeeklyChallengeDef, d: Days): boolean {
  switch (def.kind) {
    case 'saisie':
      return isDayFullyTracked(d);
    case 'copieux':
      return isDayFullyTracked(d) && !hasHeavyMeal(d);
    case 'grignotage':
      return d.snack != null && d.snack < SNACK_THRESHOLD;
    case 'note':
      return isDayFullyTracked(d) && computeDayScore(d) >= (def.minScore ?? 0);
    case 'sport':
      return d.sport_level === 'normal' || d.sport_level === 'intense';
    case 'soir-leger':
      return d.evening_score === 'tresLeger' || d.evening_score === 'leger';
    case 'weekend':
      return (
        isDayFullyTracked(d) &&
        computeDayScore(d) >= (def.minScore ?? WEEKEND_MIN_SCORE)
      );
  }
}

// Is a given UTC calendar day (ymd key) qualifying? OR over all rows of that day,
// so duplicate `days` rows can't hide a qualifying entry.
function dayQualifies(days: Days[], def: WeeklyChallengeDef, key: string): boolean {
  return days.some((d) => ymd(new Date(d.date)) === key && qualifiesWeekly(def, d));
}

// A weekend is clean when BOTH its Saturday and Sunday qualify — but only once
// each day has elapsed (bounded by `endKey`).
function cleanWeekendProgress(
  def: WeeklyChallengeDef,
  days: Days[],
  weekStart: Date,
  endKey: string,
): number {
  const satKey = ymd(addDays(weekStart, 5));
  const sunKey = ymd(addDays(weekStart, 6));
  const satOk = satKey <= endKey && dayQualifies(days, def, satKey);
  const sunOk = sunKey <= endKey && dayQualifies(days, def, sunKey);
  return satOk && sunOk ? 1 : 0;
}

// Progress toward the target: number of distinct qualifying UTC days in the week
// up to `now` (today included — generous display). For `weekend`, 0 or 1.
export function countQualifyingDays(
  def: WeeklyChallengeDef,
  days: Days[],
  weekStart: Date,
  weekEnd: Date,
  now: Date = new Date(),
): number {
  const endKey = ymd(now.getTime() < weekEnd.getTime() ? now : weekEnd);
  const startKey = ymd(weekStart);

  if (def.kind === 'weekend') {
    return cleanWeekendProgress(def, days, weekStart, endKey);
  }

  const qualifyingDays = new Set<string>();
  for (const d of days) {
    const key = ymd(new Date(d.date));
    if (key >= startKey && key <= endKey && qualifiesWeekly(def, d)) {
      qualifyingDays.add(key);
    }
  }
  return qualifyingDays.size;
}

export interface WeeklyResult {
  won: boolean;
  prog: number;
}

// Called once the week has elapsed: count over the FULL week (now = weekEnd) and
// compare to the (possibly prorated) target.
export function resolveWeekly(
  def: WeeklyChallengeDef,
  target: number,
  days: Days[],
  weekStart: Date,
  weekEnd: Date,
): WeeklyResult {
  const prog = countQualifyingDays(def, days, weekStart, weekEnd, weekEnd);
  return { won: prog >= target, prog };
}
