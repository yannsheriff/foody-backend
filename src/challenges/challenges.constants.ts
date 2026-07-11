export type ChallengeKind =
  | 'saisie'
  | 'copieux'
  | 'grignotage'
  | 'note'
  | 'sport'
  | 'soir-leger'
  | 'weekend';

// Un niveau se valide en relevant N défis parmi ceux proposés — le reste du
// catalogue du niveau reste disponible en bonus après déblocage.
export const REQUIRED_PER_LEVEL = 4;

export interface ChallengeDef {
  // Persisted in user_challenges.challenge_id — never rename, only add.
  id: string;
  level: 1 | 2 | 3 | 4;
  emoji: string;
  title: string;
  kind: ChallengeKind;
  kindLabel: string;
  goal: string;
  total: number;
  // note: minimum per-day score required · weekend: minimum score of each
  // weekend day (default 6.5)
  minScore?: number;
  // sport: rolling window (in days) in which `total` sessions must fit ·
  // weekend: window in which `total` qualifying weekends must fit
  windowDays?: number;
}

export interface LevelDef {
  n: 1 | 2 | 3 | 4;
  emoji: string;
  short: string;
  title: string;
  tagline: string;
}

export const LEVELS: LevelDef[] = [
  {
    n: 1,
    emoji: '🌱',
    short: 'Débutant',
    title: 'Débutant',
    tagline: 'Je commence à faire attention à ce que je mange',
  },
  {
    n: 2,
    emoji: '🌿',
    short: 'Régulier',
    title: 'On passe à la vitesse supérieure',
    tagline: 'Les bonnes habitudes commencent à rentrer',
  },
  {
    n: 3,
    emoji: '🌳',
    short: 'Confirmé',
    title: 'J’ai de la bouteille',
    tagline: 'On vise la régularité sur la durée',
  },
  {
    n: 4,
    emoji: '🏆',
    short: 'Boss',
    title: 'Je suis un boss',
    tagline: 'Le mode expert, rien que ça',
  },
];

const KIND_LABELS: Record<ChallengeKind, string> = {
  saisie: 'Saisie',
  copieux: 'Copieux',
  grignotage: 'Grignotage',
  note: 'Note',
  sport: 'Sport',
  'soir-leger': 'Dîner',
  weekend: 'Week-end',
};

export function kindLabel(kind: ChallengeKind): string {
  return KIND_LABELS[kind];
}

export const CHALLENGE_CATALOG: ChallengeDef[] = [
  // ─── Niveau 1 · Débutant ───────────────────────────────────
  {
    id: 'saisie-3',
    level: 1,
    emoji: '🍽️',
    title: 'Saisir mes repas 3 jours d’affilée',
    kind: 'saisie',
    kindLabel: KIND_LABELS.saisie,
    goal: '3 jours',
    total: 3,
  },
  {
    id: 'grignotage-3',
    level: 1,
    emoji: '🍫',
    title: '3 jours sans grignotage',
    kind: 'grignotage',
    kindLabel: KIND_LABELS.grignotage,
    goal: '3 jours',
    total: 3,
  },
  {
    id: 'note-6-3',
    level: 1,
    emoji: '⭐',
    title: 'Tenir 6+ pendant 3 jours',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    goal: '3 jours',
    total: 3,
    minScore: 6,
  },
  {
    id: 'sport-2-semaine',
    level: 1,
    emoji: '🏃',
    title: 'Bouger 2 fois dans la semaine',
    kind: 'sport',
    kindLabel: KIND_LABELS.sport,
    goal: '2 séances',
    total: 2,
    windowDays: 7,
  },
  {
    id: 'soir-leger-3',
    level: 1,
    emoji: '🌙',
    title: '3 dîners légers d’affilée',
    kind: 'soir-leger',
    kindLabel: KIND_LABELS['soir-leger'],
    goal: '3 soirs',
    total: 3,
  },
  {
    id: 'saisie-5',
    level: 1,
    emoji: '🍽️',
    title: 'Saisir mes repas 5 jours d’affilée',
    kind: 'saisie',
    kindLabel: KIND_LABELS.saisie,
    goal: '5 jours',
    total: 5,
  },
  {
    id: 'weekend-1',
    level: 1,
    emoji: '🌤️',
    title: 'Un week-end sans écart',
    kind: 'weekend',
    kindLabel: KIND_LABELS.weekend,
    goal: '1 week-end',
    total: 1,
    minScore: 6.5,
  },
  // ─── Niveau 2 · On passe à la vitesse supérieure ───────────
  {
    id: 'note-7-5',
    level: 2,
    emoji: '⭐',
    title: 'Tenir 7+ pendant 5 jours',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    goal: '5 jours',
    total: 5,
    minScore: 7,
  },
  {
    id: 'saisie-7',
    level: 2,
    emoji: '🍽️',
    title: 'Saisir mes repas 7 jours d’affilée',
    kind: 'saisie',
    kindLabel: KIND_LABELS.saisie,
    goal: '7 jours',
    total: 7,
  },
  {
    id: 'copieux-5',
    level: 2,
    emoji: '🥗',
    title: '5 jours sans repas copieux',
    kind: 'copieux',
    kindLabel: KIND_LABELS.copieux,
    goal: '5 jours',
    total: 5,
  },
  {
    id: 'sport-3-semaine',
    level: 2,
    emoji: '🏃',
    title: '3 séances de sport en une semaine',
    kind: 'sport',
    kindLabel: KIND_LABELS.sport,
    goal: '3 séances',
    total: 3,
    windowDays: 7,
  },
  {
    id: 'soir-leger-5',
    level: 2,
    emoji: '🌙',
    title: '5 dîners légers d’affilée',
    kind: 'soir-leger',
    kindLabel: KIND_LABELS['soir-leger'],
    goal: '5 soirs',
    total: 5,
  },
  {
    id: 'grignotage-5',
    level: 2,
    emoji: '🍫',
    title: '5 jours sans grignotage',
    kind: 'grignotage',
    kindLabel: KIND_LABELS.grignotage,
    goal: '5 jours',
    total: 5,
  },
  {
    id: 'sport-4-semaine',
    level: 2,
    emoji: '🏃',
    title: '4 séances de sport en une semaine',
    kind: 'sport',
    kindLabel: KIND_LABELS.sport,
    goal: '4 séances',
    total: 4,
    windowDays: 7,
  },
  // ─── Niveau 3 · J’ai de la bouteille ───────────────────────
  {
    id: 'saisie-14',
    level: 3,
    emoji: '🍽️',
    title: '14 jours de saisie sans rater',
    kind: 'saisie',
    kindLabel: KIND_LABELS.saisie,
    goal: '14 jours',
    total: 14,
  },
  {
    id: 'copieux-10',
    level: 3,
    emoji: '🥗',
    title: '10 jours sans repas copieux',
    kind: 'copieux',
    kindLabel: KIND_LABELS.copieux,
    goal: '10 jours',
    total: 10,
  },
  {
    id: 'note-75-10',
    level: 3,
    emoji: '⭐',
    title: 'Tenir 7,5+ pendant 10 jours',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    goal: '10 jours',
    total: 10,
    minScore: 7.5,
  },
  {
    id: 'sport-8-mois',
    level: 3,
    emoji: '🏃',
    title: '8 séances de sport dans le mois',
    kind: 'sport',
    kindLabel: KIND_LABELS.sport,
    goal: '8 séances',
    total: 8,
    windowDays: 30,
  },
  {
    id: 'soir-leger-7',
    level: 3,
    emoji: '🌙',
    title: 'Une semaine de dîners légers',
    kind: 'soir-leger',
    kindLabel: KIND_LABELS['soir-leger'],
    goal: '7 soirs',
    total: 7,
  },
  {
    id: 'grignotage-7',
    level: 3,
    emoji: '🍫',
    title: '7 jours sans grignotage',
    kind: 'grignotage',
    kindLabel: KIND_LABELS.grignotage,
    goal: '7 jours',
    total: 7,
  },
  {
    id: 'weekend-3-mois',
    level: 3,
    emoji: '🌤️',
    title: '3 week-ends propres dans le mois',
    kind: 'weekend',
    kindLabel: KIND_LABELS.weekend,
    goal: '3 week-ends',
    total: 3,
    windowDays: 30,
    minScore: 6.5,
  },
  // ─── Niveau 4 · Je suis un boss ────────────────────────────
  {
    id: 'saisie-30',
    level: 4,
    emoji: '🍽️',
    title: '30 jours de saisie sans rater',
    kind: 'saisie',
    kindLabel: KIND_LABELS.saisie,
    goal: '30 jours',
    total: 30,
  },
  {
    id: 'copieux-30',
    level: 4,
    emoji: '🥗',
    title: 'Un mois entier sans excès',
    kind: 'copieux',
    kindLabel: KIND_LABELS.copieux,
    goal: '30 jours',
    total: 30,
  },
  {
    id: 'note-8-30',
    level: 4,
    emoji: '⭐',
    title: 'Tenir 8+ pendant 30 jours',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    goal: '30 jours',
    total: 30,
    minScore: 8,
  },
  {
    id: 'sport-15-mois',
    level: 4,
    emoji: '🏃',
    title: '15 séances de sport dans le mois',
    kind: 'sport',
    kindLabel: KIND_LABELS.sport,
    goal: '15 séances',
    total: 15,
    windowDays: 30,
  },
  {
    id: 'grignotage-14',
    level: 4,
    emoji: '🍫',
    title: '14 jours sans grignotage',
    kind: 'grignotage',
    kindLabel: KIND_LABELS.grignotage,
    goal: '14 jours',
    total: 14,
  },
  {
    id: 'note-7-14',
    level: 4,
    emoji: '⭐',
    title: 'Tenir 7+ pendant 14 jours',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    goal: '14 jours',
    total: 14,
    minScore: 7,
  },
  {
    id: 'weekend-4-mois',
    level: 4,
    emoji: '🌤️',
    title: 'Un mois de week-ends sans écart',
    kind: 'weekend',
    kindLabel: KIND_LABELS.weekend,
    goal: '4 week-ends',
    total: 4,
    windowDays: 30,
    minScore: 6.5,
  },
];

export function challengeById(id: string): ChallengeDef | undefined {
  return CHALLENGE_CATALOG.find((c) => c.id === id);
}

export function challengesForLevel(n: number): ChallengeDef[] {
  return CHALLENGE_CATALOG.filter((c) => c.level === n);
}
