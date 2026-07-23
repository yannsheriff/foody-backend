import { CoinTransaction, Days, FreezeConsumption } from '@prisma/client';

// Fonctions pures — le solde et les stocks sont TOUJOURS dérivés du ledger,
// jamais stockés (RAZ impossible, auditable).

/** Solde = somme signée des transactions (crédits > 0, achats < 0). */
export function computeBalance(txns: CoinTransaction[]): number {
  return txns.reduce((sum, t) => sum + t.amount, 0);
}

/** Gels en réserve = achats de gel − consommations (jamais négatif). */
export function freezeStock(
  txns: CoinTransaction[],
  consumptions: FreezeConsumption[],
): number {
  const bought = txns.filter((t) => t.reason === 'buy_freeze').length;
  return Math.max(0, bought - consumptions.length);
}

/**
 * Date d'achat du gel actuellement en réserve — null si aucun. Appariement
 * FIFO : la (n+1)ᵉ consommation use le (n+1)ᵉ achat. Sert à borner le pont :
 * un gel ne peut couvrir qu'un jour perdu PENDANT qu'il était en réserve
 * (jamais un trou antérieur à l'achat — bug vécu 23/07/2026 : un gel acheté
 * en juillet s'était consommé sur un trou du 3 juin, en début de série).
 */
export function activeFreezePurchasedAt(
  txns: CoinTransaction[],
  consumptions: FreezeConsumption[],
): Date | null {
  const buys = txns
    .filter((t) => t.reason === 'buy_freeze')
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  const next = buys[consumptions.length];
  return next ? next.created_at : null;
}

/**
 * Cheat meals en réserve = achats − usages. Un usage = un jour réparé
 * (`cheat_slot` posé) — dérivé des jours, pas de table dédiée.
 */
export function cheatMealStock(txns: CoinTransaction[], days: Days[]): number {
  const bought = txns.filter((t) => t.reason === 'buy_cheat_meal').length;
  const used = days.filter((d) => d.cheat_slot != null).length;
  return Math.max(0, bought - used);
}
