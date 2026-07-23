import { WeeklyChallenge } from '@prisma/client';
import { isoWeekOf, weekBounds } from './weekly.progress';

// ELO adaptatif (Phase 4) — fonctions PURES. Jamais affiché, jamais stocké :
// le niveau est REJOUÉ depuis l'historique des défis hebdo (déterministe,
// recalculable, backfill gratuit pour les comptes existants).
//
// Philosophie (décision produit) : proposer des défis TOUJOURS FAISABLES —
// montée lente, descente rapide (l'inverse d'un ELO classique). Dès qu'un
// défi échoue on repropose plus facile ; la difficulté grimpe par petits pas.

export const ELO_START = 1000; // départ au plancher : les défis les plus doux
export const ELO_MIN = 1000;
export const ELO_MAX = 1900; // haut du catalogue
export const ELO_WIN_ACCESSIBLE = 25; // ~2 semaines pour monter d'un cran
export const ELO_WIN_AMBITIOUS = 50; // la prise de risque paie double
export const ELO_LOSS = 50; // un échec ramène tout de suite au faisable
export const ELO_DECAY = 25; // érosion par semaine sans défi choisi

// Bandes d'offres autour du niveau N (remplacent les bandes statiques).
export const ACCESSIBLE_OFFSET: readonly [number, number] = [-150, 0];
export const AMBITIOUS_OFFSET: readonly [number, number] = [0, 150];

function clamp(v: number): number {
  return Math.min(ELO_MAX, Math.max(ELO_MIN, v));
}

/**
 * Rejoue l'historique semaine par semaine, de la première semaine jouée à la
 * dernière semaine RÉVOLUE (la semaine courante ne compte pas — elle n'est pas
 * finie) : won accessible +25, won ambitieux +50, lost −50, semaine sans défi
 * choisi −25. Clamp [1000, 1900] à chaque pas. Une row `active` d'une semaine
 * écoulée (pas encore résolue en lazy) est neutre.
 */
export function computeElo(weekly: WeeklyChallenge[], now: Date): number {
  const byIso = new Map<string, WeeklyChallenge>();
  let firstStart: Date | null = null;
  for (const w of weekly) {
    byIso.set(w.iso_week, w);
    const start = new Date(w.week_start);
    if (!firstStart || start < firstStart) firstStart = start;
  }
  if (!firstStart) return ELO_START;

  const currentIso = isoWeekOf(now);
  let elo = ELO_START;
  // Itère les lundis UTC depuis la première semaine jouée.
  let cursor = weekBounds(firstStart).weekStart;
  for (let guard = 0; guard < 520; guard++) {
    const iso = isoWeekOf(cursor);
    if (iso === currentIso) break; // semaine en cours : rien
    const w = byIso.get(iso);
    if (!w) {
      elo = clamp(elo - ELO_DECAY);
    } else if (w.status === 'won') {
      elo = clamp(
        elo +
          (w.flavor === 'ambitious' ? ELO_WIN_AMBITIOUS : ELO_WIN_ACCESSIBLE),
      );
    } else if (w.status === 'lost') {
      elo = clamp(elo - ELO_LOSS);
    }
    // `active` non résolue (ne devrait pas exister après loadAndSync) : neutre.
    cursor = new Date(cursor.getTime() + 7 * 86_400_000);
  }
  return elo;
}
