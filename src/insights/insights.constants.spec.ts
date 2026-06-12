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
