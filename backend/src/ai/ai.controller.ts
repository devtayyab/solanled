import { Controller, Post, Get, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Start a new AI chat session' })
  startSession(@Request() req) {
    return this.aiService.startSession(req.user.id);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get all AI sessions for current user' })
  getSessions(@Request() req) {
    return this.aiService.getUserSessions(req.user.id);
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Send a message in an AI session' })
  sendMessage(
    @Request() req,
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string },
  ) {
    return this.aiService.sendMessage(req.user.id, sessionId, body.message);
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get all messages in an AI session' })
  getMessages(@Request() req, @Param('sessionId') sessionId: string) {
    return this.aiService.getSessionMessages(req.user.id, sessionId);
  }
}
