import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SupabaseService } from '../supabase.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, SupabaseService, JwtAuthGuard],
  exports: [DocumentsService],
})
export class DocumentsModule {}
