import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDayDto } from './dto/create-day.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { Days } from '@prisma/client';

@Injectable()
export class DaysService {
  constructor(private prisma: PrismaService) {}

  async createDay(data: CreateDayDto): Promise<Days> {
    return this.prisma.days.create({
      data: {
        user_id: data.user_id,
        morning_score: data.morning_score ?? null,
        afternoon_score: data.afternoon_score ?? null,
        evening_score: data.evening_score ?? null,
        snack: data.snack ?? null,
        sport: data.sport ?? false,
        sport_type: data.sport_type ?? null,
        date: data.date ?? new Date(),
      },
    });
  }

  async findAll(): Promise<Days[]> {
    return this.prisma.days.findMany();
  }

  async findOne(id: number): Promise<Days> {
    const day = await this.prisma.days.findUnique({ where: { id } });
    if (!day) throw new NotFoundException(`Day with ID ${id} not found`);
    return day;
  }

  async getDaysByUserId(userId: number): Promise<Days[]> {
    return this.prisma.days.findMany({
      where: { user_id: userId },
      orderBy: { date: 'desc' },
    });
  }

  async update(id: number, data: UpdateDayDto): Promise<Days> {
    await this.findOne(id);
    return this.prisma.days.update({
      where: { id },
      data: {
        ...(data.morning_score !== undefined && {
          morning_score: data.morning_score,
        }),
        ...(data.afternoon_score !== undefined && {
          afternoon_score: data.afternoon_score,
        }),
        ...(data.evening_score !== undefined && {
          evening_score: data.evening_score,
        }),
        ...(data.snack !== undefined && { snack: data.snack }),
        ...(data.sport !== undefined && { sport: data.sport }),
        ...(data.sport_type !== undefined && { sport_type: data.sport_type }),
      },
    });
  }

  async remove(id: number): Promise<Days> {
    await this.findOne(id);
    return this.prisma.days.delete({ where: { id } });
  }

  async getOrCreateTodayForUser(userId: number): Promise<Days> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);

    const existingDay = await this.prisma.days.findFirst({
      where: {
        user_id: userId,
        date: { gte: today, lt: tomorrow },
      },
    });

    if (existingDay) return existingDay;

    return this.prisma.days.create({
      data: {
        user_id: userId,
        date: today,
      },
    });
  }
}
