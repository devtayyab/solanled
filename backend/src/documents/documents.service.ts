import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class DocumentsService {
  constructor(private supabaseService: SupabaseService) {}

  async findAll(category?: string, language?: string, search?: string) {
    let query = this.supabaseService
      .getClient()
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (language) query = query.eq('language', language);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getCategories() {
    return ['datasheet', 'spec_sheet', 'installation_guide', 'general', 'certificate'];
  }
}
