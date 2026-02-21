import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, Request, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all projects for the user company' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Request() req,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.projectsService.findAll(req.user.id, status, search);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get project statistics' })
  getStats(@Request() req) {
    return this.projectsService.getStats(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.projectsService.findOne(req.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  create(@Request() req, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(req.user.id, createProjectDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a project' })
  update(@Request() req, @Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(req.user.id, id, updateProjectDto);
  }

  @Patch(':id/install')
  @ApiOperation({ summary: 'Mark a project as installed' })
  markInstalled(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { gps_lat?: number; gps_lng?: number; notes?: string },
  ) {
    return this.projectsService.markInstalled(req.user.id, id, body.gps_lat, body.gps_lng, body.notes);
  }

  @Post(':id/photos')
  @ApiOperation({ summary: 'Add a photo to a project' })
  addPhoto(
    @Request() req,
    @Param('id') projectId: string,
    @Body() body: { url: string; caption?: string },
  ) {
    return this.projectsService.addPhoto(req.user.id, projectId, body.url, body.caption);
  }

  @Delete('photos/:photoId')
  @ApiOperation({ summary: 'Delete a project photo' })
  deletePhoto(@Request() req, @Param('photoId') photoId: string) {
    return this.projectsService.deletePhoto(req.user.id, photoId);
  }
}
