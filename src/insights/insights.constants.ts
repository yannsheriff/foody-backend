import { Days, Score } from '@prisma/client';
import {
  computeDayScore,
  countsForStreak,
  isDayFullyTracked,
} from './insights.scoring';

export interface ChallengeDefinition {
  id: string;
  title: string;
  type: 'weekly' | 'monthly';
  typeLabel: string;
  icon: string;
  total: number;
  subtitle?: string;
  // Returns progress count for the day window (week=Mon→Sun, month=current month)
  progress: (days: Days[]) => number;
  // Free-form "X jours / séances restantes"
  leftLabel: (progress: number, total: number) => string;
}

const HEAVY: Score[] = ['copieux', 'tresCopieux'];

export const CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'no-heavy-5',
    title: '5 jours sans repas copieux',
    type: 'weekly',
    typeLabel: 'Hebdomadaire',
    icon: '🥗',
    total: 5,
    progress: (days) =>
      days.filter((d) => {
        if (!isDayFullyTracked(d)) return false;
        return ![d.morning_score, d.afternoon_score, d.evening_score].some(
          (s) => s && HEAVY.includes(s),
        );
      }).length,
    leftLabel: (p, t) => (p >= t ? 'Défi terminé' : `Encore ${t - p} jours`),
  },
  {
    id: 'sport-15',
    title: '15 séances de sport',
    type: 'monthly',
    typeLabel: 'Mensuel',
    icon: '🏃',
    total: 15,
    progress: (days) => days.filter((d) => d.sport).length,
    leftLabel: (p, t) => (p >= t ? 'Défi terminé' : `Encore ${t - p} séances`),
  },
  {
    id: 'light-7',
    title: '7 jours sous 6/10 max',
    type: 'weekly',
    typeLabel: 'Hebdomadaire',
    icon: '🌱',
    total: 7,
    subtitle: 'Score moyen 6+ pendant 7 jours',
    progress: (days) =>
      days.filter((d) => isDayFullyTracked(d) && computeDayScore(d) >= 6)
        .length,
    leftLabel: (p, t) => (p >= t ? 'Défi terminé' : `Encore ${t - p} jours`),
  },
];

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
    unlock: (all) => countConsecutiveStreak(all, (d) => !hasHeavy(d)) >= 7,
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
    unlock: (all) => all.filter((d) => d.sport).length >= 20,
  },
  {
    id: 'no-snack',
    title: 'Sans grignoter',
    emoji: '🍪',
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

function hasHeavy(d: Days): boolean {
  return [d.morning_score, d.afternoon_score, d.evening_score].some(
    (s) => s && HEAVY.includes(s),
  );
}

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
