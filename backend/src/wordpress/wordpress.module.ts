import { Module } from '@nestjs/common';
import { WordpressController } from './wordpress.controller';
import { WordpressService } from './wordpress.service';
import { SupabaseService } from '../supabase.service';

@Module({
  controllers: [WordpressController],
  providers: [WordpressService, SupabaseService],
})
export class WordpressModule {}
