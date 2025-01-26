import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { DaysService } from './days.service';
import { CreateDayDto } from './dto/create-day.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('days')
@Controller('days')
export class DaysController {
  constructor(private readonly daysService: DaysService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouveau jour' })
  @ApiResponse({ status: 201, description: 'Jour créé avec succès.' })
  @ApiResponse({ status: 400, description: 'Requête invalide.' })
  @ApiBody({ type: CreateDayDto })
  create(@Body() createDayDto: CreateDayDto) {
    return this.daysService.createDay(createDayDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les jours' })
  @ApiResponse({ status: 200, description: 'Liste des jours récupérée.' })
  findAll() {
    return this.daysService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un jour par son ID' })
  @ApiParam({ name: 'id', description: 'ID du jour' })
  @ApiResponse({ status: 200, description: 'Jour trouvé.' })
  @ApiResponse({ status: 404, description: 'Jour non trouvé.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.daysService.findOne(id);
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
  @ApiOperation({ summary: "Récupérer ou créer le jour actuel d'un utilisateur" })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: "Jour actuel de l'utilisateur (créé si inexistant).",
  })
  getTodayForUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.daysService.getOrCreateTodayForUser(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un jour' })
  @ApiParam({ name: 'id', description: 'ID du jour' })
  @ApiBody({ type: UpdateDayDto })
  @ApiResponse({ status: 200, description: 'Jour mis à jour.' })
  @ApiResponse({ status: 404, description: 'Jour non trouvé.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDayDto: UpdateDayDto,
  ) {
    return this.daysService.update(id, updateDayDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un jour' })
  @ApiParam({ name: 'id', description: 'ID du jour' })
  @ApiResponse({ status: 200, description: 'Jour supprimé.' })
  @ApiResponse({ status: 404, description: 'Jour non trouvé.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.daysService.remove(id);
  }
}
