import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class ProfilesService {
  constructor(private supabaseService: SupabaseService) {}

  async getProfile(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateProfile(userId: string, updates: Partial<{
    full_name: string;
    language: string;
    avatar_url: string;
    phone: string;
  }>) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*, companies(*)')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async joinCompany(userId: string, companyId: string) {
    const { data: company } = await this.supabaseService
      .getClient()
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .maybeSingle();

    if (!company) throw new BadRequestException('Company not found');

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .update({ company_id: companyId, role: 'employee', updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*, companies(*)')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
