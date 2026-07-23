import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

// ─── Input ──────────────────────────────────────────────────

export class SetIntentionDto {
  @ApiProperty({
    enum: ['lose', 'maintain', 'aware', 'snack'],
    description: "Intention d'onboarding — pondère le tirage des défis",
  })
  @IsIn(['lose', 'maintain', 'aware', 'snack'])
  intention!: 'lose' | 'maintain' | 'aware' | 'snack';
}
export class SelectWeeklyDto {
  @ApiProperty({
    description: 'Id du défi hebdo choisi (une des 2 offres)',
    example: 'w-soir-3',
  })
  @IsString()
  challengeId!: string;
}

// ─── Weekly section ─────────────────────────────────────────
export class ActiveWeeklyDto {
  @ApiProperty({ example: 'w-soir-3' }) id!: string;
  @ApiProperty({ example: '🌙' }) emoji!: string;
  @ApiProperty({ example: '3 dîners légers cette semaine' }) title!: string;
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Critères explicités (affichés sous le titre)',
  })
  description?: string | null;
  @ApiProperty({ description: 'Libellé de famille', example: 'Dîner' })
  kind!: string;
  @ApiProperty({
    description: 'Id technique de famille',
    example: 'soir-leger',
  })
  kindId!: string;
  @ApiProperty({ enum: ['accessible', 'ambitious'], example: 'ambitious' })
  flavor!: string;
  @ApiProperty({ description: 'Jours qualifiants ce jour', example: 2 })
  prog!: number;
  @ApiProperty({ description: 'Objectif (proraté au choix)', example: 3 })
  target!: number;
  @ApiProperty({ description: 'Points si gagné dimanche', example: 10 })
  rewardPoints!: number;
  @ApiProperty({ enum: ['active', 'won', 'lost'], example: 'active' })
  status!: string;
  @ApiProperty({ example: '2026-07-20T08:00:00.000Z' }) startedAt!: string;
}

export class WeeklyOfferDto {
  @ApiProperty({ example: 'w-soir-3' }) id!: string;
  @ApiProperty({ example: '🌙' }) emoji!: string;
  @ApiProperty({ example: '3 dîners légers cette semaine' }) title!: string;
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Critères explicités (affichés sous le titre)',
  })
  description?: string | null;
  @ApiProperty({ example: 'Dîner' }) kind!: string;
  @ApiProperty({ example: 'soir-leger' }) kindId!: string;
  @ApiProperty({ enum: ['accessible', 'ambitious'], example: 'accessible' })
  flavor!: string;
  @ApiProperty({
    description: 'Objectif si choisi maintenant (proraté)',
    example: 3,
  })
  target!: number;
  @ApiProperty({ example: 5 }) rewardPoints!: number;
}

export class JustResolvedDto {
  @ApiProperty({ example: 'w-soir-3' }) challengeId!: string;
  @ApiProperty({ example: '3 dîners légers cette semaine' }) title!: string;
  @ApiProperty({ example: '🌙' }) emoji!: string;
  @ApiProperty({ enum: ['accessible', 'ambitious'] }) flavor!: string;
  @ApiProperty({ example: '2026-W29' }) isoWeek!: string;
  @ApiProperty({ description: 'Gagné (true) ou raté (false)', example: true })
  won!: boolean;
  @ApiProperty({ description: 'Points crédités si gagné', example: 10 })
  rewardPoints!: number;
  @ApiProperty({ example: 3 }) target!: number;
}

export class WeekSectionDto {
  @ApiProperty({
    type: ActiveWeeklyDto,
    nullable: true,
    description: 'Le défi choisi cette semaine, ou null',
  })
  challenge!: ActiveWeeklyDto | null;
  @ApiProperty({
    type: [WeeklyOfferDto],
    nullable: true,
    description: 'Les 2 offres si pas encore choisi, sinon null',
  })
  offers!: WeeklyOfferDto[] | null;
  @ApiProperty({ example: '2026-W30' }) isoWeek!: string;
  @ApiProperty({
    description: 'Jours restants (aujourd’hui inclus)',
    example: 4,
  })
  daysLeft!: number;
  @ApiProperty({
    type: JustResolvedDto,
    nullable: true,
    description: 'Dernier défi résolu (célébration), ou null',
  })
  justResolved!: JustResolvedDto | null;
}

// ─── Month section ──────────────────────────────────────────
export class MonthlyBadgeRefDto {
  @ApiProperty({ example: 'season-2026-07' }) id!: string;
  @ApiProperty({ example: 'À l’ombre des tilleuls' }) title!: string;
  @ApiProperty({ example: '🌳' }) emoji!: string;
  @ApiProperty({ example: false }) unlocked!: boolean;
}

export class MonthSectionDto {
  @ApiProperty({ example: 22 }) points!: number;
  @ApiProperty({ example: 35 }) threshold!: number;
  @ApiProperty({ description: 'Points venant de l’assiduité', example: 14 })
  fromDays!: number;
  @ApiProperty({ description: 'Points venant des défis', example: 8 })
  fromChallenges!: number;
  @ApiProperty({ type: MonthlyBadgeRefDto }) badge!: MonthlyBadgeRefDto;
}

export class RewardsDto {
  @ApiProperty({ type: WeekSectionDto }) week!: WeekSectionDto;
  @ApiProperty({ type: MonthSectionDto }) month!: MonthSectionDto;
}

// ─── Collection ─────────────────────────────────────────────
export class MonthlyBadgeTileDto {
  @ApiProperty({ example: 'season-2026-07' }) id!: string;
  @ApiProperty({ example: 7 }) month!: number;
  @ApiProperty({ example: 'À l’ombre des tilleuls' }) title!: string;
  @ApiProperty({ example: '🌳' }) emoji!: string;
  @ApiProperty({
    example: 'Le badge de juillet. Tenir le cap sous la chaleur.',
  })
  description!: string;
  @ApiProperty({
    enum: ['got', 'current', 'missed', 'future'],
    example: 'current',
  })
  state!: string;
  @ApiProperty({ nullable: true, example: null }) unlockedAt!: string | null;
}

// Also the shape returned by GET /me/badges (profil) — kept identical to the
// legacy BadgeDto so the frontend Profil is untouched.
export class AchievementDto {
  @ApiProperty({ example: 'constance' }) id!: string;
  @ApiProperty({ example: 'Constance' }) title!: string;
  @ApiProperty({ example: '🔥' }) emoji!: string;
  @ApiProperty({ example: false }) unlocked!: boolean;
  @ApiProperty({ example: 'Une flamme de 7 jours.' }) description!: string;
  @ApiProperty({ example: 3 }) prog!: number;
  @ApiProperty({ example: 7 }) total!: number;
  @ApiProperty({ nullable: true, example: null }) unlockedAt!: string | null;
}

export class CollectionDto {
  @ApiProperty({ type: [MonthlyBadgeTileDto] }) monthly!: MonthlyBadgeTileDto[];
  @ApiProperty({ type: [AchievementDto] }) achievements!: AchievementDto[];
}
