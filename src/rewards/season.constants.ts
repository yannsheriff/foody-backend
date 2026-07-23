import { WeeklyKind } from './weekly-catalog.constants';

// One thematic season per calendar month. It (a) names the collectible monthly
// badge and (b) — from Phase 4 — biases which families the two weekly offers are
// drawn from (`boostedKinds`). Names/emojis are canonical (from the design).
export interface Season {
  month: number; // 1..12
  title: string; // badge name
  emoji: string;
  description: string; // house-voice « comment l'obtenir »
  boostedKinds: WeeklyKind[]; // pool weighting (used from Phase 4)
}

export const SEASONS: Season[] = [
  {
    month: 1,
    title: 'Reprise',
    emoji: '🌱',
    description:
      'Le badge de janvier. On repart en douceur — de la régularité, sans forcer.',
    boostedKinds: ['saisie', 'note'],
  },
  {
    month: 2,
    title: 'Clair de lune',
    emoji: '🌙',
    description: 'Le badge de février. Des soirs légers, une note qui tient.',
    boostedKinds: ['soir-leger'],
  },
  {
    month: 3,
    title: 'En mouvement',
    emoji: '🏃',
    description: 'Le badge de mars. On se remet à bouger.',
    boostedKinds: ['sport'],
  },
  {
    month: 4,
    title: 'Éclosion',
    emoji: '🌸',
    description: 'Le badge d’avril. La forme repart — vise haut.',
    boostedKinds: ['note', 'saisie'],
  },
  {
    month: 5,
    title: 'Verdure',
    emoji: '🍃',
    description: 'Le badge de mai. Des week-ends propres, du léger.',
    boostedKinds: ['weekend', 'copieux'],
  },
  {
    month: 6,
    title: 'Plein été',
    emoji: '☀️',
    description: 'Le badge de juin. On bouge, on garde le cap.',
    boostedKinds: ['sport', 'soir-leger'],
  },
  {
    month: 7,
    title: 'À l’ombre des tilleuls',
    emoji: '🌳',
    description: 'Le badge de juillet. Tenir le cap sous la chaleur.',
    boostedKinds: ['soir-leger', 'grignotage'],
  },
  {
    month: 8,
    title: 'Plein soleil',
    emoji: '🌻',
    description: 'Le badge d’août. La belle saison, sans relâcher.',
    boostedKinds: ['sport', 'note'],
  },
  {
    month: 9,
    title: 'Vendanges',
    emoji: '🍇',
    description:
      'Le badge de septembre. On récolte ce qu’on a semé — reste léger.',
    boostedKinds: ['copieux', 'saisie'],
  },
  {
    month: 10,
    title: 'Feuilles mortes',
    emoji: '🍂',
    description: 'Le badge d’octobre. La routine s’installe, on ne lâche rien.',
    boostedKinds: ['saisie', 'note'],
  },
  {
    month: 11,
    title: 'Veillée',
    emoji: '🌰',
    description:
      'Le badge de novembre. Les soirées rallongent — tiens le grignotage.',
    boostedKinds: ['grignotage', 'soir-leger'],
  },
  {
    month: 12,
    title: 'Premières neiges',
    emoji: '❄️',
    description: 'Le badge de décembre. Traverser les fêtes sans dérailler.',
    boostedKinds: ['note', 'copieux'],
  },
];

export function seasonForMonth(month: number): Season {
  const s = SEASONS.find((x) => x.month === month);
  if (!s) throw new Error(`No season for month ${month}`);
  return s;
}

// Badge id for a given calendar month, e.g. `season-2026-07`. Encodes the year
// so each July is its own collectible (a missed month is lost forever).
export function badgeIdFor(year: number, month: number): string {
  return `season-${year}-${String(month).padStart(2, '0')}`;
}

// The monthly badge feature launched here — months before this never existed as
// earnable badges, so the collection never shows them (pas de « raté » factice
// pour janvier-juin 2026). TUNABLE.
export const BADGE_FEATURE_LAUNCH = { year: 2026, month: 7 } as const;
