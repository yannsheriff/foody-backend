// Weekly challenge catalog. Every challenge is "reach N qualifying days within
// the Monday→Sunday week" (or a single clean weekend) — no consecutive streaks,
// no sliding windows. Difficulty comes from the metric, the count and the
// threshold, captured by `rating` (ELO scale, used in Phase 4; Phase 1 draws
// from static bands). `id` is persisted in weekly_challenges — never rename.

export type WeeklyKind =
  | 'saisie'
  | 'soir-leger'
  | 'grignotage'
  | 'copieux'
  | 'sport'
  | 'note'
  | 'weekend';

export interface WeeklyChallengeDef {
  // Persisted in weekly_challenges.challenge_id — never rename, only add.
  id: string;
  emoji: string;
  title: string;
  kind: WeeklyKind;
  kindLabel: string;
  // Difficulty on the ELO scale (~1000 easy … ~1900 hard).
  rating: number;
  // Qualifying days needed within the week (weekend: 1 clean weekend).
  total: number;
  // note: minimum per-day score · weekend: minimum score of each weekend day.
  minScore?: number;
}

const KIND_LABELS: Record<WeeklyKind, string> = {
  saisie: 'Saisie',
  'soir-leger': 'Dîner',
  grignotage: 'Grignotage',
  copieux: 'Légèreté',
  sport: 'Sport',
  note: 'Note',
  weekend: 'Week-end',
};

export function kindLabel(kind: WeeklyKind): string {
  return KIND_LABELS[kind];
}

export const WEEKLY_CATALOG: WeeklyChallengeDef[] = [
  // ─── Saisie · assiduité de saisie ──────────────────────────
  {
    id: 'w-saisie-3',
    emoji: '🍽️',
    title: 'Saisir tes 3 repas, 3 jours cette semaine',
    kind: 'saisie',
    kindLabel: KIND_LABELS.saisie,
    rating: 1000,
    total: 3,
  },
  {
    id: 'w-saisie-5',
    emoji: '🍽️',
    title: 'Saisir tes 3 repas, 5 jours cette semaine',
    kind: 'saisie',
    kindLabel: KIND_LABELS.saisie,
    rating: 1200,
    total: 5,
  },
  {
    id: 'w-saisie-7',
    emoji: '🍽️',
    title: 'Saisir tes 3 repas les 7 jours de la semaine',
    kind: 'saisie',
    kindLabel: KIND_LABELS.saisie,
    rating: 1500,
    total: 7,
  },
  // ─── Dîner · légèreté du soir ──────────────────────────────
  {
    id: 'w-soir-2',
    emoji: '🌙',
    title: '2 dîners légers cette semaine',
    kind: 'soir-leger',
    kindLabel: KIND_LABELS['soir-leger'],
    rating: 1150,
    total: 2,
  },
  {
    id: 'w-soir-3',
    emoji: '🌙',
    title: '3 dîners légers cette semaine',
    kind: 'soir-leger',
    kindLabel: KIND_LABELS['soir-leger'],
    rating: 1350,
    total: 3,
  },
  {
    id: 'w-soir-5',
    emoji: '🌙',
    title: '5 dîners légers cette semaine',
    kind: 'soir-leger',
    kindLabel: KIND_LABELS['soir-leger'],
    rating: 1650,
    total: 5,
  },
  // ─── Grignotage · tenir le grignotage ──────────────────────
  {
    id: 'w-grignotage-3',
    emoji: '🍫',
    title: '3 jours sans grignotage cette semaine',
    kind: 'grignotage',
    kindLabel: KIND_LABELS.grignotage,
    rating: 1100,
    total: 3,
  },
  {
    id: 'w-grignotage-5',
    emoji: '🍫',
    title: '5 jours sans grignotage cette semaine',
    kind: 'grignotage',
    kindLabel: KIND_LABELS.grignotage,
    rating: 1400,
    total: 5,
  },
  {
    id: 'w-grignotage-6',
    emoji: '🍫',
    title: '6 jours sans grignotage cette semaine',
    kind: 'grignotage',
    kindLabel: KIND_LABELS.grignotage,
    rating: 1650,
    total: 6,
  },
  // ─── Légèreté · pas d'excès ────────────────────────────────
  {
    id: 'w-copieux-3',
    emoji: '🥗',
    title: '3 jours sans repas lourd cette semaine',
    kind: 'copieux',
    kindLabel: KIND_LABELS.copieux,
    rating: 1250,
    total: 3,
  },
  {
    id: 'w-copieux-5',
    emoji: '🥗',
    title: '5 jours sans repas lourd cette semaine',
    kind: 'copieux',
    kindLabel: KIND_LABELS.copieux,
    rating: 1550,
    total: 5,
  },
  // ─── Sport · bouger ────────────────────────────────────────
  {
    id: 'w-sport-2',
    emoji: '🏃',
    title: '2 séances de sport cette semaine',
    kind: 'sport',
    kindLabel: KIND_LABELS.sport,
    rating: 1300,
    total: 2,
  },
  {
    id: 'w-sport-3',
    emoji: '🏃',
    title: '3 séances de sport cette semaine',
    kind: 'sport',
    kindLabel: KIND_LABELS.sport,
    rating: 1550,
    total: 3,
  },
  {
    id: 'w-sport-4',
    emoji: '🏃',
    title: '4 séances de sport cette semaine',
    kind: 'sport',
    kindLabel: KIND_LABELS.sport,
    rating: 1800,
    total: 4,
  },
  // ─── Note · tenir la note ──────────────────────────────────
  {
    id: 'w-note-7-3',
    emoji: '⭐',
    title: 'Atteindre 7+ sur 3 jours cette semaine',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    rating: 1350,
    total: 3,
    minScore: 7,
  },
  {
    id: 'w-note-7-5',
    emoji: '⭐',
    title: 'Atteindre 7+ sur 5 jours cette semaine',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    rating: 1650,
    total: 5,
    minScore: 7,
  },
  {
    id: 'w-note-8-3',
    emoji: '⭐',
    title: 'Atteindre 8+ sur 3 jours cette semaine',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    rating: 1600,
    total: 3,
    minScore: 8,
  },
  {
    id: 'w-note-8-5',
    emoji: '⭐',
    title: 'Atteindre 8+ sur 5 jours cette semaine',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    rating: 1900,
    total: 5,
    minScore: 8,
  },
  // ─── Note · un pic (journée parfaite) ──────────────────────
  {
    id: 'w-parfait-9',
    emoji: '✨',
    title: 'Une journée à 9+ cette semaine',
    kind: 'note',
    kindLabel: KIND_LABELS.note,
    rating: 1450,
    total: 1,
    minScore: 9,
  },
  // ─── Week-end · un week-end propre (non prorable) ──────────
  {
    id: 'w-weekend-clean',
    emoji: '🌤️',
    title: 'Un week-end sans écart',
    kind: 'weekend',
    kindLabel: KIND_LABELS.weekend,
    rating: 1500,
    total: 1,
    minScore: 6.5,
  },
];

export function weeklyById(id: string): WeeklyChallengeDef | undefined {
  return WEEKLY_CATALOG.find((c) => c.id === id);
}

export type WeeklyFlavor = 'accessible' | 'ambitious';

// Reward points by flavor — the ambitious offer is worth more. TUNABLE.
export const FLAVOR_POINTS: Record<WeeklyFlavor, number> = {
  accessible: 5,
  ambitious: 10,
};

// Phase 1 static difficulty bands the two offers are drawn from (Phase 4
// replaces this with a per-user ELO bracket). TUNABLE.
export const ACCESSIBLE_BAND: readonly [number, number] = [1000, 1400];
export const AMBITIOUS_BAND: readonly [number, number] = [1450, 1900];
