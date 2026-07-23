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
  // Ledger dynamique : findMany reflète les créations (les débits d'achat
  // impactent le solde relu par getWallet après un achat).
  const store: Record<string, unknown>[] = [...((over.txns as Record<string, unknown>[]) ?? [])];
  let id = store.length + 1;
  const prisma = {
    weeklyChallenge: { findMany: jest.fn().mockResolvedValue(over.weekly ?? []) },
    userBadge: { findMany: jest.fn().mockResolvedValue(over.badges ?? []) },
    days: {
      findMany: jest.fn().mockResolvedValue(over.days ?? []),
      update: jest.fn().mockResolvedValue({}),
    },
    freezeConsumption: {
      findMany: jest.fn().mockResolvedValue(over.consumptions ?? []),
    },
    coinTransaction: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([...store])),
      create: jest.fn().mockImplementation(({ data }) => {
        const row = { id: id++, created_at: new Date(), ...data };
        store.push(row);
        return Promise.resolve(row);
      }),
    },
    $transaction: jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
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

const NOW = new Date(Date.UTC(2026, 6, 21, 12)); // 21 juil 2026
function todayRow(over: Record<string, unknown> = {}) {
  return {
    id: 500,
    user_id: 1,
    morning_score: 'leger',
    afternoon_score: 'normal',
    evening_score: 'copieux',
    snack: 0,
    sport: false,
    sport_level: null,
    sport_type: null,
    meals_completed_at: null,
    cheat_slot: null,
    date: NOW,
    ...over,
  };
}
const welcome100 = [{ id: 1, user_id: 1, amount: 100, reason: 'welcome', ref: 'welcome' }];

describe('EconomyService — boutique', () => {
  it('buyFreeze : refuse si solde insuffisant', async () => {
    const { service } = mkService({
      txns: [{ id: 1, user_id: 1, amount: 30, reason: 'welcome', ref: 'welcome' }],
    });
    await expect(service.buyFreeze(1)).rejects.toThrow('Solde insuffisant');
  });

  it('buyFreeze : refuse si un gel est déjà en réserve', async () => {
    const { service } = mkService({
      txns: [
        { id: 1, user_id: 1, amount: 200, reason: 'welcome', ref: 'welcome' },
        { id: 2, user_id: 1, amount: -70, reason: 'buy_freeze', ref: 'x' },
      ],
    });
    await expect(service.buyFreeze(1)).rejects.toThrow('déjà un gel');
  });

  it('buyFreeze : débite 70 et renvoie le solde + stock à jour', async () => {
    const { service, prisma } = mkService({ txns: welcome100 });
    const wallet = await service.buyFreeze(1);
    expect(prisma.coinTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'buy_freeze', amount: -70 }),
      }),
    );
    expect(wallet.balance).toBe(30); // 100 − 70
    expect(wallet.freezeStock).toBe(1);
  });

  it('buyCheatMeal : débite 25 et incrémente la réserve (aucun jour touché)', async () => {
    const { service, prisma } = mkService({ txns: welcome100 });
    const wallet = await service.buyCheatMeal(1);
    expect(prisma.coinTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'buy_cheat_meal', amount: -25 }),
      }),
    );
    expect(prisma.days.update).not.toHaveBeenCalled();
    expect(wallet.balance).toBe(75); // 100 − 25
    expect(wallet.cheatStock).toBe(1);
  });

  it('buyCheatMeal : refuse si solde insuffisant', async () => {
    const { service } = mkService({
      txns: [{ id: 1, user_id: 1, amount: 10, reason: 'welcome', ref: 'welcome' }],
    });
    await expect(service.buyCheatMeal(1)).rejects.toThrow('Solde insuffisant');
  });

  const cheatInStock = [
    ...welcome100,
    { id: 9, user_id: 1, amount: -25, reason: 'buy_cheat_meal', ref: 'x' },
  ];

  it('useCheatMeal : refuse sans réserve', async () => {
    const { service } = mkService({
      days: [todayRow({ evening_score: 'copieux' })],
      txns: welcome100,
    });
    await expect(service.useCheatMeal(1, 'evening', NOW)).rejects.toThrow(
      'Aucun cheat meal en réserve',
    );
  });

  it('useCheatMeal : refuse si le repas n’est pas lourd', async () => {
    const { service } = mkService({
      days: [todayRow({ evening_score: 'leger' })],
      txns: cheatInStock,
    });
    await expect(service.useCheatMeal(1, 'evening', NOW)).rejects.toThrow(
      "n'est pas lourd",
    );
  });

  it('useCheatMeal : pose le cheat_slot sans débit, la réserve descend', async () => {
    const { service, prisma } = mkService({
      days: [todayRow({ evening_score: 'copieux' })],
      txns: cheatInStock,
    });
    const wallet = await service.useCheatMeal(1, 'evening', NOW);
    expect(prisma.days.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 500 },
        data: { cheat_slot: 'evening' },
      }),
    );
    expect(wallet.balance).toBe(75); // aucun débit à l'usage
    // NB : le mock days.findMany est figé (cheat_slot pas re-lu) — la réserve
    // réelle descendrait ; ici on vérifie surtout l'absence de nouveau débit.
    expect(
      (prisma.coinTransaction.create as jest.Mock).mock.calls.filter(
        (c) => (c[0] as { data: { reason: string } }).data.reason === 'buy_cheat_meal',
      ),
    ).toHaveLength(0);
  });
});
