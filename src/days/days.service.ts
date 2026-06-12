import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDayDto } from './dto/create-day.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { Days } from '@prisma/client';
import { DayWire, toPrismaScore, toWire } from './score-mapper';

@Injectable()
export class DaysService {
  constructor(private prisma: PrismaService) {}

  async createDay(data: CreateDayDto): Promise<DayWire> {
    const morning = toPrismaScore(data.morning_score ?? null);
    const afternoon = toPrismaScore(data.afternoon_score ?? null);
    const evening = toPrismaScore(data.evening_score ?? null);
    const created = await this.prisma.days.create({
      data: {
        user_id: data.user_id,
        morning_score: morning,
        afternoon_score: afternoon,
        evening_score: evening,
        snack: data.snack ?? null,
        sport: data.sport ?? false,
        sport_type: data.sport_type ?? null,
        date: data.date ?? new Date(),
        // Stamped at write time; lateness vs the day's own date is judged at
        // read time (countsForStreak), so a backfilled day is excluded there.
        ...(morning != null &&
          afternoon != null &&
          evening != null && { meals_completed_at: new Date() }),
      },
    });
    return toWire(created);
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
    const updated = await this.prisma.days.update({
      where: { id },
      data: {
        ...(data.morning_score !== undefined && { morning_score: morning }),
        ...(data.afternoon_score !== undefined && {
          afternoon_score: afternoon,
        }),
        ...(data.evening_score !== undefined && { evening_score: evening }),
        ...(data.snack !== undefined && { snack: data.snack }),
        ...(data.sport !== undefined && { sport: data.sport }),
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);

    const existingDay = await this.prisma.days.findFirst({
      where: {
        user_id: userId,
        date: { gte: today, lt: tomorrow },
      },
    });

    if (existingDay) return toWire(existingDay);

    const created = await this.prisma.days.create({
      data: {
        user_id: userId,
        date: today,
      },
    });
    return toWire(created);
  }

  private async loadOne(id: number): Promise<Days> {
    const day = await this.prisma.days.findUnique({ where: { id } });
    if (!day) throw new NotFoundException(`Day with ID ${id} not found`);
    return day;
  }
}
