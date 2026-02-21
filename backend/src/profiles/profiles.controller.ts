import { Controller, Get, Put, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req) {
    return this.profilesService.getProfile(req.user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@Request() req, @Body() body: any) {
    return this.profilesService.updateProfile(req.user.id, body);
  }

  @Post('join-company')
  @ApiOperation({ summary: 'Join a company by ID' })
  joinCompany(@Request() req, @Body() body: { company_id: string }) {
    return this.profilesService.joinCompany(req.user.id, body.company_id);
  }
}
