import { WeeklyChallenge } from '@prisma/client';
import { computeElo, ELO_MAX, ELO_MIN, ELO_START } from './elo.progress';
import { weekBounds } from './weekly.progress';

// NOW : mercredi 23 juillet 2026 — la semaine courante (W30) ne compte jamais.
const NOW = new Date(Date.UTC(2026, 6, 23, 12));

/** La semaine qui a commencé `weeksAgo` semaines avant celle de NOW. */
function weekAt(weeksAgo: number) {
  const { weekStart } = weekBounds(NOW);
  return weekBounds(new Date(weekStart.getTime() - weeksAgo * 7 * 86_400_000));
}

let nextId = 1;
function mkWeekly(
  weeksAgo: number,
  status: 'won' | 'lost' | 'active',
  flavor: 'accessible' | 'ambitious' = 'accessible',
): WeeklyChallenge {
  const { weekStart, weekEnd, isoWeek } = weekAt(weeksAgo);
  return {
    id: nextId++,
    user_id: 1,
    iso_week: isoWeek,
    week_start: weekStart,
    week_end: weekEnd,
    challenge_id: 'w-saisie-3',
    flavor,
    target: 3,
    status,
    started_at: weekStart,
    resolved_at: null,
    reward_points: null,
  } as WeeklyChallenge;
}

describe('computeElo — « toujours faisable » (montée lente, descente rapide)', () => {
  it('sans historique : départ au plancher', () => {
    expect(computeElo([], NOW)).toBe(ELO_START);
  });

  it('victoire accessible +25, ambitieuse +50', () => {
    expect(computeElo([mkWeekly(1, 'won')], NOW)).toBe(1025);
    expect(computeElo([mkWeekly(1, 'won', 'ambitious')], NOW)).toBe(1050);
  });

  it('un échec redescend de −50 (jamais sous le plancher)', () => {
    // 3 victoires puis 1 échec : 1000 +25 +25 +25 −50 = 1025
    const weekly = [
      mkWeekly(4, 'won'),
      mkWeekly(3, 'won'),
      mkWeekly(2, 'won'),
      mkWeekly(1, 'lost'),
    ];
    expect(computeElo(weekly, NOW)).toBe(1025);
    // Échec direct au plancher : clamp à 1000.
    expect(computeElo([mkWeekly(1, 'lost')], NOW)).toBe(ELO_MIN);
  });

  it('une semaine sans défi choisi érode de −25', () => {
    // W-3 gagnée, W-2 sautée, W-1 gagnée : 1000 +25 −25 +25 = 1025
    const weekly = [mkWeekly(3, 'won'), mkWeekly(1, 'won')];
    expect(computeElo(weekly, NOW)).toBe(1025);
  });

  it('la semaine courante ne compte pas (même active)', () => {
    expect(computeElo([mkWeekly(0, 'active')], NOW)).toBe(ELO_START);
    // Et une semaine passée encore `active` (pas résolue) est neutre.
    expect(computeElo([mkWeekly(1, 'active')], NOW)).toBe(ELO_START);
  });

  it('clamp au plafond', () => {
    // 40 victoires ambitieuses consécutives : 1000 + 40×50 = 3000 → 1900.
    const weekly = Array.from({ length: 40 }, (_, i) =>
      mkWeekly(40 - i, 'won', 'ambitious'),
    );
    expect(computeElo(weekly, NOW)).toBe(ELO_MAX);
  });
});
