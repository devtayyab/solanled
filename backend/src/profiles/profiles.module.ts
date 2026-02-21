import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { SupabaseService } from '../supabase.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Module({
  controllers: [ProfilesController],
  providers: [ProfilesService, SupabaseService, JwtAuthGuard],
  exports: [ProfilesService],
})
export class ProfilesModule {}
