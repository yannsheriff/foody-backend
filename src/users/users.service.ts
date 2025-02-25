import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private excludePassword(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });
    return this.excludePassword(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany();
    return users.map(this.excludePassword);
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return this.excludePassword(user);
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);
    const hashedPassword = await bcrypt.hash(updateUserDto.password, 10);
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...updateUserDto, password: hashedPassword },
    });
    return this.excludePassword(user);
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user)
      throw new NotFoundException(`User with email ${email} not found`);
    return user;
  }
}
