import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { SupabaseService } from '../supabase.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, SupabaseService, JwtAuthGuard],
  exports: [CompaniesService],
})
export class CompaniesModule {}
