import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private supabaseService: SupabaseService) {}

  private async getUserCompanyId(userId: string): Promise<string> {
    const { data: profile } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.company_id) {
      throw new BadRequestException('User is not associated with any company');
    }
    return profile.company_id;
  }

  async findAll(userId: string, status?: string, search?: string) {
    const companyId = await this.getUserCompanyId(userId);

    let query = this.supabaseService
      .getClient()
      .from('projects')
      .select(`
        *,
        created_by_profile:profiles!projects_created_by_fkey(id, full_name, avatar_url),
        project_photos(id, url, caption, created_at)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async findOne(userId: string, id: string) {
    const companyId = await this.getUserCompanyId(userId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .select(`
        *,
        created_by_profile:profiles!projects_created_by_fkey(id, full_name, avatar_url),
        project_photos(id, url, caption, created_at, uploaded_by),
        project_status_history(id, old_status, new_status, notes, created_at, changed_by)
      `)
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Project not found');
    return data;
  }

  async create(userId: string, createProjectDto: CreateProjectDto) {
    const companyId = await this.getUserCompanyId(userId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .insert({
        ...createProjectDto,
        company_id: companyId,
        created_by: userId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabaseService
      .getClient()
      .from('project_status_history')
      .insert({
        project_id: data.id,
        changed_by: userId,
        old_status: null,
        new_status: 'pending',
        notes: 'Project created',
      });

    return data;
  }

  async update(userId: string, id: string, updateProjectDto: UpdateProjectDto) {
    const companyId = await this.getUserCompanyId(userId);

    const { data: existing } = await this.supabaseService
      .getClient()
      .from('projects')
      .select('status, company_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing || existing.company_id !== companyId) {
      throw new NotFoundException('Project not found');
    }

    const updateData: any = {
      ...updateProjectDto,
      updated_at: new Date().toISOString(),
    };

    if (updateProjectDto.status === 'installed' && existing.status !== 'installed') {
      updateData.installed_at = new Date().toISOString();
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    if (updateProjectDto.status && updateProjectDto.status !== existing.status) {
      await this.supabaseService
        .getClient()
        .from('project_status_history')
        .insert({
          project_id: id,
          changed_by: userId,
          old_status: existing.status,
          new_status: updateProjectDto.status,
          notes: updateProjectDto.notes || '',
        });
    }

    return data;
  }

  async markInstalled(userId: string, id: string, gps_lat?: number, gps_lng?: number, notes?: string) {
    return this.update(userId, id, {
      status: 'installed',
      gps_lat,
      gps_lng,
      notes,
    });
  }

  async addPhoto(userId: string, projectId: string, url: string, caption?: string) {
    const companyId = await this.getUserCompanyId(userId);

    const { data: project } = await this.supabaseService
      .getClient()
      .from('projects')
      .select('id, company_id')
      .eq('id', projectId)
      .maybeSingle();

    if (!project || project.company_id !== companyId) {
      throw new NotFoundException('Project not found');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('project_photos')
      .insert({
        project_id: projectId,
        uploaded_by: userId,
        url,
        caption: caption || '',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deletePhoto(userId: string, photoId: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('project_photos')
      .delete()
      .eq('id', photoId)
      .eq('uploaded_by', userId);

    if (error) throw new BadRequestException(error.message);
    return { message: 'Photo deleted successfully' };
  }

  async getStats(userId: string) {
    const companyId = await this.getUserCompanyId(userId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .select('status')
      .eq('company_id', companyId);

    if (error) throw new BadRequestException(error.message);

    const stats = {
      total: data.length,
      pending: data.filter(p => p.status === 'pending').length,
      in_progress: data.filter(p => p.status === 'in_progress').length,
      installed: data.filter(p => p.status === 'installed').length,
      completed: data.filter(p => p.status === 'completed').length,
      cancelled: data.filter(p => p.status === 'cancelled').length,
    };

    return stats;
  }
}
