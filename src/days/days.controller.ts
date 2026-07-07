import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { DaysService } from './days.service';
import { CreateDayDto } from './dto/create-day.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserGuard } from './guards/user-days.guard';

interface AuthedRequest extends Request {
  user: { id: number };
}

@ApiTags('days')
@Controller('days')
@UseGuards(JwtAuthGuard, UserGuard)
@ApiBearerAuth('JWT-auth')
export class DaysController {
  constructor(private readonly daysService: DaysService) {}

  @Post()
  @ApiOperation({
    summary: 'Créer un jour (idempotent par utilisateur et jour calendaire)',
    description:
      'Si un jour existe déjà pour cet utilisateur à cette date (fenêtre UTC), les champs fournis y sont fusionnés — mêmes règles que PATCH — au lieu de créer un doublon.',
  })
  @ApiResponse({
    status: 201,
    description: 'Jour créé (ou jour existant fusionné et renvoyé).',
  })
  @ApiResponse({ status: 400, description: 'Requête invalide.' })
  @ApiBody({ type: CreateDayDto })
  create(@Body() createDayDto: CreateDayDto) {
    return this.daysService.createDay(createDayDto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: "Récupérer les jours d'un utilisateur" })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: "Liste des jours de l'utilisateur.",
  })
  findByUserId(@Param('userId', ParseIntPipe) userId: number) {
    return this.daysService.getDaysByUserId(userId);
  }

  @Get('user/:userId/today')
  @ApiOperation({
    summary: "Récupérer ou créer le jour actuel d'un utilisateur",
  })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: "Jour actuel de l'utilisateur (créé si inexistant).",
  })
  getTodayForUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.daysService.getOrCreateTodayForUser(userId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Mettre à jour un jour (du user authentifié uniquement)',
  })
  @ApiParam({ name: 'id', description: 'ID du jour' })
  @ApiBody({ type: UpdateDayDto })
  @ApiResponse({ status: 200, description: 'Jour mis à jour.' })
  @ApiResponse({
    status: 404,
    description: 'Jour non trouvé (ou appartenant à un autre utilisateur).',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDayDto: UpdateDayDto,
    @Req() req: AuthedRequest,
  ) {
    return this.daysService.update(id, updateDayDto, req.user.id);
  }
}
