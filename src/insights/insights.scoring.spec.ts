import { Days } from '@prisma/client';
import { countsForStreak, graceDeadline, startOfDay } from './insights.scoring';

function mkDay(over: Partial<Days> & { date: Date }): Days {
  return {
    id: 1,
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

describe('graceDeadline', () => {
  it('is D+1 at 23h30', () => {
    const d = new Date(Date.UTC(2026, 5, 10, 14, 12));
    expect(graceDeadline(d).getTime()).toBe(Date.UTC(2026, 5, 11, 23, 30));
  });
});

describe('countsForStreak', () => {
  const day = startOfDay(new Date(Date.UTC(2026, 5, 10)));

  it('grandfathers rows without a timestamp', () => {
    expect(countsForStreak(mkDay({ date: day }))).toBe(true);
  });

  it('accepts a day completed the same day', () => {
    expect(
      countsForStreak(
        mkDay({
          date: day,
          meals_completed_at: new Date(Date.UTC(2026, 5, 10, 20, 0)),
        }),
      ),
    ).toBe(true);
  });

  it('accepts completion exactly at D+1 23h30', () => {
    expect(
      countsForStreak(
        mkDay({
          date: day,
          meals_completed_at: new Date(Date.UTC(2026, 5, 11, 23, 30, 0, 0)),
        }),
      ),
    ).toBe(true);
  });

  it('rejects completion past D+1 23h30', () => {
    expect(
      countsForStreak(
        mkDay({
          date: day,
          meals_completed_at: new Date(Date.UTC(2026, 5, 11, 23, 31)),
        }),
      ),
    ).toBe(false);
  });

  it('rejects a day backfilled at D+2', () => {
    expect(
      countsForStreak(
        mkDay({
          date: day,
          meals_completed_at: new Date(2026, 5, 12, 9, 0),
        }),
      ),
    ).toBe(false);
  });

  it('rejects a day missing a meal even without a timestamp', () => {
    expect(countsForStreak(mkDay({ date: day, evening_score: null }))).toBe(
      false,
    );
  });
});

describe('computeDayScore — cheat meal (Phase 3)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { computeDayScore } = require('./insights.scoring') as {
    computeDayScore: (day: Days) => number;
  };
  const base = {
    date: new Date(Date.UTC(2026, 6, 21, 12)),
    morning_score: 'leger',
    afternoon_score: 'normal',
    evening_score: 'tresCopieux',
    snack: 0.5,
    sport_level: null,
  } as Partial<Days> & { date: Date };

  it('un repas lourd cheaté est scoré comme un normal', () => {
    // 2,25 + 1,5 + 0 + snack(+1) = 4,8 → cheat soir : 2,25 + 1,5 + 1,5 + 1 = 6,3
    expect(computeDayScore(mkDay(base))).toBe(4.8);
    expect(computeDayScore(mkDay({ ...base, cheat_slot: 'evening' }))).toBe(6.3);
  });

  it('un cheat sur un repas non lourd ne change rien (jamais de baisse)', () => {
    expect(computeDayScore(mkDay({ ...base, cheat_slot: 'morning' }))).toBe(4.8);
  });

  it('cheat_slot null = score inchangé', () => {
    expect(computeDayScore(mkDay({ ...base, cheat_slot: null }))).toBe(4.8);
  });
});
