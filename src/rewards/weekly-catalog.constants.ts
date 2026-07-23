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
  | 'weekend'
  | 'parfait' // journée « sans fausse note » : léger + sport + zéro grignotage
  | 'combo' // sport ET dîner léger le même jour
  | 'volume'; // compte des repas légers (pas des jours)

export interface WeeklyChallengeDef {
  // Persisted in weekly_challenges.challenge_id — never rename, only add.
  id: string;
  emoji: string;
  title: string;
  kind: WeeklyKind;
  kindLabel: string;
  // Difficulty on the ELO scale (~1000 easy … ~1900 hard).
  rating: number;
  // Qualifying days needed within the week (weekend: 1 clean weekend ·
  // volume: number of qualifying MEALS, not days).
  total: number;
  // note: minimum per-day score · weekend: minimum score of each weekend day.
  minScore?: number;
  // Critères explicités à l'utilisateur, affichés sous le titre (surtout pour
  // les mécaniques combo comme « journée sans fausse note »).
  description?: string;
}

const KIND_LABELS: Record<WeeklyKind, string> = {
  saisie: 'Saisie',
  'soir-leger': 'Dîner',
  grignotage: 'Grignotage',
  copieux: 'Légèreté',
  sport: 'Sport',
  note: 'Note',
  weekend: 'Week-end',
  parfait: 'Journée parfaite',
  combo: 'Combo',
  volume: 'Volume',
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
  // ─── Journée parfaite (combo : léger + sport + zéro grignotage) ──
  {
    id: 'w-parfait-1',
    emoji: '✨',
    title: 'Une journée sans fausse note',
    kind: 'parfait',
    kindLabel: KIND_LABELS.parfait,
    description:
      'Une journée qui coche tout : tes 3 repas sans excès (aucun copieux), du sport, et le grignotage au minimum.',
    rating: 1350,
    total: 1,
  },
  {
    id: 'w-parfait-3',
    emoji: '✨',
    title: 'Trois journées parfaites',
    kind: 'parfait',
    kindLabel: KIND_LABELS.parfait,
    description:
      'Trois journées qui cochent tout : repas sans excès, sport, grignotage au minimum. Chacune, un sans-faute.',
    rating: 1800,
    total: 3,
  },
  // ─── Combo effort (sport + dîner léger le même jour) ──────
  {
    id: 'w-combo-2',
    emoji: '🏃',
    title: "Le corps et l'assiette, 2 fois",
    kind: 'combo',
    kindLabel: KIND_LABELS.combo,
    description:
      'Du sport ET un dîner léger le même jour — 2 jours cette semaine.',
    rating: 1400,
    total: 2,
  },
  {
    id: 'w-combo-3',
    emoji: '🏃',
    title: "Le corps et l'assiette, 3 fois",
    kind: 'combo',
    kindLabel: KIND_LABELS.combo,
    description:
      'Du sport ET un dîner léger le même jour — 3 jours cette semaine.',
    rating: 1650,
    total: 3,
  },
  // ─── Volume (repas légers, peu importe les jours) ─────────
  {
    id: 'w-volume-5',
    emoji: '🥗',
    title: '5 repas légers cette semaine',
    kind: 'volume',
    kindLabel: KIND_LABELS.volume,
    description:
      'Des repas légers ou très légers — 5 en tout, peu importe la répartition.',
    rating: 1150,
    total: 5,
  },
  {
    id: 'w-volume-10',
    emoji: '🥗',
    title: '10 repas légers cette semaine',
    kind: 'volume',
    kindLabel: KIND_LABELS.volume,
    description:
      'Des repas légers ou très légers — 10 en tout, peu importe la répartition.',
    rating: 1500,
    total: 10,
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

// Titre accordé à l'objectif réellement figé. Le titre canonique du catalogue
// embarque `total` — quand l'objectif est proraté (choix en cours de semaine),
// il faut régénérer un titre cohérent (« 2 dîners légers » alors que la cible
// est 1 = incompréhensible). Un template par kind, accord singulier/pluriel.
export function titleForTarget(
  def: WeeklyChallengeDef,
  target: number,
): string {
  if (target === def.total) return def.title;
  const s = target > 1 ? 's' : '';
  switch (def.kind) {
    case 'saisie':
      return `Saisir tes 3 repas, ${target} jour${s} cette semaine`;
    case 'soir-leger':
      return `${target} dîner${s} léger${s} cette semaine`;
    case 'grignotage':
      return `${target} jour${s} sans grignotage cette semaine`;
    case 'copieux':
      return `${target} jour${s} sans repas lourd cette semaine`;
    case 'sport':
      return `${target} séance${s} de sport cette semaine`;
    case 'note':
      return `Atteindre ${def.minScore}+ sur ${target} jour${s} cette semaine`;
    case 'parfait':
      return target === 1
        ? 'Une journée sans fausse note'
        : `${target} journées parfaites`;
    case 'combo':
      return `Le corps et l'assiette, ${target} fois`;
    case 'volume':
      return `${target} repas léger${s} cette semaine`;
    case 'weekend':
      return def.title; // non prorable — jamais atteint
  }
}

// Même accord pour les descriptions qui citent le compte (combo / volume /
// parfait). Les autres kinds n'ont pas de description chiffrée.
export function descriptionForTarget(
  def: WeeklyChallengeDef,
  target: number,
): string | null {
  if (target === def.total) return def.description ?? null;
  switch (def.kind) {
    case 'combo':
      return `Du sport ET un dîner léger le même jour — ${target} jour${
        target > 1 ? 's' : ''
      } cette semaine.`;
    case 'volume':
      return `Des repas légers ou très légers — ${target} en tout, peu importe la répartition.`;
    case 'parfait':
      return target === 1
        ? 'Une journée qui coche tout : tes 3 repas sans excès (aucun copieux), du sport, et le grignotage au minimum.'
        : `${target} journées qui cochent tout : repas sans excès, sport, grignotage au minimum.`;
    default:
      return def.description ?? null;
  }
}

export type WeeklyFlavor = 'accessible' | 'ambitious';

// Kinds mis en avant par intention d'onboarding — miroir de Intention.kinds
// (iOS) et src/lib/intention.ts (web). Pondère le tirage (Phase 4, ×2).
export const INTENTION_KINDS: Record<string, WeeklyKind[]> = {
  lose: ['soir-leger', 'copieux', 'sport'],
  maintain: ['note', 'weekend', 'saisie'],
  aware: ['saisie', 'weekend'],
  snack: ['grignotage'],
};

// Reward points by flavor — the ambitious offer is worth more. TUNABLE.
export const FLAVOR_POINTS: Record<WeeklyFlavor, number> = {
  accessible: 5,
  ambitious: 10,
};

// Phase 1 static difficulty bands the two offers are drawn from (Phase 4
// replaces this with a per-user ELO bracket). TUNABLE.
export const ACCESSIBLE_BAND: readonly [number, number] = [1000, 1400];
export const AMBITIOUS_BAND: readonly [number, number] = [1450, 1900];
