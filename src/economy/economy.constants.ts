// Économie Phase 3 — barème (TUNABLE, cf. REFONTE-DEFIS-SUIVI.md § Décisions Phase 3).
// Cible : ~3-4 objets/mois pour un joueur régulier (~100 🪙/mois). Cheat ~/8 j,
// gel ~/3 sem → le gel vaut ~2,6× le cheat meal.

export const COIN_GAINS = {
  challengeAccessible: 15,
  challengeAmbitious: 25,
  monthlyBadge: 25,
  flameMilestone: 15,
  welcome: 30, // one-shot, pactole de bienvenue (aussi aux anciens)
} as const;

export const SHOP_PRICES = {
  cheatMeal: 25,
  freeze: 70,
} as const;

// Un seul gel en réserve à la fois.
export const MAX_FREEZE_STOCK = 1;

// Paliers de flamme qui créditent des pièces — miroir de useStreakMilestone (web)
// et MilestoneStore (iOS). Chaque palier franchi (d'après le record) = +15 🪙.
export const FLAME_MILESTONES = [7, 14, 21, 30, 60, 100, 200, 365];
