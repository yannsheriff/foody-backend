import { Days } from '@prisma/client';
import {
  countsForStreak,
  graceDeadline,
  startOfDay,
  ymd,
} from '../insights/insights.scoring';

// Gel de flamme (économie Phase 3) — fonctions PURES.
//
// Un « pont » (bridge) = un jour manqué couvert par un FreezeConsumption : il
// compte comme on-time dans la flamme (courante ET record), rien d'autre —
// stats, badges et calendrier gardent la réalité.
//
// Règles :
// - dernière ligne de défense : un jour n'est pontable que PAST-GRACE
//   (graceDeadline dépassée) — tant que le catch-up peut le rattraper, on ne
//   consomme rien ;
// - on ne consomme que si le pont AUGMENTE la série courante (jamais de gel
//   brûlé pour rien) ;
// - le gel est une ASSURANCE, pas un raccommodage : il ne couvre qu'un jour
//   perdu pendant qu'il était en réserve (graceDeadline ≥ date d'achat).
//   Sans cette borne, acheter un gel alors que la série courante a un trou
//   ancien à sa frontière le consommait instantanément pour rallonger la
//   flamme vers le passé (bug vécu 23/07/2026, trou du 3 juin) ;
// - 1 gel couvre exactement 1 jour (stock max 1).

/** Jours (ymd UTC) réellement on-time — dédupliqués. */
function onTimeDays(days: Days[]): Set<string> {
  const set = new Set<string>();
  for (const d of days) {
    if (countsForStreak(d)) set.add(ymd(new Date(d.date)));
  }
  return set;
}

function prevYmd(key: string): string {
  const t = Date.parse(`${key}T00:00:00Z`);
  return ymd(new Date(t - 86_400_000));
}

/**
 * Série courante avec ponts : part d'aujourd'hui ou d'hier (jour on-time OU
 * ponté) et descend tant que chaque jour consécutif est on-time ou ponté.
 */
export function currentStreakWithBridges(
  days: Days[],
  bridges: Set<string>,
  now: Date,
): number {
  const onTime = onTimeDays(days);
  const counts = (key: string) => onTime.has(key) || bridges.has(key);

  const today = ymd(startOfDay(now));
  const yesterday = prevYmd(today);
  let cursor: string | null = null;
  if (counts(today)) cursor = today;
  else if (counts(yesterday)) cursor = yesterday;
  if (!cursor) return 0;

  let current = 0;
  while (counts(cursor)) {
    current++;
    cursor = prevYmd(cursor);
  }
  return current;
}

/** Record avec ponts : plus longue suite de jours consécutifs on-time ∪ pontés. */
export function recordStreakWithBridges(
  days: Days[],
  bridges: Set<string>,
): number {
  const all = new Set([...onTimeDays(days), ...bridges]);
  let max = 0;
  for (const key of all) {
    if (all.has(prevYmd(key))) continue; // pas un début de série
    let len = 0;
    let cursor = key;
    while (all.has(cursor)) {
      len++;
      const t = Date.parse(`${cursor}T00:00:00Z`);
      cursor = ymd(new Date(t + 86_400_000));
    }
    if (len > max) max = len;
  }
  return max;
}

/**
 * Le jour manqué qu'un gel en stock devrait couvrir MAINTENANT — ou null.
 * Balaye les ~60 derniers jours : premier jour non couvert, past-grace, perdu
 * APRÈS l'achat du gel (`purchasedAt`), dont le pont augmente la série
 * courante. (Stock max 1 → un seul candidat suffit.)
 */
export function findBridgeCandidate(
  days: Days[],
  bridges: Set<string>,
  stock: number,
  purchasedAt: Date | null,
  now: Date,
): Date | null {
  if (stock <= 0 || !purchasedAt) return null;
  const onTime = onTimeDays(days);
  const base = currentStreakWithBridges(days, bridges, now);
  const todayStart = startOfDay(now);

  for (let offset = 1; offset <= 60; offset++) {
    const day = new Date(todayStart.getTime() - offset * 86_400_000);
    const key = ymd(day);
    if (onTime.has(key) || bridges.has(key)) continue;
    if (now.getTime() <= graceDeadline(day).getTime()) continue; // encore rattrapable
    // Le jour doit avoir été perdu PENDANT que le gel était en réserve : sa
    // fenêtre de rattrapage doit se fermer après l'achat. Un trou déjà
    // consommé avant l'achat reste perdu (« une flamme perdue est perdue »).
    if (graceDeadline(day).getTime() < purchasedAt.getTime()) continue;
    // Le pont doit RACCORDER une vraie série : le jour précédent compte déjà.
    // Sans ça, un pont en queue de chaîne ajouterait « +1 gratuit » — un gel
    // brûlé sans rien relier.
    const before = prevYmd(key);
    if (!onTime.has(before) && !bridges.has(before)) continue;
    const withBridge = currentStreakWithBridges(
      days,
      new Set([...bridges, key]),
      now,
    );
    if (withBridge > base) return day;
  }
  return null;
}
