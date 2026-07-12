import { Days } from '@prisma/client';
import {
  computeDayScore,
  countsForStreak,
  hasHeavyMeal,
  isDayFullyTracked,
} from './insights.scoring';

// Catalogue data-driven : chaque badge = un prédicat jour + un objectif.
// `kind` décide de la lecture : 'count' = nombre de jours qualifiants,
// 'streak' = plus longue suite de jours calendaires consécutifs qualifiants.
// unlock / progress / unlockedAt en sont dérivés génériquement.
interface BadgeSpec {
  id: string;
  title: string;
  emoji: string;
  /** « Comment l'obtenir » — voix maison, affichée dans le détail. */
  description: string;
  total: number;
  kind: 'count' | 'streak';
  qualifies: (d: Days) => boolean;
}

export interface BadgeDefinition extends BadgeSpec {
  unlock: (all: Days[]) => boolean;
  /** Avancement borné à total (jours qualifiants ou meilleure série). */
  progress: (all: Days[]) => number;
  /** Premier jour où l'objectif a été atteint — null si pas (encore) débloqué. */
  unlockedAt: (all: Days[]) => Date | null;
}

const SPECS: BadgeSpec[] = [
  {
    id: 'sobriete',
    title: 'Sobriété',
    emoji: '🌿',
    description: '7 jours d’affilée sans un repas copieux.',
    total: 7,
    kind: 'streak',
    qualifies: (d) => !hasHeavyMeal(d),
  },
  {
    id: 'constance',
    title: 'Constance',
    emoji: '🔥',
    description: 'Une flamme de 7 jours — trois repas notés, dans les temps.',
    total: 7,
    kind: 'streak',
    qualifies: (d) => countsForStreak(d),
  },
  {
    id: 'first-month',
    title: 'Premier mois',
    emoji: '🌱',
    description: '30 journées entièrement remplies.',
    total: 30,
    kind: 'count',
    qualifies: isDayFullyTracked,
  },
  {
    id: 'leger-7',
    title: 'Léger 7j',
    emoji: '🥗',
    description: '7 jours d’affilée à 7/10 ou mieux.',
    total: 7,
    kind: 'streak',
    qualifies: (d) => countsForStreak(d) && computeDayScore(d) >= 7,
  },
  {
    id: 'aurore',
    title: 'Aurore',
    emoji: '☀️',
    description: '10 matins légers ou très légers.',
    total: 10,
    kind: 'count',
    qualifies: (d) =>
      d.morning_score === 'tresLeger' || d.morning_score === 'leger',
  },
  {
    id: 'sport-20',
    title: '20 sport',
    emoji: '🏃',
    description: '20 jours de sport notés.',
    total: 20,
    kind: 'count',
    qualifies: (d) => d.sport_level === 'normal' || d.sport_level === 'intense',
  },
  {
    id: 'no-snack',
    title: 'Sans grignoter',
    emoji: '🍪',
    // 0.15 mirrors SNACK_THRESHOLD in challenges/challenges.progress.ts —
    // if one moves, move the other.
    description: '10 journées à zéro grignotage (ou presque).',
    total: 10,
    kind: 'count',
    qualifies: (d) => d.snack != null && d.snack < 0.15,
  },
  {
    id: 'fifty-days',
    title: '50 jours',
    emoji: '✨',
    description: '50 journées entièrement remplies — c’est une habitude.',
    total: 50,
    kind: 'count',
    qualifies: isDayFullyTracked,
  },
];

export const BADGES: BadgeDefinition[] = SPECS.map((spec) => ({
  ...spec,
  progress: (all) => Math.min(spec.total, rawProgress(spec, all)),
  unlock: (all) => rawProgress(spec, all) >= spec.total,
  unlockedAt: (all) => unlockDate(spec, all),
}));

function rawProgress(spec: BadgeSpec, all: Days[]): number {
  if (spec.kind === 'count') return all.filter(spec.qualifies).length;
  return maxStreak(all, spec.qualifies);
}

/** Plus longue suite de jours calendaires consécutifs vérifiant le prédicat. */
function maxStreak(all: Days[], predicate: (d: Days) => boolean): number {
  const sorted = sortedAsc(all);
  let max = 0;
  let current = 0;
  let prevTime: number | null = null;
  for (const d of sorted) {
    const t = new Date(d.date).setHours(0, 0, 0, 0);
    if (prevTime != null && t - prevTime !== 86_400_000) current = 0;
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

/** Rejoue l'historique en ordre chronologique : premier jour où l'objectif tombe. */
function unlockDate(spec: BadgeSpec, all: Days[]): Date | null {
  const sorted = sortedAsc(all);
  if (spec.kind === 'count') {
    let n = 0;
    for (const d of sorted) {
      if (spec.qualifies(d) && ++n === spec.total) return new Date(d.date);
    }
    return null;
  }
  let run = 0;
  let prevTime: number | null = null;
  for (const d of sorted) {
    const t = new Date(d.date).setHours(0, 0, 0, 0);
    if (prevTime != null && t - prevTime !== 86_400_000) run = 0;
    run = spec.qualifies(d) ? run + 1 : 0;
    if (run === spec.total) return new Date(d.date);
    prevTime = t;
  }
  return null;
}

function sortedAsc(all: Days[]): Days[] {
  return [...all].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}
