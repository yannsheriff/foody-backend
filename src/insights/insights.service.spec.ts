import { Days } from '@prisma/client';
import { InsightsService } from './insights.service';
import { startOfDay } from './insights.scoring';

const today = startOfDay(new Date());

// dayAt(0) = today, dayAt(1) = yesterday, ...
function dayAt(offset: number): Date {
  return new Date(today.getTime() - offset * 86_400_000);
}

// On-time stamp: noon on the day itself.
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

interface EcoOver {
  stock?: number;
  consumptions?: { day: Date }[];
}

// Mock EconomyService — par défaut : pas de gel, pas de conso (comportement
// historique de la flamme, inchangé). Un gel en stock est réputé acheté il y a
// longtemps (l'appariement FIFO conso→achat exige assez de buy_freeze).
function mkEconomy(over: EcoOver = {}) {
  const consumptions = over.consumptions ?? [];
  const stock = over.stock ?? 0;
  const txns = Array.from({ length: stock + consumptions.length }, (_, i) => ({
    id: i + 1,
    user_id: 1,
    amount: -70,
    reason: 'buy_freeze',
    ref: `buy-${i}`,
    created_at: new Date(Date.UTC(2026, 0, 1 + i)),
  }));
  return {
    loadAndSync: jest.fn().mockResolvedValue({
      txns,
      consumptions,
      balance: 0,
      freezeStock: stock,
    }),
    consumeFreeze: jest.fn().mockResolvedValue(undefined),
    unseenFreeze: jest.fn().mockResolvedValue(null),
  };
}

function mkService(days: Days[], eco: EcoOver = {}): InsightsService {
  return mkServiceWithEconomy(days, mkEconomy(eco));
}

function mkServiceWithEconomy(
  days: Days[],
  economy: ReturnType<typeof mkEconomy>,
): InsightsService {
  const prisma = {
    days: { findMany: jest.fn().mockResolvedValue(days) },
    freezeConsumption: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return new InsightsService(prisma as never, economy as never);
}

describe('InsightsService.getStreak', () => {
  it('counts consecutive on-time days ending today', async () => {
    const days = [0, 1, 2].map((o) =>
      mkDay({ date: dayAt(o), meals_completed_at: sameDayNoon(dayAt(o)) }),
    );
    const { current } = await mkService(days).getStreak(1);
    expect(current).toBe(3);
  });

  it('preserves grandfathered streaks (null timestamps)', async () => {
    const days = [1, 2, 3, 4].map((o) => mkDay({ date: dayAt(o) }));
    const { current } = await mkService(days).getStreak(1);
    expect(current).toBe(4);
  });

  it('does not resurrect a streak from backfilled days', async () => {
    // User tracked J-7..J-4 on time, skipped J-3..J-1, backfilled all 3 today.
    const backfilledAt = sameDayNoon(dayAt(0));
    const days = [
      ...[4, 5, 6, 7].map((o) =>
        mkDay({ date: dayAt(o), meals_completed_at: sameDayNoon(dayAt(o)) }),
      ),
      ...[1, 2, 3].map((o) =>
        mkDay({ date: dayAt(o), meals_completed_at: backfilledAt }),
      ),
    ];
    const { current } = await mkService(days).getStreak(1);
    // J-1 filled today is within grace and counts; J-2/J-3 are late and the
    // old chain must not reconnect.
    expect(current).toBe(1);
  });

  it('breaks the current streak at a late-filled day', async () => {
    const days = [
      mkDay({ date: dayAt(0), meals_completed_at: sameDayNoon(dayAt(0)) }),
      // yesterday filled two days after its date
      mkDay({ date: dayAt(1), meals_completed_at: sameDayNoon(dayAt(0)) }),
      mkDay({ date: dayAt(2), meals_completed_at: sameDayNoon(dayAt(2)) }),
    ];
    // dayAt(1) completed at dayAt(0) noon is within grace — push it later:
    days[1].meals_completed_at = new Date(
      dayAt(0).getTime() + 23 * 3_600_000 + 45 * 60_000,
    );
    const { current } = await mkService(days).getStreak(1);
    expect(current).toBe(1);
  });

  it('excludes late days from the record', async () => {
    // Historical run J-20..J-11 with J-15 backfilled late → 5 + 4.
    const days = Array.from({ length: 10 }, (_, i) => {
      const o = 11 + i;
      const late = o === 15;
      return mkDay({
        date: dayAt(o),
        meals_completed_at: late
          ? sameDayNoon(dayAt(o - 5))
          : sameDayNoon(dayAt(o)),
      });
    });
    const { record, current } = await mkService(days).getStreak(1);
    expect(record).toBe(5);
    expect(current).toBe(0);
  });
});

describe('InsightsService.getRecords / getStats', () => {
  it('still counts late-filled days everywhere except streak', async () => {
    const lateDay = mkDay({
      date: dayAt(3),
      meals_completed_at: sameDayNoon(dayAt(0)),
    });
    const onTime = mkDay({
      date: dayAt(1),
      meals_completed_at: sameDayNoon(dayAt(1)),
    });
    const service = mkService([lateDay, onTime]);
    const records = await service.getRecords(1);
    expect(records.daysTracked).toBe(2);
    expect(records.streakRecord).toBe(1);
  });
});

describe('InsightsService.getOverview', () => {
  it('sépare la fenêtre 30 j et les 30 jours précédents', async () => {
    // 5 jours récents parfaits (légers, sport) vs 5 anciens copieux
    const recent = [0, 1, 2, 3, 4].map((o) =>
      mkDay({ date: dayAt(o), snack: 0, sport_level: 'normal' }),
    );
    const older = [35, 36, 37, 38, 39].map((o) =>
      mkDay({
        date: dayAt(o),
        morning_score: 'copieux',
        afternoon_score: 'copieux',
        evening_score: 'copieux',
        snack: 1,
      }),
    );
    const o = await mkService([...recent, ...older]).getOverview(1);
    expect(o.window.daysTracked).toBe(5);
    expect(o.previous.daysTracked).toBe(5);
    expect(o.window.average).toBeGreaterThan(o.previous.average);
  });

  it('renvoie toujours 8 semaines, la courante en dernier, trous à null', async () => {
    const o = await mkService([mkDay({ date: dayAt(0) })]).getOverview(1);
    expect(o.weeks).toHaveLength(8);
    const last = o.weeks[o.weeks.length - 1];
    expect(last.score).not.toBeNull();
    expect(o.weeks[0].score).toBeNull();
    // les lundis se suivent de 7 jours
    const starts = o.weeks.map((w) =>
      new Date(w.start + 'T00:00:00Z').getTime(),
    );
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBe(7 * 86_400_000);
    }
  });

  it('jour fort/faible : min 3 occurrences et écart ≥ 0,8, sinon null', async () => {
    // 3 lundis légers, 3 mardis copieux — écart net
    const monday = new Date(
      today.getTime() - ((today.getUTCDay() + 6) % 7) * 86_400_000,
    );
    const mk = (base: Date, weeksBack: number, over: Partial<Days>) =>
      mkDay({
        date: new Date(base.getTime() - weeksBack * 7 * 86_400_000),
        ...over,
      });
    const tuesday = new Date(monday.getTime() + 86_400_000);
    const light = { snack: 0 } as Partial<Days>;
    const heavy = {
      morning_score: 'copieux',
      afternoon_score: 'copieux',
      evening_score: 'copieux',
      snack: 1,
    } as Partial<Days>;
    const days = [
      mk(monday, 1, light),
      mk(monday, 2, light),
      mk(monday, 3, light),
      mk(tuesday, 1, heavy),
      mk(tuesday, 2, heavy),
      mk(tuesday, 3, heavy),
    ];
    const o = await mkService(days).getOverview(1);
    expect(o.bestDay?.weekday).toBe(1); // lundi UTC
    expect(o.worstDay?.weekday).toBe(2); // mardi UTC
    // 2 occurrences seulement → pas d'insight
    const few = [mk(monday, 1, light), mk(tuesday, 1, heavy)];
    const o2 = await mkService(few).getOverview(1);
    expect(o2.bestDay).toBeNull();
    expect(o2.worstDay).toBeNull();
  });
});

describe('getStreak — gel de flamme (Phase 3)', () => {
  // today + hier on-time, D-2 manqué (past-grace quelle que soit l'heure),
  // D-3..D-5 on-time.
  const holey = () => [0, 1, 3, 4, 5].map((o) => mkDay({ date: dayAt(o) }));
  const holeYmd = () => dayAt(2).toISOString().slice(0, 10);

  it('consomme un gel en stock pour ponter le jour manqué', async () => {
    const economy = mkEconomy({ stock: 1 });
    economy.unseenFreeze.mockResolvedValue({
      day: holeYmd(),
      consumedAt: new Date(),
    });
    const service = mkServiceWithEconomy(holey(), economy);
    const s = await service.getStreak(1);
    expect(economy.consumeFreeze).toHaveBeenCalledTimes(1);
    const consumedDay = economy.consumeFreeze.mock.calls[0][1] as Date;
    expect(consumedDay.toISOString().slice(0, 10)).toBe(holeYmd());
    expect(s.current).toBe(6); // 2 + pont + 3
    expect(s.freezeConsumed).toEqual({ day: holeYmd(), stock: 0 });
  });

  it('sans stock : la flamme casse au trou, rien n’est consommé', async () => {
    const economy = mkEconomy({ stock: 0 });
    const service = mkServiceWithEconomy(holey(), economy);
    const s = await service.getStreak(1);
    expect(economy.consumeFreeze).not.toHaveBeenCalled();
    expect(s.current).toBe(2);
    expect(s.freezeConsumed).toBeNull();
  });

  it('un pont déjà persisté compte sans nouvelle conso (figé)', async () => {
    const economy = mkEconomy({ stock: 0, consumptions: [{ day: dayAt(2) }] });
    const service = mkServiceWithEconomy(holey(), economy);
    const s = await service.getStreak(1);
    expect(economy.consumeFreeze).not.toHaveBeenCalled();
    expect(s.current).toBe(6);
    expect(s.record).toBe(6); // le record compte le pont aussi
  });
});
