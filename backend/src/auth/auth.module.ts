import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SupabaseService, JwtAuthGuard],
  exports: [AuthService, SupabaseService, JwtAuthGuard],
})
export class AuthModule {}
