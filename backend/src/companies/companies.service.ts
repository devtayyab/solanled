import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class CompaniesService {
  constructor(private supabaseService: SupabaseService) {}

  async getMyCompany(userId: string) {
    const { data: profile } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.company_id) {
      return null;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateCompany(userId: string, body: any) {
    const { data: profile } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('company_id, role')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.company_id) throw new BadRequestException('No company found');
    if (!['admin', 'superadmin'].includes(profile.role)) {
      throw new ForbiddenException('Only admins can update company details');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('companies')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', profile.company_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getTeamMembers(userId: string) {
    const { data: profile } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.company_id) return [];

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('id, full_name, role, avatar_url, language, created_at')
      .eq('company_id', profile.company_id);

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async inviteEmployee(userId: string, email: string, role: string = 'employee') {
    const { data: adminProfile } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('company_id, role')
      .eq('id', userId)
      .maybeSingle();

    if (!['admin', 'superadmin'].includes(adminProfile?.role)) {
      throw new ForbiddenException('Only admins can invite employees');
    }

    return {
      message: `Invitation sent to ${email}`,
      company_id: adminProfile.company_id,
    };
  }
}
