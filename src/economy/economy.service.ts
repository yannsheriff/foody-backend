import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CoinTransaction, Days, FreezeConsumption } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { startOfDay, ymd } from '../insights/insights.scoring';
import { recordStreakWithBridges } from './freeze.progress';
import {
  COIN_GAINS,
  FLAME_MILESTONES,
  MAX_FREEZE_STOCK,
  SHOP_PRICES,
} from './economy.constants';
import { computeBalance, freezeStock } from './wallet';
import { WalletDto } from './dto/wallet.dto';

interface ExpectedCredit {
  reason: string;
  ref: string;
  amount: number;
}

export interface EconomyState {
  txns: CoinTransaction[];
  consumptions: FreezeConsumption[];
  balance: number;
  freezeStock: number;
}

@Injectable()
export class EconomyService {
  constructor(private prisma: PrismaService) {}

  async getWallet(userId: number): Promise<WalletDto> {
    const state = await this.loadAndSync(userId);
    return { balance: state.balance, freezeStock: state.freezeStock };
  }

  // ─── Boutique (achats) ───────────────────────────────────────

  /** Achète un gel de flamme (max 1 en réserve). Débite 70 🪙. */
  async buyFreeze(userId: number): Promise<WalletDto> {
    const state = await this.loadAndSync(userId);
    if (state.freezeStock >= MAX_FREEZE_STOCK) {
      throw new ConflictException('Tu as déjà un gel en réserve');
    }
    if (state.balance < SHOP_PRICES.freeze) {
      throw new BadRequestException('Solde insuffisant');
    }
    await this.prisma.coinTransaction.create({
      data: {
        user_id: userId,
        amount: -SHOP_PRICES.freeze,
        reason: 'buy_freeze',
        ref: new Date().toISOString(), // un achat = une ligne unique
      },
    });
    return this.getWallet(userId);
  }

  /**
   * Achète-et-applique un cheat meal sur la journée EN COURS, sur le créneau
   * choisi (qui doit être un repas lourd non encore réparé). Débite 25 🪙 et
   * pose Days.cheat_slot (le scoring le compte alors comme un « normal »).
   */
  async buyCheatMeal(
    userId: number,
    slot: 'morning' | 'afternoon' | 'evening',
    now: Date = new Date(),
  ): Promise<WalletDto> {
    const todayKey = ymd(startOfDay(now));
    const days = await this.prisma.days.findMany({ where: { user_id: userId } });
    const today = days.find((d) => ymd(new Date(d.date)) === todayKey);
    if (!today) {
      throw new BadRequestException("Aucune journée à réparer aujourd'hui");
    }
    if (today.cheat_slot) {
      throw new BadRequestException('Un repas est déjà réparé aujourd’hui');
    }
    const score = this.slotScore(today, slot);
    if (score !== 'copieux' && score !== 'tresCopieux') {
      throw new BadRequestException("Ce repas n'est pas lourd");
    }
    const state = await this.loadAndSync(userId);
    if (state.balance < SHOP_PRICES.cheatMeal) {
      throw new BadRequestException('Solde insuffisant');
    }
    // Débit + pose du cheat, atomiques. ref = le jour → un seul cheat / jour.
    try {
      await this.prisma.$transaction([
        this.prisma.coinTransaction.create({
          data: {
            user_id: userId,
            amount: -SHOP_PRICES.cheatMeal,
            reason: 'buy_cheat_meal',
            ref: todayKey,
          },
        }),
        this.prisma.days.update({
          where: { id: today.id },
          data: { cheat_slot: slot },
        }),
      ]);
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new BadRequestException('Un repas est déjà réparé aujourd’hui');
      }
      throw e;
    }
    return this.getWallet(userId);
  }

  private slotScore(day: Days, slot: string): string | null {
    if (slot === 'morning') return day.morning_score;
    if (slot === 'afternoon') return day.afternoon_score;
    return day.evening_score;
  }

  // ─── Gel de flamme (consommation & feedback) ─────────────────

  /**
   * Persiste la consommation d'un gel pour couvrir `day` (appelé par le calcul
   * de flamme quand un jour manqué past-grace est pontable). Idempotent :
   * l'unique (user, day) absorbe les lectures concurrentes.
   */
  async consumeFreeze(userId: number, day: Date): Promise<void> {
    try {
      await this.prisma.freezeConsumption.create({
        data: { user_id: userId, day: startOfDay(day) },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e;
    }
  }

  /** La conso non encore vue la plus récente (pilote l'interstitiel). */
  async unseenFreeze(
    userId: number,
  ): Promise<{ day: string; consumedAt: Date } | null> {
    const rows = await this.prisma.freezeConsumption.findMany({
      where: { user_id: userId, seen: false },
      orderBy: { consumed_at: 'desc' },
      take: 1,
    });
    if (rows.length === 0) return null;
    return { day: ymd(new Date(rows[0].day)), consumedAt: rows[0].consumed_at };
  }

  /** Marque toutes les consos comme vues (dismiss de l'interstitiel). */
  async ackFreeze(userId: number): Promise<{ ok: true }> {
    await this.prisma.freezeConsumption.updateMany({
      where: { user_id: userId, seen: false },
      data: { seen: true },
    });
    return { ok: true };
  }

  // Crédite en lazy (idempotent) tous les gains d'« exploits », comme le
  // unlock/backfill des badges : un utilisateur existant touche rétroactivement
  // ses défis gagnés, badges mensuels, paliers de flamme et la bienvenue à son
  // 1er passage. Les débits (achats) sont créés ailleurs, à l'acte.
  async loadAndSync(userId: number): Promise<EconomyState> {
    const [weekly, badges, days, existing, consumptions] = await Promise.all([
      this.prisma.weeklyChallenge.findMany({ where: { user_id: userId } }),
      this.prisma.userBadge.findMany({ where: { user_id: userId } }),
      this.prisma.days.findMany({ where: { user_id: userId } }),
      this.prisma.coinTransaction.findMany({ where: { user_id: userId } }),
      this.prisma.freezeConsumption.findMany({ where: { user_id: userId } }),
    ]);

    const expected: ExpectedCredit[] = [];

    // Défis gagnés → +15 / +25 selon le cran.
    for (const w of weekly) {
      if (w.status !== 'won') continue;
      expected.push({
        reason: 'challenge_won',
        ref: String(w.id),
        amount:
          w.flavor === 'ambitious'
            ? COIN_GAINS.challengeAmbitious
            : COIN_GAINS.challengeAccessible,
      });
    }
    // Badges MENSUELS uniquement (season-*) → +25. Les accomplissements ne
    // rapportent pas de pièces (décision cadrage).
    for (const b of badges) {
      if (!b.badge_id.startsWith('season-')) continue;
      expected.push({
        reason: 'monthly_badge',
        ref: b.badge_id,
        amount: COIN_GAINS.monthlyBadge,
      });
    }
    // Paliers de flamme franchis d'après le record → +15 chacun. Les jours
    // pontés par un gel comptent (la série a tenu).
    const record = recordStreakWithBridges(
      days,
      new Set(consumptions.map((c) => ymd(new Date(c.day)))),
    );
    for (const m of FLAME_MILESTONES) {
      if (record >= m) {
        expected.push({
          reason: 'flame_milestone',
          ref: `milestone-${m}`,
          amount: COIN_GAINS.flameMilestone,
        });
      }
    }
    // Bienvenue — une fois.
    expected.push({ reason: 'welcome', ref: 'welcome', amount: COIN_GAINS.welcome });

    // Insère les crédits manquants (idempotent via @@unique(user, reason, ref)).
    const have = new Set(existing.map((t) => `${t.reason}:${t.ref}`));
    const txns = [...existing];
    for (const c of expected) {
      if (have.has(`${c.reason}:${c.ref}`)) continue;
      try {
        const created = await this.prisma.coinTransaction.create({
          data: {
            user_id: userId,
            amount: c.amount,
            reason: c.reason,
            ref: c.ref,
          },
        });
        txns.push(created);
      } catch (e) {
        // P2002 = une lecture concurrente a déjà inséré ce crédit — on ignore.
        if ((e as { code?: string }).code !== 'P2002') throw e;
      }
    }

    return {
      txns,
      consumptions,
      balance: computeBalance(txns),
      freezeStock: freezeStock(txns, consumptions),
    };
  }
}
