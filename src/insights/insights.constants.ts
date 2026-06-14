import { Days } from '@prisma/client';
import {
  computeDayScore,
  countsForStreak,
  hasHeavyMeal,
  isDayFullyTracked,
} from './insights.scoring';

export interface BadgeDefinition {
  id: string;
  title: string;
  emoji: string;
  unlock: (all: Days[]) => boolean;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: 'sobriete',
    title: 'Sobriété',
    emoji: '🌿',
    unlock: (all) => countConsecutiveStreak(all, (d) => !hasHeavyMeal(d)) >= 7,
  },
  {
    id: 'constance',
    title: 'Constance',
    emoji: '🔥',
    unlock: (all) => longestStreak(all) >= 7,
  },
  {
    id: 'first-month',
    title: 'Premier mois',
    emoji: '🌱',
    unlock: (all) => all.filter(isDayFullyTracked).length >= 30,
  },
  {
    id: 'leger-7',
    title: 'Léger 7j',
    emoji: '🥗',
    unlock: (all) =>
      countConsecutiveStreak(
        all,
        (d) => countsForStreak(d) && computeDayScore(d) >= 7,
      ) >= 7,
  },
  {
    id: 'aurore',
    title: 'Aurore',
    emoji: '☀️',
    unlock: (all) =>
      all.filter(
        (d) => d.morning_score === 'tresLeger' || d.morning_score === 'leger',
      ).length >= 10,
  },
  {
    id: 'sport-20',
    title: '20 sport',
    emoji: '🏃',
    unlock: (all) =>
      all.filter(
        (d) => d.sport_level === 'normal' || d.sport_level === 'intense',
      ).length >= 20,
  },
  {
    id: 'no-snack',
    title: 'Sans grignoter',
    emoji: '🍪',
    // 0.15 mirrors SNACK_THRESHOLD in challenges/challenges.progress.ts —
    // if one moves, move the other.
    unlock: (all) =>
      all.filter((d) => d.snack != null && d.snack < 0.15).length >= 10,
  },
  {
    id: 'fifty-days',
    title: '50 jours',
    emoji: '✨',
    unlock: (all) => all.filter(isDayFullyTracked).length >= 50,
  },
];

function countConsecutiveStreak(
  all: Days[],
  predicate: (d: Days) => boolean,
): number {
  // Walk back from most recent day matching predicate
  const sorted = [...all].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  let max = 0;
  let current = 0;
  let prevTime: number | null = null;
  for (const d of sorted) {
    const t = new Date(d.date).setHours(0, 0, 0, 0);
    if (prevTime != null && prevTime - t !== 86_400_000) {
      current = 0;
    }
    if (predicate(d)) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
    prevTime = t;
  }
  return max;
}

function longestStreak(all: Days[]): number {
  // Streak badges follow the flame rule: late-backfilled days don't count.
  return countConsecutiveStreak(all, countsForStreak);
}
