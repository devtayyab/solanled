import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SupabaseService } from '../supabase.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, SupabaseService, JwtAuthGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
