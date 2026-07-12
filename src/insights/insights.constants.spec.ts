import { Days } from '@prisma/client';
import { BADGES } from './insights.constants';
import { startOfDay } from './insights.scoring';

const today = startOfDay(new Date());

function dayAt(offset: number): Date {
  return new Date(today.getTime() - offset * 86_400_000);
}

function sameDayNoon(date: Date): Date {
  return new Date(date.getTime() + 12 * 3_600_000);
}

let nextId = 1;
function mkDay(over: Partial<Days> & { date: Date }): Days {
  return {
    id: nextId++,
    user_id: 1,
    morning_score: 'leger',
    afternoon_score: 'normal',
    evening_score: 'leger',
    snack: 0,
    sport: false,
    sport_type: null,
    meals_completed_at: null,
    ...over,
  } as Days;
}

function badge(id: string) {
  const found = BADGES.find((b) => b.id === id);
  if (!found) throw new Error(`badge ${id} not found`);
  return found;
}

describe('constance badge', () => {
  it('unlocks with 7 consecutive on-time days', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((o) =>
      mkDay({ date: dayAt(o), meals_completed_at: sameDayNoon(dayAt(o)) }),
    );
    expect(badge('constance').unlock(days)).toBe(true);
  });

  it('stays locked when one day in the run was backfilled late', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((o) =>
      mkDay({
        date: dayAt(o),
        meals_completed_at:
          o === 4 ? sameDayNoon(dayAt(1)) : sameDayNoon(dayAt(o)),
      }),
    );
    expect(badge('constance').unlock(days)).toBe(false);
  });

  it('unlocks with grandfathered rows (null timestamps)', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((o) => mkDay({ date: dayAt(o) }));
    expect(badge('constance').unlock(days)).toBe(true);
  });
});

describe('leger-7 badge', () => {
  // 3 très-légers → score 7.5 ≥ 7
  const lightMeals = {
    morning_score: 'tresLeger',
    afternoon_score: 'tresLeger',
    evening_score: 'tresLeger',
  } as Partial<Days>;

  it('unlocks with 7 consecutive on-time light days', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((o) =>
      mkDay({
        ...lightMeals,
        date: dayAt(o),
        meals_completed_at: sameDayNoon(dayAt(o)),
      }),
    );
    expect(badge('leger-7').unlock(days)).toBe(true);
  });

  it('stays locked when a light day was backfilled late', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((o) =>
      mkDay({
        ...lightMeals,
        date: dayAt(o),
        meals_completed_at:
          o === 4 ? sameDayNoon(dayAt(1)) : sameDayNoon(dayAt(o)),
      }),
    );
    expect(badge('leger-7').unlock(days)).toBe(false);
  });
});

describe('sobriete badge', () => {
  it('ignores meals_completed_at (not a flame badge)', () => {
    // 7 non-heavy days, all backfilled late → still unlocks.
    const days = [1, 2, 3, 4, 5, 6, 7].map((o) =>
      mkDay({ date: dayAt(o), meals_completed_at: sameDayNoon(dayAt(0)) }),
    );
    expect(badge('sobriete').unlock(days)).toBe(true);
  });
});

describe('badge progress & unlockedAt (dérivations génériques)', () => {
  it('progress compte les jours qualifiants, borné à total', () => {
    // 12 matins légers → aurore (total 10) plafonne à 10
    const days = Array.from({ length: 12 }, (_, i) =>
      mkDay({ date: dayAt(i + 1), morning_score: 'leger' }),
    );
    expect(badge('aurore').progress(days)).toBe(10);
    expect(badge('aurore').unlock(days)).toBe(true);
  });

  it('progress streak = meilleure série, les trous cassent la suite', () => {
    // 4 jours, trou, 3 jours → meilleure série 4
    const days = [1, 2, 3, 4, 6, 7, 8].map((o) => mkDay({ date: dayAt(o) }));
    expect(badge('constance').progress(days)).toBe(4);
    expect(badge('constance').unlock(days)).toBe(false);
  });

  it('unlockedAt (count) = le jour du Nᵉ qualifiant, pas le dernier', () => {
    const days = Array.from({ length: 12 }, (_, i) =>
      mkDay({ date: dayAt(12 - i), morning_score: 'leger' }),
    );
    // 12 jours consécutifs finissant hier ; le 10ᵉ matin léger tombe dayAt(3)
    expect(badge('aurore').unlockedAt(days)?.getTime()).toBe(
      dayAt(3).getTime(),
    );
  });

  it('unlockedAt (streak) = le jour où la série atteint l’objectif', () => {
    const days = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((o) =>
      mkDay({ date: dayAt(o) }),
    );
    // série de 9 finissant hier → l’objectif 7 est atteint à dayAt(3)
    expect(badge('constance').unlockedAt(days)?.getTime()).toBe(
      dayAt(3).getTime(),
    );
  });

  it('unlockedAt = null tant que verrouillé, description et total exposés', () => {
    const days = [1, 2].map((o) => mkDay({ date: dayAt(o) }));
    expect(badge('constance').unlockedAt(days)).toBeNull();
    for (const b of BADGES) {
      expect(b.description.length).toBeGreaterThan(10);
      expect(b.total).toBeGreaterThan(0);
    }
  });
});
