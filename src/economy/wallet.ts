import { CoinTransaction, FreezeConsumption } from '@prisma/client';

// Fonctions pures — le solde et le stock sont TOUJOURS dérivés du ledger, jamais
// stockés (RAZ impossible, auditable).

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
