import { Days, UserBadge, WeeklyChallenge } from '@prisma/client';
import { RewardsService } from './rewards.service';
import { weekBounds } from './weekly.progress';

const NOW = new Date(Date.UTC(2026, 6, 22, 10)); // Wed 22 Jul 2026, 10:00 UTC
const WEEK = weekBounds(NOW);
const LAST_WEEK = weekBounds(new Date(WEEK.weekStart.getTime() - 1));

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
    meals_completed_at: null,
    ...over,
  } as Days;
}
function mkWeekly(over: Partial<WeeklyChallenge>): WeeklyChallenge {
  return {
    id: nextId++,
    user_id: 1,
    iso_week: WEEK.isoWeek,
    week_start: WEEK.weekStart,
    week_end: WEEK.weekEnd,
    challenge_id: 'w-saisie-3',
    flavor: 'accessible',
    target: 3,
    status: 'active',
    started_at: WEEK.weekStart,
    resolved_at: null,
    reward_points: null,
    ...over,
  } as WeeklyChallenge;
}
function dayInLastWeek(offset: number): Date {
  return new Date(LAST_WEEK.weekStart.getTime() + offset * 86_400_000 + 12 * 3_600_000);
}

interface PrismaMock {
  days: { findMany: jest.Mock };
  weeklyChallenge: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  userBadge: { findMany: jest.Mock; create: jest.Mock };
}
function mkService(opts: {
  days?: Days[];
  weekly?: WeeklyChallenge[];
  badges?: UserBadge[];
}): { service: RewardsService; prisma: PrismaMock } {
  const weekly = opts.weekly ?? [];
  let seq = 5000;
  const prisma: PrismaMock = {
    days: { findMany: jest.fn().mockResolvedValue(opts.days ?? []) },
    weeklyChallenge: {
      findMany: jest.fn().mockResolvedValue(weekly),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: seq++,
          status: 'active',
          started_at: new Date(),
          resolved_at: null,
          reward_points: null,
          ...data,
        }),
      ),
      update: jest.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({ ...weekly.find((w) => w.id === where.id), ...data }),
      ),
    },
    userBadge: {
      findMany: jest.fn().mockResolvedValue(opts.badges ?? []),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: seq++, ...data })),
    },
  };
  return { service: new RewardsService(prisma as never), prisma };
}

describe('RewardsService.getRewards', () => {
  it('fresh user: two offers (accessible + ambitious), no active challenge', async () => {
    const { service } = mkService({});
    const r = await service.getRewards(1, NOW);
    expect(r.week.challenge).toBeNull();
    expect(r.week.offers).toHaveLength(2);
    expect(r.week.offers!.map((o) => o.flavor)).toEqual(['accessible', 'ambitious']);
    expect(r.week.offers![0].id).not.toBe(r.week.offers![1].id);
    // The two offers must be different families (not "3 vs 6 jours" du même kind).
    expect(r.week.offers![0].kindId).not.toBe(r.week.offers![1].kindId);
    expect(r.month.points).toBe(0);
    expect(r.month.threshold).toBe(35);
    expect(r.month.badge.unlocked).toBe(false);
  });

  it('exposes the chosen challenge with live progress', async () => {
    const days = [0, 1].map((o) =>
      mkDay({ date: new Date(WEEK.weekStart.getTime() + o * 86_400_000 + 12 * 3_600_000) }),
    );
    const weekly = [mkWeekly({ challenge_id: 'w-saisie-3', target: 3, flavor: 'accessible' })];
    const { service } = mkService({ days, weekly });
    const r = await service.getRewards(1, NOW);
    expect(r.week.offers).toBeNull();
    expect(r.week.challenge).toMatchObject({ id: 'w-saisie-3', prog: 2, target: 3, rewardPoints: 5 });
  });
});

describe('RewardsService.selectWeekly', () => {
  it('accepts an offered challenge and creates a prorated row', async () => {
    const { service, prisma } = mkService({});
    const offers = (await service.getRewards(1, NOW)).week.offers!;
    const chosen = offers[1]; // ambitious
    const active = await service.selectWeekly(1, chosen.id, NOW);
    expect(active.id).toBe(chosen.id);
    expect(active.flavor).toBe('ambitious');
    expect(prisma.weeklyChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ challenge_id: chosen.id, flavor: 'ambitious', iso_week: WEEK.isoWeek }),
      }),
    );
  });

  it('rejects a challenge that was not offered (400)', async () => {
    const { service } = mkService({});
    await expect(service.selectWeekly(1, 'w-sport-4', NOW)).rejects.toMatchObject({ status: 400 });
  });

  it('409 when a challenge is already chosen this week', async () => {
    const weekly = [mkWeekly({ iso_week: WEEK.isoWeek })];
    const { service } = mkService({ weekly });
    await expect(service.selectWeekly(1, 'w-saisie-3', NOW)).rejects.toMatchObject({ status: 409 });
  });
});

describe('RewardsService · lazy resolution', () => {
  it('resolves an elapsed week to won and credits points', async () => {
    const days = [0, 1, 2].map((o) => mkDay({ date: dayInLastWeek(o) }));
    const weekly = [
      mkWeekly({
        iso_week: LAST_WEEK.isoWeek,
        week_start: LAST_WEEK.weekStart,
        week_end: LAST_WEEK.weekEnd,
        challenge_id: 'w-saisie-3',
        target: 3,
        flavor: 'accessible',
        status: 'active',
      }),
    ];
    const { service, prisma } = mkService({ days, weekly });
    const r = await service.getRewards(1, NOW);
    expect(prisma.weeklyChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'won', reward_points: 5 }),
      }),
    );
    expect(r.week.justResolved).toMatchObject({ won: true, rewardPoints: 5 });
  });

  it('resolves an elapsed week short of target to lost (no points)', async () => {
    const days = [0].map((o) => mkDay({ date: dayInLastWeek(o) }));
    const weekly = [
      mkWeekly({
        iso_week: LAST_WEEK.isoWeek,
        week_start: LAST_WEEK.weekStart,
        week_end: LAST_WEEK.weekEnd,
        challenge_id: 'w-saisie-3',
        target: 3,
        status: 'active',
      }),
    ];
    const { service, prisma } = mkService({ days, weekly });
    await service.getRewards(1, NOW);
    expect(prisma.weeklyChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'lost', reward_points: null }) }),
    );
  });
});

describe('RewardsService · badges (backfill + monthly)', () => {
  it('backfills a legacy achievement from day history with its real date', async () => {
    // 7 consecutive on-time days → unlocks « constance » (streak 7)
    const days = [0, 1, 2, 3, 4, 5, 6].map((o) =>
      mkDay({ date: new Date(NOW.getTime() - o * 86_400_000) }),
    );
    const { service, prisma } = mkService({ days });
    const badges = await service.getBadges(1, NOW);
    expect(prisma.userBadge.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ badge_id: 'constance' }) }),
    );
    expect(badges.find((b) => b.id === 'constance')?.unlocked).toBe(true);
  });

  it('does not recreate an already-stored badge', async () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((o) =>
      mkDay({ date: new Date(NOW.getTime() - o * 86_400_000) }),
    );
    const badges: UserBadge[] = [
      { id: 1, user_id: 1, badge_id: 'constance', unlocked_at: new Date() } as UserBadge,
    ];
    const { service, prisma } = mkService({ days, badges });
    await service.getBadges(1, NOW);
    const created = prisma.userBadge.create.mock.calls.map((c) => c[0].data.badge_id);
    expect(created).not.toContain('constance');
  });

  it('unlocks the monthly badge once points reach the threshold', async () => {
    // 30 on-time days in July → 30 pts; plus a won weekly (+10) → ≥ 35
    const days = Array.from({ length: 30 }, (_, i) =>
      mkDay({ date: new Date(Date.UTC(2026, 6, i + 1, 12)) }),
    );
    const weekly = [
      mkWeekly({
        iso_week: LAST_WEEK.isoWeek,
        week_start: LAST_WEEK.weekStart,
        week_end: LAST_WEEK.weekEnd,
        status: 'won',
        reward_points: 10,
      }),
    ];
    const { service, prisma } = mkService({ days, weekly });
    const r = await service.getRewards(1, NOW);
    expect(r.month.points).toBeGreaterThanOrEqual(35);
    expect(r.month.badge.unlocked).toBe(true);
    expect(prisma.userBadge.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ badge_id: 'season-2026-07' }) }),
    );
  });
});

describe('RewardsService.getCollection', () => {
  it('returns 12 monthly tiles (current/future/missed) and all achievements', async () => {
    const { service } = mkService({});
    const c = await service.getCollection(1, NOW);
    // Launch = July 2026, no user days → only Jul..Dec shown, Jan..Jun removed.
    expect(c.monthly.map((m) => m.month)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(c.monthly.find((m) => m.month === 7)?.state).toBe('current');
    expect(c.monthly.find((m) => m.month === 8)?.state).toBe('future');
    expect(c.monthly.find((m) => m.month === 6)).toBeUndefined();
    expect(c.achievements.length).toBeGreaterThan(0);
  });
});
