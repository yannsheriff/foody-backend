import { Days, WeeklyChallenge } from '@prisma/client';
import { countsForStreak, ymd } from '../insights/insights.scoring';

// Points threshold to unlock the month's collectible badge. Calibrated so that
// neither typical assiduity alone nor challenges alone suffice — you need both
// (« assiduité + 1-2 défis »). TUNABLE.
export const BADGE_THRESHOLD = 35;

// A missed month's badge is lost forever, but we still evaluate the *previous*
// month for this many days into the new month, to cover "reached the threshold
// on the last day, opened the app the next morning".
export const MONTHLY_GRACE_DAYS = 2;

// Mois de lancement de la feature Récompenses. La feature étant arrivée en cours
// de mois (~20 juillet), personne ne pouvait accumuler 35 pts organiquement
// (défis indisponibles avant). Pour ce mois-là uniquement, on **plancher**
// `fromDays` au nombre de jours ÉCOULÉS du mois pour TOUS les utilisateurs
// (« 1 pt par jour écoulé »), afin que le badge reste atteignable. One-shot :
// aucun effet sur les mois suivants (feature dispo tout le mois). TUNABLE.
export const LAUNCH_GRANT_MONTH = { year: 2026, month: 7 } as const;

export interface MonthlyPoints {
  total: number;
  fromDays: number; // +1 per on-time day in the month (plancher jours écoulés au mois de lancement)
  fromChallenges: number; // Σ reward_points of weekly challenges won that month
}

// Nombre de jours du mois (UTC).
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Jours écoulés du mois (UTC) à la date `now`, capés au nombre de jours du mois :
// 0 si le mois n'a pas encore commencé, tous ses jours s'il est passé, sinon le
// quantième courant.
export function elapsedDaysInMonth(year: number, month: number, now: Date): number {
  const monthStart = Date.UTC(year, month - 1, 1);
  const nextMonthStart = Date.UTC(year, month, 1);
  const t = now.getTime();
  if (t >= nextMonthStart) return daysInMonth(year, month);
  if (t < monthStart) return 0;
  return now.getUTCDate();
}

// month is 1..12. On-time days are deduped by UTC calendar day; a weekly
// challenge's points count toward the month in which its week ENDS (Sunday UTC).
export function computeMonthlyPoints(
  days: Days[],
  wonChallenges: WeeklyChallenge[],
  year: number,
  month: number,
  now: Date = new Date(),
): MonthlyPoints {
  const onTimeDays = new Set<string>();
  for (const d of days) {
    const dt = new Date(d.date);
    if (
      dt.getUTCFullYear() === year &&
      dt.getUTCMonth() === month - 1 &&
      countsForStreak(d)
    ) {
      onTimeDays.add(ymd(dt));
    }
  }
  let fromDays = onTimeDays.size;

  // Mois de lancement : plancher « 1 pt / jour écoulé » commun à tous (cf.
  // LAUNCH_GRANT_MONTH). Un plancher, pas un bonus additif → aucun double compte
  // (les jours réellement suivis sont déjà ≤ jours écoulés).
  if (year === LAUNCH_GRANT_MONTH.year && month === LAUNCH_GRANT_MONTH.month) {
    fromDays = Math.max(fromDays, elapsedDaysInMonth(year, month, now));
  }

  const fromChallenges = wonChallenges.reduce((sum, c) => {
    if (c.status !== 'won') return sum;
    const end = new Date(c.week_end);
    if (end.getUTCFullYear() !== year || end.getUTCMonth() !== month - 1) {
      return sum;
    }
    return sum + (c.reward_points ?? 0);
  }, 0);

  return { total: fromDays + fromChallenges, fromDays, fromChallenges };
}

export function isBadgeUnlocked(points: MonthlyPoints): boolean {
  return points.total >= BADGE_THRESHOLD;
}
