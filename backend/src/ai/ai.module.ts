import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SupabaseService } from '../supabase.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Module({
  controllers: [AiController],
  providers: [AiService, SupabaseService, JwtAuthGuard],
  exports: [AiService],
})
export class AiModule {}
