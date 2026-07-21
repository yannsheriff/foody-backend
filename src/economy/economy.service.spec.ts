import { EconomyService } from './economy.service';

let seq = 100;
function mkDay(date: Date) {
  return {
    id: seq++,
    user_id: 1,
    morning_score: 'leger',
    afternoon_score: 'normal',
    evening_score: 'leger',
    snack: 0,
    sport: false,
    sport_level: null,
    sport_type: null,
    meals_completed_at: null, // grandfathered → on-time
    cheat_slot: null,
    date,
  };
}
function consecutiveOnTimeDays(n: number) {
  const base = Date.UTC(2026, 5, 10, 12); // 10 juin 2026
  return Array.from({ length: n }, (_, i) => mkDay(new Date(base - i * 86_400_000)));
}

function mkService(
  over: {
    weekly?: unknown[];
    badges?: unknown[];
    days?: unknown[];
    txns?: unknown[];
    consumptions?: unknown[];
  } = {},
) {
  let id = 1;
  const prisma = {
    weeklyChallenge: { findMany: jest.fn().mockResolvedValue(over.weekly ?? []) },
    userBadge: { findMany: jest.fn().mockResolvedValue(over.badges ?? []) },
    days: { findMany: jest.fn().mockResolvedValue(over.days ?? []) },
    freezeConsumption: {
      findMany: jest.fn().mockResolvedValue(over.consumptions ?? []),
    },
    coinTransaction: {
      findMany: jest.fn().mockResolvedValue(over.txns ?? []),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: id++, created_at: new Date(), ...data }),
        ),
    },
  };
  return { service: new EconomyService(prisma as never), prisma };
}

describe('EconomyService.loadAndSync — crédits lazy', () => {
  it('crédite défis gagnés, badge mensuel, palier de flamme et bienvenue', async () => {
    const { service, prisma } = mkService({
      weekly: [
        { id: 7, user_id: 1, flavor: 'ambitious', status: 'won' }, // +25
        { id: 8, user_id: 1, flavor: 'accessible', status: 'lost' }, // ignoré
      ],
      badges: [
        { badge_id: 'season-2026-07' }, // +25
        { badge_id: 'constance' }, // accomplissement → 0 pièce
      ],
      days: consecutiveOnTimeDays(7), // record 7 → milestone-7 +15
    });
    const state = await service.loadAndSync(1);
    // 25 + 25 + 15 + 30 (bienvenue) = 95
    expect(state.balance).toBe(95);
    expect(prisma.coinTransaction.create).toHaveBeenCalledTimes(4);
    const reasons = prisma.coinTransaction.create.mock.calls.map(
      (c) => (c[0] as { data: { reason: string } }).data.reason,
    );
    expect(reasons).toEqual(
      expect.arrayContaining([
        'challenge_won',
        'monthly_badge',
        'flame_milestone',
        'welcome',
      ]),
    );
  });

  it('ne recrée pas un crédit déjà présent (idempotent)', async () => {
    const { service, prisma } = mkService({
      weekly: [{ id: 7, user_id: 1, flavor: 'accessible', status: 'won' }],
      txns: [
        { id: 1, user_id: 1, amount: 15, reason: 'challenge_won', ref: '7' },
        { id: 2, user_id: 1, amount: 30, reason: 'welcome', ref: 'welcome' },
      ],
    });
    const state = await service.loadAndSync(1);
    expect(prisma.coinTransaction.create).not.toHaveBeenCalled();
    expect(state.balance).toBe(45);
  });

  it('stock de gel = achats − consommations', async () => {
    const { service } = mkService({
      txns: [
        { id: 1, user_id: 1, amount: -70, reason: 'buy_freeze', ref: 'a' },
        { id: 2, user_id: 1, amount: -70, reason: 'buy_freeze', ref: 'b' },
        { id: 3, user_id: 1, amount: 30, reason: 'welcome', ref: 'welcome' },
      ],
      consumptions: [
        { id: 1, user_id: 1, day: new Date(), consumed_at: new Date(), seen: false },
      ],
    });
    const state = await service.loadAndSync(1);
    expect(state.freezeStock).toBe(1); // 2 achats − 1 conso
  });
});
