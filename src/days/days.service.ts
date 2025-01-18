import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDayDto } from './dto/create-day.dto';
import { UpdateDayDto } from './dto/update-day.dto';

@Injectable()
export class DaysService {
  constructor(private prisma: PrismaService) {}

  async createDay(data: CreateDayDto) {
    return this.prisma.days.create({ data });
  }

  async findAll() {
    return this.prisma.days.findMany();
  }

  async findOne(id: number) {
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
    await this.findOne(id);
    return this.prisma.days.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.days.delete({
      where: { id },
    });
  }
}
