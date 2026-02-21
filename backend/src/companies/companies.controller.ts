import { Controller, Get, Put, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user company' })
  getMyCompany(@Request() req) {
    return this.companiesService.getMyCompany(req.user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update company details (admin only)' })
  updateCompany(@Request() req, @Body() body: any) {
    return this.companiesService.updateCompany(req.user.id, body);
  }

  @Get('team')
  @ApiOperation({ summary: 'Get team members of the company' })
  getTeamMembers(@Request() req) {
    return this.companiesService.getTeamMembers(req.user.id);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite an employee to the company' })
  inviteEmployee(@Request() req, @Body() body: { email: string; role?: string }) {
    return this.companiesService.inviteEmployee(req.user.id, body.email, body.role);
  }
}
