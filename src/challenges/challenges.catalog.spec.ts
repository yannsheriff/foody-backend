import { Days } from '@prisma/client';
import {
  CHALLENGE_CATALOG,
  LEVELS,
  REQUIRED_PER_LEVEL,
  challengesForLevel,
  kindLabel,
} from './challenges.constants';
import { computeChallengeProgress, leftLabel } from './challenges.progress';

// Audit générique du catalogue : chaque défi doit être réellement complétable
// (un scénario de réussite canonique le valide) et réellement exigeant (le
// même scénario amputé ne le valide pas). Attrape les paramètres impossibles
// (total/fenêtre/minScore incohérents) quand on ajoute des entrées.

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const START = D('2026-01-01'); // jeudi
const FIRST_SATURDAY = D('2026-01-03');
const DAY = 86_400_000;

let nextId = 1;
// Journée « parfaite » qui qualifie pour TOUS les kinds : 3 repas légers
// (dîner léger inclus), snack 0, sport normal → score 10/10.
function perfectDay(date: Date): Days {
  return {
    id: nextId++,
    user_id: 1,
    morning_score: 'leger',
    afternoon_score: 'leger',
    evening_score: 'leger',
    snack: 0,
    sport: true,
    sport_level: 'normal',
    sport_type: null,
    meals_completed_at: null,
    date,
  } as Days;
}

interface Scenario {
  days: Days[];
  now: Date;
}

// Scénario de réussite : pour les kinds jour-par-jour, `total` journées
// parfaites consécutives entièrement écoulées ; pour weekend, `total`
// week-ends parfaits consécutifs. `now` = lendemain du dernier jour.
function successScenario(def: (typeof CHALLENGE_CATALOG)[number]): Scenario {
  if (def.kind === 'weekend') {
    const days: Days[] = [];
    for (let k = 0; k < def.total; k++) {
      const sat = new Date(FIRST_SATURDAY.getTime() + k * 7 * DAY);
      days.push(perfectDay(sat), perfectDay(new Date(sat.getTime() + DAY)));
    }
    const lastSunday = FIRST_SATURDAY.getTime() + (def.total - 1) * 7 * DAY + DAY;
    return { days, now: new Date(lastSunday + DAY) };
  }
  const days = Array.from({ length: def.total }, (_, i) =>
    perfectDay(new Date(START.getTime() + i * DAY)),
  );
  return { days, now: new Date(START.getTime() + def.total * DAY) };
}

// Scénario raté : le même, amputé d'un jour pivot (trou au milieu d'une
// série, dernier dimanche d'un week-end, une séance de sport en moins).
function failureScenario(def: (typeof CHALLENGE_CATALOG)[number]): Scenario {
  const { days, now } = successScenario(def);
  if (def.kind === 'weekend' || def.kind === 'sport') {
    return { days: days.slice(0, -1), now };
  }
  const gap = Math.floor(days.length / 2);
  return { days: days.filter((_, i) => i !== gap), now };
}

describe('catalogue — intégrité', () => {
  it('28 ids uniques, 7 par niveau, quota atteignable', () => {
    expect(CHALLENGE_CATALOG).toHaveLength(28);
    expect(new Set(CHALLENGE_CATALOG.map((c) => c.id)).size).toBe(28);
    for (const lvl of LEVELS) {
      const defs = challengesForLevel(lvl.n);
      expect(defs).toHaveLength(7);
      expect(defs.length).toBeGreaterThanOrEqual(REQUIRED_PER_LEVEL);
    }
  });

  it.each(CHALLENGE_CATALOG.map((c) => [c.id, c] as const))(
    '%s — libellé, goal et paramètres cohérents',
    (_id, def) => {
      expect(def.kindLabel).toBe(kindLabel(def.kind));
      expect(def.goal).toContain(String(def.total));
      expect(def.total).toBeGreaterThan(0);
      if (def.kind === 'note') expect(def.minScore).toBeGreaterThan(0);
      if (def.kind === 'sport') expect(def.windowDays).toBeGreaterThanOrEqual(7);
      if (def.windowDays) {
        // La fenêtre doit pouvoir contenir le total (séances quotidiennes /
        // week-ends hebdomadaires).
        const spanNeeded =
          def.kind === 'weekend' ? (def.total - 1) * 7 + 1 : def.total;
        expect(def.windowDays).toBeGreaterThanOrEqual(spanNeeded);
      }
    },
  );
});

describe('catalogue — chaque défi est complétable (et pas gratuit)', () => {
  it.each(CHALLENGE_CATALOG.map((c) => [c.id, c] as const))(
    '%s se valide sur le scénario canonique',
    (_id, def) => {
      const { days, now } = successScenario(def);
      const { prog, done } = computeChallengeProgress(def, days, START, now);
      expect(done).toBe(true);
      expect(prog).toBe(def.total);
    },
  );

  it.each(CHALLENGE_CATALOG.map((c) => [c.id, c] as const))(
    '%s ne se valide pas sur le scénario amputé',
    (_id, def) => {
      const { days, now } = failureScenario(def);
      const { done } = computeChallengeProgress(def, days, START, now);
      expect(done).toBe(false);
    },
  );

  it.each(CHALLENGE_CATALOG.map((c) => [c.id, c] as const))(
    '%s — leftLabel formule un reste plausible',
    (_id, def) => {
      const label = leftLabel(def, def.total - 1);
      expect(label).toMatch(/^Encore 1 (jour|soir|séance|week-end)$/);
      expect(leftLabel(def, def.total)).toMatch(/^Encore 0/);
    },
  );
});
