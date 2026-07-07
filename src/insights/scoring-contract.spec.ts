import * as fs from 'fs';
import * as path from 'path';
import {
  GRACE_CUTOFF_MINUTES,
  MEAL_POINTS,
  SPORT_POINTS,
} from './insights.scoring';
import { toPrismaScore } from '../days/score-mapper';

// Le barème de score vit en double : foody/src/lib/meal-levels.ts (frontend)
// et insights.scoring.ts (backend). Ce test de contrat casse dès que l'un
// bouge sans l'autre. Il est skippé quand le repo frontend voisin n'est pas
// présent (CI GitHub Actions : un seul repo est checkouté) — il ne protège
// donc qu'en local, là où les modifs de barème se font.
const FRONTEND_ROOT = path.resolve(__dirname, '../../../foody');
const MEAL_LEVELS_PATH = path.join(FRONTEND_ROOT, 'src/lib/meal-levels.ts');
const CATCHUP_HOOK_PATH = path.join(
  FRONTEND_ROOT,
  'src/hooks/useCatchupTarget.ts',
);
const hasFrontend = fs.existsSync(MEAL_LEVELS_PATH);

(hasFrontend ? describe : describe.skip)(
  'contrat de scoring frontend ↔ backend',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const frontend = require(MEAL_LEVELS_PATH) as {
      MEAL_LEVELS: { id: string; points: number }[];
      SPORT_LEVELS: { id: string; pts: number }[];
    };

    it('mêmes points par niveau de repas', () => {
      expect(frontend.MEAL_LEVELS).toHaveLength(
        Object.keys(MEAL_POINTS).length,
      );
      for (const level of frontend.MEAL_LEVELS) {
        const prismaKey = toPrismaScore(level.id);
        expect(prismaKey).not.toBeNull();
        expect(MEAL_POINTS[prismaKey!]).toBe(level.points);
      }
    });

    it('mêmes points par niveau de sport', () => {
      expect(frontend.SPORT_LEVELS).toHaveLength(
        Object.keys(SPORT_POINTS).length,
      );
      for (const level of frontend.SPORT_LEVELS) {
        expect(SPORT_POINTS[level.id]).toBe(level.pts);
      }
    });

    it('même deadline de rattrapage (23h30)', () => {
      const src = fs.readFileSync(CATCHUP_HOOK_PATH, 'utf8');
      const match = src.match(/CATCHUP_DEADLINE_MINUTES = ([^\n]+)/);
      expect(match).toBeTruthy();
      // L'expression est arithmétique pure (« 23 * 60 + 30 ») — on l'évalue
      // pour comparer la valeur, pas le texte.
      // eslint-disable-next-line no-eval
      expect(eval(match![1])).toBe(GRACE_CUTOFF_MINUTES);
    });
  },
);
