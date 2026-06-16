import { Days } from '@prisma/client';
import {
  computeDayScore,
  diffDays,
  hasHeavyMeal,
  isDayFullyTracked,
  startOfDay,
  ymd,
} from '../insights/insights.scoring';
import { ChallengeDef } from './challenges.constants';

// Mirrors the `no-snack` badge threshold in insights/insights.constants.ts —
// if one moves, move the other.
export const SNACK_THRESHOLD = 0.15;

export interface ChallengeProgress {
  // Displayed progress, capped at def.total
  prog: number;
  done: boolean;
}

function qualifies(def: ChallengeDef, d: Days): boolean {
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
      // A real session counts as a sport day; repos (none) / unanswered doesn't.
      return d.sport_level === 'normal' || d.sport_level === 'intense';
  }
}

// One entry per calendar day; a day qualifies if any of its rows does
// (duplicate rows for the same date must not break a run).
function qualifyingDayIndex(
  days: Days[],
  def: ChallengeDef,
  start: Date,
  today: Date,
): Map<string, boolean> {
  const index = new Map<string, boolean>();
  for (const d of days) {
    const date = startOfDay(new Date(d.date));
    if (date.getTime() < start.getTime() || date.getTime() > today.getTime()) {
      continue;
    }
    const key = ymd(date);
    index.set(key, (index.get(key) ?? false) || qualifies(def, d));
  }
  return index;
}

// Trailing run of qualifying days ending today. Today never resets the run —
// an in-progress day isn't a failure until it's over (mirrors getStreak's
// today/yesterday head rule) — it can only add. From yesterday backwards,
// every day must exist and qualify; the first miss stops the count.
// This drives the *displayed* progress: it counts today, so the card reads
// full (e.g. 5/5) on the evening of the final day.
export function computeConsecutiveProgress(
  days: Days[],
  def: ChallengeDef,
  startedAt: Date,
  now: Date = new Date(),
): number {
  const start = startOfDay(startedAt);
  const today = startOfDay(now);
  const index = qualifyingDayIndex(days, def, start, today);

  let count = 0;
  if (index.get(ymd(today)) === true) count++;

  let cursor = new Date(today.getTime() - 86_400_000);
  while (cursor.getTime() >= start.getTime()) {
    if (index.get(ymd(cursor)) !== true) break;
    count++;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return count;
}

// Completion is only granted once the final qualifying day is fully elapsed
// ("le défi est validé à minuit le dernier jour"): we look for any run of
// `def.total` consecutive qualifying days ending on or before *yesterday*.
// Scanning the whole [start, yesterday] span (not just the trailing run) means
// a run that completed days ago still counts even if the user skipped the days
// since — it can't be un-done by a later gap. Today is deliberately excluded,
// so a finished-but-not-yet-midnight day stays `done: false` until tomorrow.
function hasCompletedConsecutiveRun(
  days: Days[],
  def: ChallengeDef,
  start: Date,
  today: Date,
): boolean {
  const index = qualifyingDayIndex(days, def, start, today);
  const yesterday = new Date(today.getTime() - 86_400_000);

  let streak = 0;
  let cursor = new Date(start.getTime());
  while (cursor.getTime() <= yesterday.getTime()) {
    streak = index.get(ymd(cursor)) === true ? streak + 1 : 0;
    if (streak >= def.total) return true;
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return false;
}

// True if `total` qualifying dates fit within any `windowDays`-day span.
function hasSportWindow(
  dates: Date[],
  total: number,
  windowDays: number,
): boolean {
  for (let i = 0; i + total - 1 < dates.length; i++) {
    if (diffDays(dates[i + total - 1], dates[i]) < windowDays) return true;
  }
  return false;
}

// Sport: `total` sessions within any `windowDays`-day span since the start.
// Displayed progress counts today (and shows `total` as soon as a window is
// full, including a session logged today); completion, however, only fires
// once the completing window sits entirely on elapsed days (≤ yesterday).
export function computeSportProgress(
  days: Days[],
  def: ChallengeDef,
  startedAt: Date,
  now: Date = new Date(),
): ChallengeProgress {
  const start = startOfDay(startedAt);
  const today = startOfDay(now);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const windowDays = def.windowDays ?? 7;
  const index = qualifyingDayIndex(days, def, start, today);
  const dates = [...index.entries()]
    .filter(([, ok]) => ok)
    .map(([key]) => startOfDay(new Date(key)))
    .sort((a, b) => a.getTime() - b.getTime());

  const done = hasSportWindow(
    dates.filter((d) => d.getTime() <= yesterday.getTime()),
    def.total,
    windowDays,
  );
  // A full window (counting today) shows `total` even before it's validated.
  const full = done || hasSportWindow(dates, def.total, windowDays);
  if (full) return { prog: def.total, done };

  const trailing = dates.filter((d) => diffDays(today, d) < windowDays).length;
  return { prog: Math.min(trailing, def.total), done: false };
}

export function computeChallengeProgress(
  def: ChallengeDef,
  days: Days[],
  startedAt: Date,
  now: Date = new Date(),
): ChallengeProgress {
  if (def.kind === 'sport') {
    return computeSportProgress(days, def, startedAt, now);
  }
  const run = computeConsecutiveProgress(days, def, startedAt, now);
  const done = hasCompletedConsecutiveRun(
    days,
    def,
    startOfDay(startedAt),
    startOfDay(now),
  );
  return { prog: Math.min(run, def.total), done };
}

export function leftLabel(def: ChallengeDef, prog: number): string {
  const n = Math.max(def.total - prog, 0);
  if (def.kind === 'sport') {
    return `Encore ${n} séance${n > 1 ? 's' : ''}`;
  }
  return `Encore ${n} jour${n > 1 ? 's' : ''}`;
}
