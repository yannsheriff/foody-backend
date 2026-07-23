import { Days } from '@prisma/client';
import { startOfDay, ymd } from '../insights/insights.scoring';
import {
  currentStreakWithBridges,
  findBridgeCandidate,
  recordStreakWithBridges,
} from './freeze.progress';

// NOW fixe : 21 juillet 2026, 14h UTC.
const NOW = new Date(Date.UTC(2026, 6, 21, 14));
const TODAY = startOfDay(NOW);

function dayAt(offset: number): Date {
  return new Date(TODAY.getTime() - offset * 86_400_000 + 12 * 3_600_000);
}

let nextId = 1;
function mkDay(date: Date): Days {
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
    cheat_slot: null,
    date,
  } as Days;
}

const bridgeAt = (offset: number) =>
  ymd(new Date(TODAY.getTime() - offset * 86_400_000));

describe('currentStreakWithBridges', () => {
  it('sans pont : la série casse au jour manqué', () => {
    // today, hier on-time ; D-2 manqué ; D-3..D-5 on-time.
    const days = [0, 1, 3, 4, 5].map((o) => mkDay(dayAt(o)));
    expect(currentStreakWithBridges(days, new Set(), NOW)).toBe(2);
  });

  it('un pont sur le jour manqué raccorde la série', () => {
    const days = [0, 1, 3, 4, 5].map((o) => mkDay(dayAt(o)));
    expect(currentStreakWithBridges(days, new Set([bridgeAt(2)]), NOW)).toBe(6);
  });

  it('un pont peut être la tête de série (hier manqué, ponté)', () => {
    // hier manqué + ponté, D-2..D-3 on-time, aujourd'hui pas encore noté.
    const days = [2, 3].map((o) => mkDay(dayAt(o)));
    expect(currentStreakWithBridges(days, new Set([bridgeAt(1)]), NOW)).toBe(3);
  });
});

describe('recordStreakWithBridges', () => {
  it('un pont joint deux séries dans le record', () => {
    const days = [0, 1, 3, 4, 5].map((o) => mkDay(dayAt(o)));
    expect(recordStreakWithBridges(days, new Set())).toBe(3);
    expect(recordStreakWithBridges(days, new Set([bridgeAt(2)]))).toBe(6);
  });
});

describe('findBridgeCandidate', () => {
  const holeyDays = [0, 1, 3, 4, 5].map((o) => mkDay(dayAt(o))); // trou en D-2

  it('trouve le jour manqué past-grace qui augmente la série', () => {
    const c = findBridgeCandidate(holeyDays, new Set(), 1, NOW);
    expect(c).not.toBeNull();
    expect(ymd(c!)).toBe(bridgeAt(2));
  });

  it('rien sans stock', () => {
    expect(findBridgeCandidate(holeyDays, new Set(), 0, NOW)).toBeNull();
  });

  it('ne consomme pas tant que le jour est rattrapable (catch-up d’abord)', () => {
    // Trou = hier ; graceDeadline(hier) = aujourd'hui 23h30 → à 14h, encore
    // rattrapable → pas de conso.
    const days = [0, 2, 3].map((o) => mkDay(dayAt(o)));
    expect(findBridgeCandidate(days, new Set(), 1, NOW)).toBeNull();
  });

  it('hier devient pontable après 23h30', () => {
    const days = [0, 2, 3].map((o) => mkDay(dayAt(o)));
    const lateNow = new Date(Date.UTC(2026, 6, 22, 23, 45)); // 22/07 23h45 — le trou du 20 est past-grace
    // NB: au 22/07, le trou (20/07) a graceDeadline 21/07 23h30 < now ✓
    const c = findBridgeCandidate(days, new Set(), 1, lateNow);
    expect(c).not.toBeNull();
  });

  it('jamais de gel brûlé pour rien (trou sans série derrière)', () => {
    // today on-time seul ; D-2 manqué mais rien derrière → le pont n'augmente pas.
    const days = [mkDay(dayAt(0))];
    expect(findBridgeCandidate(days, new Set(), 1, NOW)).toBeNull();
  });

  it('ignore un jour déjà ponté', () => {
    const c = findBridgeCandidate(holeyDays, new Set([bridgeAt(2)]), 1, NOW);
    expect(c).toBeNull(); // la série est déjà raccordée, rien à ponter
  });
});
