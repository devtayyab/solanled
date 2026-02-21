import { Controller, Get, Post, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WordpressService } from './wordpress.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('wordpress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wordpress')
export class WordpressController {
  constructor(private readonly wordpressService: WordpressService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get WordPress sync configuration for company' })
  async getConfig(@Req() req: any) {
    const companyId = req.user.profile?.company_id;
    return this.wordpressService.getConfig(companyId);
  }

  @Put('config')
  @ApiOperation({ summary: 'Save WordPress sync configuration' })
  async saveConfig(@Req() req: any, @Body() body: any) {
    const companyId = req.user.profile?.company_id;
    return this.wordpressService.saveConfig(companyId, body);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Trigger WordPress document sync' })
  async syncDocuments(@Req() req: any) {
    const companyId = req.user.profile?.company_id;
    return this.wordpressService.syncDocuments(companyId);
  }
}
