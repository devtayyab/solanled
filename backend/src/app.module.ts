import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { ProjectsModule } from './projects/projects.module';
import { DocumentsModule } from './documents/documents.module';
import { AiModule } from './ai/ai.module';
import { ProfilesModule } from './profiles/profiles.module';
import { WordpressModule } from './wordpress/wordpress.module';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CompaniesModule,
    ProjectsModule,
    DocumentsModule,
    AiModule,
    ProfilesModule,
    WordpressModule,
  ],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class AppModule {}
