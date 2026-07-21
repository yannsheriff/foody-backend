import { Injectable } from '@nestjs/common';
import { CoinTransaction, FreezeConsumption } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeRecordStreak } from '../insights/insights.scoring';
import { COIN_GAINS, FLAME_MILESTONES } from './economy.constants';
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
    // Paliers de flamme franchis d'après le record → +15 chacun.
    const record = computeRecordStreak(days);
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
