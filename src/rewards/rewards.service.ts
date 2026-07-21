import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Days, UserBadge, WeeklyChallenge } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BADGES } from '../insights/insights.constants';
import { ymd } from '../insights/insights.scoring';
import {
  ACCESSIBLE_BAND,
  AMBITIOUS_BAND,
  FLAVOR_POINTS,
  WeeklyChallengeDef,
  WeeklyFlavor,
  WeeklyKind,
  weeklyById,
  WEEKLY_CATALOG,
} from './weekly-catalog.constants';
import {
  countQualifyingDays,
  daysLeftInWeek,
  isoWeekOf,
  proratedTarget,
  resolveWeekly,
  weekBounds,
} from './weekly.progress';
import {
  BADGE_THRESHOLD,
  computeMonthlyPoints,
  isBadgeUnlocked,
  MONTHLY_GRACE_DAYS,
} from './monthly-badge';
import {
  badgeIdFor,
  BADGE_FEATURE_LAUNCH,
  seasonForMonth,
  SEASONS,
} from './season.constants';
import {
  AchievementDto,
  ActiveWeeklyDto,
  CollectionDto,
  JustResolvedDto,
  MonthlyBadgeTileDto,
  RewardsDto,
  WeeklyOfferDto,
} from './dto/rewards.dto';

interface RewardsState {
  days: Days[];
  weekly: WeeklyChallenge[];
  badges: UserBadge[];
}

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  // ─── Public API ───────────────────────────────────────────

  async getRewards(userId: number, now: Date = new Date()): Promise<RewardsDto> {
    const state = await this.loadAndSync(userId, now);
    return {
      week: this.buildWeek(userId, state, now),
      month: this.buildMonth(state, now),
    };
  }

  async getCollection(
    userId: number,
    now: Date = new Date(),
  ): Promise<CollectionDto> {
    const state = await this.loadAndSync(userId, now);
    return {
      monthly: this.buildMonthlyTiles(state, now),
      achievements: this.buildAchievements(state),
    };
  }

  // GET /me/badges (Profil) — achievements only, same shape as the legacy route.
  async getBadges(
    userId: number,
    now: Date = new Date(),
  ): Promise<AchievementDto[]> {
    const state = await this.loadAndSync(userId, now);
    return this.buildAchievements(state);
  }

  async selectWeekly(
    userId: number,
    challengeId: string,
    now: Date = new Date(),
  ): Promise<ActiveWeeklyDto> {
    const { weekStart, weekEnd, isoWeek } = weekBounds(now);
    const [days, weekly] = await Promise.all([
      this.prisma.days.findMany({ where: { user_id: userId } }),
      this.prisma.weeklyChallenge.findMany({ where: { user_id: userId } }),
    ]);

    if (weekly.some((w) => w.iso_week === isoWeek)) {
      throw new ConflictException('Un défi est déjà choisi cette semaine');
    }

    const offers = this.generateOffers(userId, isoWeek, weekly, now);
    const match = offers.find((o) => o.def.id === challengeId);
    if (!match) {
      throw new BadRequestException("Ce défi n'est pas proposé cette semaine");
    }

    const target = this.targetFor(match.def, now);
    const row = await this.prisma.weeklyChallenge.create({
      data: {
        user_id: userId,
        iso_week: isoWeek,
        week_start: weekStart,
        week_end: weekEnd,
        challenge_id: match.def.id,
        flavor: match.flavor,
        target,
      },
    });
    return this.toActiveWeekly(row, days, now);
  }

  // ─── Loading + lazy sync ──────────────────────────────────

  private async loadAndSync(
    userId: number,
    now: Date,
  ): Promise<RewardsState> {
    const [days, rawWeekly, rawBadges] = await Promise.all([
      this.prisma.days.findMany({ where: { user_id: userId } }),
      this.prisma.weeklyChallenge.findMany({ where: { user_id: userId } }),
      this.prisma.userBadge.findMany({ where: { user_id: userId } }),
    ]);
    const weekly = await this.resolveElapsed(userId, rawWeekly, days, now);
    const badges = await this.syncBadges(userId, days, weekly, rawBadges, now);
    return { days, weekly, badges };
  }

  // Flip elapsed `active` weeks to won/lost, crediting reward points. Frozen
  // afterwards: editing an old day never revokes a resolved week.
  private async resolveElapsed(
    userId: number,
    weekly: WeeklyChallenge[],
    days: Days[],
    now: Date,
  ): Promise<WeeklyChallenge[]> {
    const out = [...weekly];
    for (const row of weekly) {
      if (row.status !== 'active') continue;
      if (new Date(row.week_end).getTime() >= now.getTime()) continue;
      const def = weeklyById(row.challenge_id);
      if (!def) continue;
      const { won } = resolveWeekly(
        def,
        row.target,
        days,
        new Date(row.week_start),
        new Date(row.week_end),
      );
      const reward = won ? FLAVOR_POINTS[row.flavor as WeeklyFlavor] : null;
      const updated = await this.prisma.weeklyChallenge.update({
        where: { id: row.id },
        data: {
          status: won ? 'won' : 'lost',
          resolved_at: now,
          reward_points: reward,
        },
      });
      out.splice(out.indexOf(row), 1, updated);
    }
    return out;
  }

  // Persist every newly-unlocked badge — monthly (points threshold) AND legacy
  // achievements (backfilled from day history with their real unlock date). This
  // is what guarantees existing users don't lose a badge. Idempotent.
  private async syncBadges(
    userId: number,
    days: Days[],
    weekly: WeeklyChallenge[],
    existing: UserBadge[],
    now: Date,
  ): Promise<UserBadge[]> {
    const have = new Set(existing.map((b) => b.badge_id));
    const toCreate: { badge_id: string; unlocked_at: Date }[] = [];

    // Achievements — historical unlock date so backfill dates are truthful.
    for (const badge of BADGES) {
      if (have.has(badge.id)) continue;
      if (badge.unlock(days)) {
        toCreate.push({
          badge_id: badge.id,
          unlocked_at: badge.unlockedAt(days) ?? now,
        });
      }
    }

    // Monthly — current month always; previous month only within the grace
    // window (so "reached it on the last day, opened the next morning" still
    // counts). Past that, a missed month stays missed forever.
    const won = weekly.filter((w) => w.status === 'won');
    for (const { year, month } of this.monthsToEvaluate(now)) {
      const id = badgeIdFor(year, month);
      if (have.has(id)) continue;
      if (isBadgeUnlocked(computeMonthlyPoints(days, won, year, month, now))) {
        toCreate.push({ badge_id: id, unlocked_at: now });
      }
    }

    const out = [...existing];
    for (const c of toCreate) {
      try {
        const created = await this.prisma.userBadge.create({
          data: { user_id: userId, badge_id: c.badge_id, unlocked_at: c.unlocked_at },
        });
        out.push(created);
      } catch (e) {
        // P2002 = another concurrent read already inserted it — safe to ignore.
        if ((e as { code?: string })?.code !== 'P2002') throw e;
      }
    }
    return out;
  }

  private monthsToEvaluate(now: Date): { year: number; month: number }[] {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const list = [{ year, month }];
    if (now.getUTCDate() <= MONTHLY_GRACE_DAYS) {
      const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
      list.push(prev);
    }
    return list;
  }

  // ─── Offers ───────────────────────────────────────────────

  private generateOffers(
    userId: number,
    isoWeek: string,
    weekly: WeeklyChallenge[],
    now: Date,
  ): { def: WeeklyChallengeDef; flavor: WeeklyFlavor }[] {
    const { weekStart } = weekBounds(now);
    const prevIso = isoWeekOf(new Date(weekStart.getTime() - 1));
    const lastId = weekly.find((w) => w.iso_week === prevIso)?.challenge_id;
    const boosted = seasonForMonth(now.getUTCMonth() + 1).boostedKinds;
    // Weekend needs both Sat and Sun still ahead (feasible only Mon→Fri).
    const weekendFeasible = daysLeftInWeek(now) >= 3;

    const poolFor = (
      band: readonly [number, number],
      excludeKind: WeeklyKind | null,
    ): WeeklyChallengeDef[] => {
      let pool = WEEKLY_CATALOG.filter(
        (c) => c.rating >= band[0] && c.rating <= band[1] && c.id !== lastId,
      );
      if (!weekendFeasible) pool = pool.filter((c) => c.kind !== 'weekend');
      if (excludeKind) pool = pool.filter((c) => c.kind !== excludeKind);
      return pool;
    };
    const pick = (pool: WeeklyChallengeDef[], salt: string): WeeklyChallengeDef => {
      // Prefer the season's themed families, fall back to the whole pool.
      const themed = pool.filter((c) => boosted.includes(c.kind));
      const chosen = themed.length ? themed : pool;
      return chosen[hashSeed(`${userId}:${isoWeek}:${salt}`) % chosen.length];
    };

    const accessible = pick(poolFor(ACCESSIBLE_BAND, null), 'accessible');
    // The ambitious offer must be a DIFFERENT family than the accessible one —
    // a real choice, pas « 3 vs 6 jours du même défi ».
    let ambitiousPool = poolFor(AMBITIOUS_BAND, accessible.kind);
    if (ambitiousPool.length === 0) ambitiousPool = poolFor(AMBITIOUS_BAND, null);
    const ambitious = pick(ambitiousPool, 'ambitious');

    return [
      { def: accessible, flavor: 'accessible' },
      { def: ambitious, flavor: 'ambitious' },
    ];
  }

  private targetFor(def: WeeklyChallengeDef, now: Date): number {
    // Weekend is binary (total 1) — never prorated.
    if (def.kind === 'weekend') return def.total;
    return proratedTarget(def.total, daysLeftInWeek(now));
  }

  // ─── Builders ─────────────────────────────────────────────

  // Most recently resolved (won/lost) challenge — feeds the win celebration.
  private latestResolved(weekly: WeeklyChallenge[]): WeeklyChallenge | null {
    const resolved = weekly.filter(
      (w) => w.status === 'won' || w.status === 'lost',
    );
    if (resolved.length === 0) return null;
    return resolved.reduce((a, b) =>
      new Date(b.week_end).getTime() > new Date(a.week_end).getTime() ? b : a,
    );
  }

  private toJustResolved(row: WeeklyChallenge): JustResolvedDto {
    const def = weeklyById(row.challenge_id);
    return {
      challengeId: row.challenge_id,
      title: def?.title ?? row.challenge_id,
      emoji: def?.emoji ?? '🏅',
      flavor: row.flavor,
      isoWeek: row.iso_week,
      won: row.status === 'won',
      rewardPoints: row.reward_points ?? 0,
      target: row.target,
    };
  }

  private buildWeek(userId: number, state: RewardsState, now: Date) {
    const { isoWeek } = weekBounds(now);
    const daysLeft = daysLeftInWeek(now);
    const jr = this.latestResolved(state.weekly);
    const justResolved = jr ? this.toJustResolved(jr) : null;
    const current =
      state.weekly.find((w) => w.iso_week === isoWeek && w.status === 'active') ??
      null;

    if (current) {
      return {
        challenge: this.toActiveWeekly(current, state.days, now),
        offers: null,
        isoWeek,
        daysLeft,
        justResolved,
      };
    }
    const offers: WeeklyOfferDto[] = this.generateOffers(
      userId,
      isoWeek,
      state.weekly,
      now,
    ).map(({ def, flavor }) => ({
      id: def.id,
      emoji: def.emoji,
      title: def.title,
      description: def.description ?? null,
      kind: def.kindLabel,
      kindId: def.kind,
      flavor,
      target: this.targetFor(def, now),
      rewardPoints: FLAVOR_POINTS[flavor],
    }));
    return { challenge: null, offers, isoWeek, daysLeft, justResolved };
  }

  private buildMonth(state: RewardsState, now: Date) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const won = state.weekly.filter((w) => w.status === 'won');
    const points = computeMonthlyPoints(state.days, won, year, month, now);
    const season = seasonForMonth(month);
    const id = badgeIdFor(year, month);
    return {
      points: points.total,
      threshold: BADGE_THRESHOLD,
      fromDays: points.fromDays,
      fromChallenges: points.fromChallenges,
      badge: {
        id,
        title: season.title,
        emoji: season.emoji,
        unlocked: state.badges.some((b) => b.badge_id === id),
      },
    };
  }

  private buildMonthlyTiles(
    state: RewardsState,
    now: Date,
  ): MonthlyBadgeTileDto[] {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const byId = new Map(state.badges.map((b) => [b.badge_id, b]));
    // Ne montrer que les mois qui ont pu exister : après le lancement de la
    // feature ET après l'arrivée de l'utilisateur (les mois d'avant n'ont jamais
    // été gagnables → pas de tuile « ratée » factice pour janvier-juin 2026).
    const launchAbs = BADGE_FEATURE_LAUNCH.year * 12 + BADGE_FEATURE_LAUNCH.month;
    let userAbs = year * 12 + month;
    for (const d of state.days) {
      const dt = new Date(d.date);
      const abs = dt.getUTCFullYear() * 12 + dt.getUTCMonth() + 1;
      if (abs < userAbs) userAbs = abs;
    }
    const floorAbs = Math.max(launchAbs, userAbs);
    return SEASONS.filter((s) => year * 12 + s.month >= floorAbs).map((s) => {
      const id = badgeIdFor(year, s.month);
      const ub = byId.get(id);
      const state_: MonthlyBadgeTileDto['state'] = ub
        ? 'got'
        : s.month === month
          ? 'current'
          : s.month < month
            ? 'missed'
            : 'future';
      return {
        id,
        month: s.month,
        title: s.title,
        emoji: s.emoji,
        description: s.description,
        state: state_,
        unlockedAt: ub ? ymd(ub.unlocked_at) : null,
      };
    });
  }

  private buildAchievements(state: RewardsState): AchievementDto[] {
    const byId = new Map(state.badges.map((b) => [b.badge_id, b]));
    return BADGES.map((b) => {
      const ub = byId.get(b.id);
      const at = ub ? ub.unlocked_at : b.unlockedAt(state.days);
      return {
        id: b.id,
        title: b.title,
        emoji: b.emoji,
        unlocked: !!ub || b.unlock(state.days),
        description: b.description,
        prog: b.progress(state.days),
        total: b.total,
        unlockedAt: at ? ymd(at) : null,
      };
    });
  }

  private toActiveWeekly(
    row: WeeklyChallenge,
    days: Days[],
    now: Date,
  ): ActiveWeeklyDto {
    const def = weeklyById(row.challenge_id);
    if (!def) throw new BadRequestException('Défi hebdo introuvable');
    const flavor = row.flavor as WeeklyFlavor;
    const prog = countQualifyingDays(
      def,
      days,
      new Date(row.week_start),
      new Date(row.week_end),
      now,
    );
    return {
      id: def.id,
      emoji: def.emoji,
      title: def.title,
      description: def.description ?? null,
      kind: def.kindLabel,
      kindId: def.kind,
      flavor,
      prog,
      target: row.target,
      rewardPoints: FLAVOR_POINTS[flavor],
      status: row.status,
      startedAt: row.started_at.toISOString(),
    };
  }
}

// Deterministic non-negative hash so a user's two weekly offers are stable for
// the whole week (no persisted offer row needed).
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
