import { Days } from '@prisma/client';
import {
  WEEKLY_CATALOG,
  WeeklyChallengeDef,
  weeklyById,
} from './weekly-catalog.constants';
import { resolveWeekly, weekBounds } from './weekly.progress';

const WEEK = weekBounds(new Date(Date.UTC(2026, 6, 22)));
let nextId = 1;

function baseDay(date: Date): Days {
  return {
    id: nextId++,
    user_id: 1,
    morning_score: 'leger',
    afternoon_score: 'normal',
    evening_score: 'leger',
    snack: 0,
    sport: false,
    sport_level: null,
    sport_type: null,
    meals_completed_at: null,
    date,
  } as Days;
}

// A day crafted to qualify for `def`.
function qualifyingDay(def: WeeklyChallengeDef, date: Date): Days {
  const d = baseDay(date);
  switch (def.kind) {
    case 'sport':
      d.sport_level = 'intense';
      break;
    case 'note':
      // tresLeger×3 + intense + no snack → 10/10, clears any minScore
      d.morning_score = 'tresLeger';
      d.afternoon_score = 'tresLeger';
      d.evening_score = 'tresLeger';
      d.sport_level = 'intense';
      break;
    case 'soir-leger':
      d.evening_score = 'leger';
      break;
    case 'parfait':
    case 'combo':
      // parfait : base (leger/normal/leger, snack 0) + sport ; combo : sport + dîner léger (base)
      d.sport_level = 'intense';
      break;
    case 'volume':
      d.morning_score = 'leger';
      d.afternoon_score = 'leger';
      d.evening_score = 'leger';
      break;
    // saisie / copieux / grignotage / weekend qualify with the base day
  }
  return d;
}

describe('WEEKLY_CATALOG · integrity', () => {
  it('has unique ids', () => {
    const ids = WEEKLY_CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has coherent params', () => {
    for (const c of WEEKLY_CATALOG) {
      expect(c.total).toBeGreaterThanOrEqual(1);
      expect(c.rating).toBeGreaterThanOrEqual(900);
      expect(c.rating).toBeLessThanOrEqual(2000);
      expect(c.kindLabel.length).toBeGreaterThan(0);
      // minScore only where it makes sense
      if (c.minScore != null) expect(['note', 'weekend']).toContain(c.kind);
    }
  });
});

describe('WEEKLY_CATALOG · every entry is completable and non-trivial', () => {
  for (const def of WEEKLY_CATALOG) {
    it(`${def.id} completes with a full qualifying week`, () => {
      const days = [0, 1, 2, 3, 4, 5, 6].map((o) =>
        qualifyingDay(
          def,
          new Date(WEEK.weekStart.getTime() + o * 86_400_000 + 12 * 3_600_000),
        ),
      );
      expect(
        resolveWeekly(def, def.total, days, WEEK.weekStart, WEEK.weekEnd).won,
      ).toBe(true);
    });

    it(`${def.id} is not free (empty week fails)`, () => {
      expect(
        resolveWeekly(def, def.total, [], WEEK.weekStart, WEEK.weekEnd).won,
      ).toBe(false);
    });
  }
});

describe('weeklyById', () => {
  it('resolves known ids and rejects unknown', () => {
    expect(weeklyById('w-saisie-5')?.total).toBe(5);
    expect(weeklyById('nope')).toBeUndefined();
  });
});
