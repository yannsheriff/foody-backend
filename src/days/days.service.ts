import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDayDto } from './dto/create-day.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { Days, SportLevel } from '@prisma/client';
import { DayWire, toPrismaScore, toWire } from './score-mapper';

// Legacy `sport` boolean is a derived mirror of sport_level: a real session
// (normal/intense) is "sport done", repos/null is not.
function sportBool(level: SportLevel | null | undefined): boolean {
  return level === 'normal' || level === 'intense';
}

@Injectable()
export class DaysService {
  constructor(private prisma: PrismaService) {}

  async createDay(data: CreateDayDto): Promise<DayWire> {
    // Idempotent per user per calendar day: if a row already covers that day,
    // the provided fields are merged into it (same rules as PATCH) instead of
    // creating a duplicate — a stale client-side lookup must not fork the day.
    const date = data.date ? new Date(data.date) : new Date();
    const existing = await this.findDayInUtcWindow(data.user_id, date);
    if (existing) return this.update(existing.id, data);
    try {
      return await this.insertDay(data, date);
    } catch (e) {
      // days_one_per_user_day: a concurrent create won the race — merge into it.
      if ((e as { code?: string }).code !== 'P2002') throw e;
      const winner = await this.findDayInUtcWindow(data.user_id, date);
      if (!winner) throw e;
      return this.update(winner.id, data);
    }
  }

  private async insertDay(data: CreateDayDto, date: Date): Promise<DayWire> {
    const morning = toPrismaScore(data.morning_score ?? null);
    const afternoon = toPrismaScore(data.afternoon_score ?? null);
    const evening = toPrismaScore(data.evening_score ?? null);
    // sport_level is the source of truth; fall back to the legacy boolean.
    const sportLevel = data.sport_level ?? (data.sport ? 'normal' : null);
    const created = await this.prisma.days.create({
      data: {
        user_id: data.user_id,
        morning_score: morning,
        afternoon_score: afternoon,
        evening_score: evening,
        snack: data.snack ?? null,
        sport_level: sportLevel,
        sport: sportBool(sportLevel),
        sport_type: data.sport_type ?? null,
        date,
        // Stamped at write time; lateness vs the day's own date is judged at
        // read time (countsForStreak), so a backfilled day is excluded there.
        ...(morning != null &&
          afternoon != null &&
          evening != null && { meals_completed_at: new Date() }),
      },
    });
    return toWire(created);
  }

  // The window is UTC-based to match the days_one_per_user_day unique index
  // (date_trunc on a tz-less timestamp). orderBy keeps the pick deterministic
  // for legacy duplicates that predate the index.
  private findDayInUtcWindow(userId: number, date: Date): Promise<Days | null> {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86_400_000);
    return this.prisma.days.findFirst({
      where: { user_id: userId, date: { gte: start, lt: end } },
      orderBy: { id: 'asc' },
    });
  }

  async findAll(): Promise<DayWire[]> {
    const rows = await this.prisma.days.findMany();
    return rows.map(toWire);
  }

  async findOne(id: number): Promise<DayWire> {
    const day = await this.loadOne(id);
    return toWire(day);
  }

  async getDaysByUserId(userId: number): Promise<DayWire[]> {
    const rows = await this.prisma.days.findMany({
      where: { user_id: userId },
      orderBy: { date: 'desc' },
    });
    return rows.map(toWire);
  }

  async update(id: number, data: UpdateDayDto): Promise<DayWire> {
    const existing = await this.loadOne(id);
    const morning =
      data.morning_score !== undefined
        ? toPrismaScore(data.morning_score)
        : existing.morning_score;
    const afternoon =
      data.afternoon_score !== undefined
        ? toPrismaScore(data.afternoon_score)
        : existing.afternoon_score;
    const evening =
      data.evening_score !== undefined
        ? toPrismaScore(data.evening_score)
        : existing.evening_score;
    // Sticky: stamped only the first time the 3 meals become filled, never
    // overwritten nor cleared by later edits.
    const becameComplete =
      existing.meals_completed_at == null &&
      morning != null &&
      afternoon != null &&
      evening != null;
    // Resolve the new sport level: explicit sport_level wins, else derive from
    // the legacy boolean if it was the only sport field sent. Writing sport_level
    // always mirrors the derived `sport` boolean to keep the legacy column valid.
    const sportLevel =
      data.sport_level !== undefined
        ? data.sport_level
        : data.sport !== undefined
          ? data.sport
            ? 'normal'
            : 'none'
          : undefined;
    const updated = await this.prisma.days.update({
      where: { id },
      data: {
        ...(data.morning_score !== undefined && { morning_score: morning }),
        ...(data.afternoon_score !== undefined && {
          afternoon_score: afternoon,
        }),
        ...(data.evening_score !== undefined && { evening_score: evening }),
        ...(data.snack !== undefined && { snack: data.snack }),
        ...(sportLevel !== undefined && {
          sport_level: sportLevel,
          sport: sportBool(sportLevel),
        }),
        ...(data.sport_type !== undefined && { sport_type: data.sport_type }),
        ...(becameComplete && { meals_completed_at: new Date() }),
      },
    });
    return toWire(updated);
  }

  async remove(id: number): Promise<DayWire> {
    await this.loadOne(id);
    const deleted = await this.prisma.days.delete({ where: { id } });
    return toWire(deleted);
  }

  async getOrCreateTodayForUser(userId: number): Promise<DayWire> {
    const now = new Date();
    const existingDay = await this.findDayInUtcWindow(userId, now);
    if (existingDay) return toWire(existingDay);

    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    try {
      const created = await this.prisma.days.create({
        data: {
          user_id: userId,
          date: today,
        },
      });
      return toWire(created);
    } catch (e) {
      // days_one_per_user_day: a concurrent open-today won the race.
      if ((e as { code?: string }).code !== 'P2002') throw e;
      const winner = await this.findDayInUtcWindow(userId, now);
      if (!winner) throw e;
      return toWire(winner);
    }
  }

  private async loadOne(id: number): Promise<Days> {
    const day = await this.prisma.days.findUnique({ where: { id } });
    if (!day) throw new NotFoundException(`Day with ID ${id} not found`);
    return day;
  }
}
