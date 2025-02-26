import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserResponseDto } from './dto/user-response.dto';
import { UserGuard } from 'src/days/guards/user-days.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, UserGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouvel utilisateur' })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé avec succès.',
    type: UserResponseDto,
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // @Get()
  // @ApiOperation({ summary: 'Récupérer tous les utilisateurs' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Liste des utilisateurs récupérée.',
  //   type: [UserResponseDto],
  // })
  // findAll() {
  //   return this.usersService.findAll();
  // }

  @Get(':userId')
  @ApiOperation({ summary: 'Récupérer un utilisateur par son ID' })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur trouvé.',
    type: UserResponseDto,
  })
  findOne(@Param('userId', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Mettre à jour un utilisateur' })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur mis à jour.',
    type: UserResponseDto,
  })
  update(
    @Param('userId', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Supprimer un utilisateur' })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Utilisateur supprimé.' })
  remove(@Param('userId', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
