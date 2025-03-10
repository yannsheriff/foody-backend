import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDayDto } from './dto/create-day.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { Days, Score } from '@prisma/client';

@Injectable()
export class DaysService {
  constructor(private prisma: PrismaService) {}

  private formatScoreData(data: CreateDayDto | UpdateDayDto): UpdateDayDto {
    return {
      ...data,
      morning_score: data.morning_score ?? null,
      afternoon_score: data.afternoon_score ?? null,
      evening_score: data.evening_score ?? null,
      extra_score: data.extra_score ?? null,
    };
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  private areAllMealsCompleted(
    morning: Score | null,
    afternoon: Score | null,
    evening: Score | null,
  ): boolean {
    return morning !== null && afternoon !== null && evening !== null;
  }

  private async handleCompletedOnTime(data: Days) {
    // Si ce n'est pas aujourd'hui, on garde la valeur existante
    if (!this.isToday(data.date)) {
      return data.completed_on_time;
    }

    // Vérifie si tous les repas sont complétés
    return this.areAllMealsCompleted(
      data.morning_score,
      data.afternoon_score,
      data.evening_score,
    );
  }

  async createDay(data: CreateDayDto) {
    const formattedData = {
      ...data,
      ...this.formatScoreData(data),
    };
    const day = await this.prisma.days.create({
      data: {
        ...formattedData,
        completed_on_time: false,
      },
    });

    const completed_on_time = await this.handleCompletedOnTime(day);

    return this.prisma.days.update({
      where: { id: day.id },
      data: {
        completed_on_time,
      },
    });
  }

  async findAll() {
    return this.prisma.days.findMany();
  }

  async findOne(id: number): Promise<Days> {
    const day = await this.prisma.days.findUnique({
      where: { id },
    });
    if (!day) throw new NotFoundException(`Day with ID ${id} not found`);
    return day;
  }

  async getDaysByUserId(userId: number) {
    return this.prisma.days.findMany({
      where: { user_id: userId },
    });
  }

  async getDayByDate(userId: number, date: Date) {
    return this.prisma.days.findFirst({
      where: {
        user_id: userId,
        date: { equals: date },
      },
    });
  }

  async update(id: number, data: UpdateDayDto) {
    const existingDay = await this.findOne(id);
    const completed_on_time = await this.handleCompletedOnTime(existingDay);
    const formattedData = this.formatScoreData(data);

    return this.prisma.days.update({
      where: { id },
      data: {
        ...formattedData,
        completed_on_time,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.days.delete({
      where: { id },
    });
  }

  async getOrCreateTodayForUser(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingDay = await this.prisma.days.findFirst({
      where: {
        user_id: userId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingDay) {
      return existingDay;
    }

    return this.prisma.days.create({
      data: {
        user_id: userId,
        date: today,
        morning_score: null,
        afternoon_score: null,
        evening_score: null,
        extra_score: null,
        sport: false,
        completed_on_time: false,
      },
    });
  }
}
