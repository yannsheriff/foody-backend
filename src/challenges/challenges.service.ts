import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Days, UserChallenge } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ymd } from '../insights/insights.scoring';
import {
  ChallengeDef,
  LEVELS,
  REQUIRED_PER_LEVEL,
  challengeById,
  challengesForLevel,
} from './challenges.constants';
import { computeChallengeProgress, leftLabel } from './challenges.progress';
import {
  AbandonResultDto,
  ActiveChallengeDto,
  ChallengeItemDto,
  ChallengeLevelDto,
  ChallengesHubDto,
} from './dto/challenges.dto';

interface ChallengeState {
  days: Days[];
  rows: UserChallenge[];
  active: UserChallenge | null;
  completedAt: Map<string, Date>;
}

@Injectable()
export class ChallengesService {
  constructor(private prisma: PrismaService) {}

  async getHub(userId: number): Promise<ChallengesHubDto> {
    const state = await this.loadState(userId);
    const currentLevel = this.currentLevel(state.completedAt);

    const levels: ChallengeLevelDto[] = LEVELS.map((lvl) => {
      const defs = challengesForLevel(lvl.n);
      const levelDone = this.isLevelDone(defs, state.completedAt);
      const levelState: ChallengeLevelDto['state'] = levelDone
        ? 'done'
        : lvl.n === currentLevel
          ? 'current'
          : 'locked';
      return {
        n: lvl.n,
        emoji: lvl.emoji,
        short: lvl.short,
        title: lvl.title,
        tagline: lvl.tagline,
        state: levelState,
        required: REQUIRED_PER_LEVEL,
        items: defs.map((def) => this.toItem(def, levelState, state)),
      };
    });

    return {
      active: state.active ? this.toActiveDto(state.active, state.days) : null,
      levels,
    };
  }

  async start(userId: number, id: string): Promise<ActiveChallengeDto> {
    const def = challengeById(id);
    if (!def) throw new NotFoundException('Défi introuvable');

    const state = await this.loadState(userId);
    if (state.completedAt.has(id)) {
      throw new ConflictException('Défi déjà relevé');
    }
    // Démarrable : niveau en cours, ou niveau déjà validé (les défis restants
    // d'un niveau bouclé restent disponibles en bonus).
    const unlocked =
      def.level === this.currentLevel(state.completedAt) ||
      this.isLevelDone(challengesForLevel(def.level), state.completedAt);
    if (!unlocked) {
      throw new ConflictException('Niveau verrouillé');
    }
    if (state.active) {
      throw new ConflictException('Un défi est déjà en cours');
    }

    const row = await this.prisma.userChallenge.create({
      data: { user_id: userId, challenge_id: id },
    });
    return this.toActiveDto(row, state.days);
  }

  async abandon(userId: number, id: string): Promise<AbandonResultDto> {
    const state = await this.loadState(userId);
    const row = state.active?.challenge_id === id ? state.active : null;
    if (!row) throw new NotFoundException('Aucun défi en cours avec cet id');

    await this.prisma.userChallenge.update({
      where: { id: row.id },
      data: { status: 'abandoned' },
    });
    return { ok: true };
  }

  // Loads days + challenge rows and lazily flips the active row to completed
  // when its target is reached. Once persisted, completion is frozen: later
  // edits to old days can never revoke a défi relevé.
  private async loadState(userId: number): Promise<ChallengeState> {
    const [days, rows] = await Promise.all([
      this.prisma.days.findMany({ where: { user_id: userId } }),
      this.prisma.userChallenge.findMany({ where: { user_id: userId } }),
    ]);

    let active = rows.find((r) => r.status === 'active') ?? null;
    if (active) {
      const def = challengeById(active.challenge_id);
      if (def) {
        const { done } = computeChallengeProgress(def, days, active.started_at);
        if (done) {
          const completed = await this.prisma.userChallenge.update({
            where: { id: active.id },
            data: { status: 'completed', completed_at: new Date() },
          });
          rows.splice(rows.indexOf(active), 1, completed);
          active = null;
        }
      }
    }

    const completedAt = new Map<string, Date>();
    for (const r of rows) {
      if (r.status === 'completed' && r.completed_at) {
        completedAt.set(r.challenge_id, r.completed_at);
      }
    }
    return { days, rows, active, completedAt };
  }

  // Un niveau est validé avec REQUIRED_PER_LEVEL défis relevés parmi ceux
  // proposés (min avec la taille du niveau par sécurité).
  private isLevelDone(
    defs: ChallengeDef[],
    completedAt: Map<string, Date>,
  ): boolean {
    const done = defs.filter((d) => completedAt.has(d.id)).length;
    return done >= Math.min(REQUIRED_PER_LEVEL, defs.length);
  }

  // The single unlocked-but-unfinished level; null once every level is done.
  private currentLevel(completedAt: Map<string, Date>): number | null {
    for (const lvl of LEVELS) {
      if (!this.isLevelDone(challengesForLevel(lvl.n), completedAt)) {
        return lvl.n;
      }
    }
    return null;
  }

  private toItem(
    def: ChallengeDef,
    levelState: ChallengeLevelDto['state'],
    state: ChallengeState,
  ): ChallengeItemDto {
    const base = {
      id: def.id,
      emoji: def.emoji,
      title: def.title,
      kind: def.kindLabel,
      kindId: def.kind,
      goal: def.goal,
      total: def.total,
      minScore: def.minScore,
      windowDays: def.windowDays,
    };
    const completed = state.completedAt.get(def.id);
    if (completed) {
      return { ...base, state: 'done', completedAt: ymd(completed) };
    }
    if (state.active?.challenge_id === def.id) {
      const { prog } = computeChallengeProgress(
        def,
        state.days,
        state.active.started_at,
      );
      return { ...base, state: 'active', prog, left: leftLabel(def, prog) };
    }
    return { ...base, state: levelState === 'locked' ? 'locked' : 'todo' };
  }

  private toActiveDto(row: UserChallenge, days: Days[]): ActiveChallengeDto {
    const def = challengeById(row.challenge_id);
    if (!def) throw new NotFoundException('Défi introuvable');
    const { prog } = computeChallengeProgress(def, days, row.started_at);
    return {
      id: def.id,
      emoji: def.emoji,
      title: def.title,
      kind: def.kindLabel,
      kindId: def.kind,
      goal: def.goal,
      level: def.level,
      prog,
      total: def.total,
      left: leftLabel(def, prog),
      startedAt: row.started_at.toISOString(),
    };
  }
}
