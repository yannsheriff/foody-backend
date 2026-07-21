import { Days, WeeklyChallenge } from '@prisma/client';
import {
  BADGE_THRESHOLD,
  computeMonthlyPoints,
  isBadgeUnlocked,
} from './monthly-badge';

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
    sport_level: null,
    sport_type: null,
    meals_completed_at: null, // grandfathered → on-time
    ...over,
  } as Days;
}
function mkWon(over: Partial<WeeklyChallenge> & { week_end: Date }): WeeklyChallenge {
  return {
    id: nextId++,
    user_id: 1,
    iso_week: '2026-W30',
    week_start: new Date(over.week_end.getTime() - 6 * 86_400_000),
    challenge_id: 'w-sport-3',
    flavor: 'ambitious',
    target: 3,
    status: 'won',
    started_at: new Date(),
    resolved_at: new Date(),
    reward_points: 10,
    ...over,
  } as WeeklyChallenge;
}

const jul = (d: number) => new Date(Date.UTC(2026, 6, d, 12));
const jun = (d: number) => new Date(Date.UTC(2026, 5, d, 12));

describe('computeMonthlyPoints', () => {
  it('sums on-time days (+1) and won-challenge points for the month', () => {
    const days = [jul(3), jul(4), jul(5)].map((date) => mkDay({ date }));
    const won = [mkWon({ week_end: jul(6), reward_points: 10 })];
    const p = computeMonthlyPoints(days, won, 2026, 7);
    expect(p.fromDays).toBe(3);
    expect(p.fromChallenges).toBe(10);
    expect(p.total).toBe(13);
  });

  it('excludes days and challenges from other months', () => {
    const days = [jul(3), jun(28)].map((date) => mkDay({ date }));
    const won = [
      mkWon({ week_end: jul(6), reward_points: 10 }),
      mkWon({ week_end: jun(29), reward_points: 10 }),
    ];
    const p = computeMonthlyPoints(days, won, 2026, 7);
    expect(p.fromDays).toBe(1);
    expect(p.fromChallenges).toBe(10);
  });

  it('dedupes on-time days by calendar day', () => {
    const days = [mkDay({ date: jul(3) }), mkDay({ date: jul(3) })];
    expect(computeMonthlyPoints(days, [], 2026, 7).fromDays).toBe(1);
  });

  it('ignores days that are not on-time and challenges not won', () => {
    const notTracked = mkDay({ date: jul(3), evening_score: null });
    const lost = mkWon({ week_end: jul(6), status: 'lost', reward_points: 10 });
    const p = computeMonthlyPoints([notTracked], [lost], 2026, 7);
    expect(p.total).toBe(0);
  });
});

describe('isBadgeUnlocked', () => {
  it('unlocks at the threshold', () => {
    expect(isBadgeUnlocked({ total: BADGE_THRESHOLD, fromDays: 25, fromChallenges: 10 })).toBe(true);
    expect(isBadgeUnlocked({ total: BADGE_THRESHOLD - 1, fromDays: 24, fromChallenges: 10 })).toBe(false);
  });
});
