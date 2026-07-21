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

export interface MonthlyPoints {
  total: number;
  fromDays: number; // +1 per on-time day in the month
  fromChallenges: number; // Σ reward_points of weekly challenges won that month
}

// month is 1..12. On-time days are deduped by UTC calendar day; a weekly
// challenge's points count toward the month in which its week ENDS (Sunday UTC).
export function computeMonthlyPoints(
  days: Days[],
  wonChallenges: WeeklyChallenge[],
  year: number,
  month: number,
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
  const fromDays = onTimeDays.size;

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
