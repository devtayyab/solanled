import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';

interface WordpressConfig {
  url: string;
  username: string;
  app_password: string;
  company_id: string;
}

interface WPMedia {
  id: number;
  title: { rendered: string };
  description: { rendered: string };
  source_url: string;
  mime_type: string;
  date: string;
  modified: string;
  slug: string;
}

@Injectable()
export class WordpressService {
  constructor(private readonly supabase: SupabaseService) {}

  async getConfig(companyId: string) {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('wordpress_sync_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    return data;
  }

  async saveConfig(companyId: string, config: Partial<WordpressConfig>) {
    const client = this.supabase.getClient();
    const existing = await this.getConfig(companyId);

    if (existing) {
      const { data, error } = await client
        .from('wordpress_sync_config')
        .update({ ...config, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    } else {
      const { data, error } = await client
        .from('wordpress_sync_config')
        .insert({ company_id: companyId, ...config })
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }
  }

  async syncDocuments(companyId: string) {
    const config = await this.getConfig(companyId);
    if (!config?.wp_url || !config?.wp_username || !config?.wp_app_password) {
      throw new BadRequestException('WordPress configuration is incomplete');
    }

    const auth = Buffer.from(`${config.wp_username}:${config.wp_app_password}`).toString('base64');
    const headers = { Authorization: `Basic ${auth}` };

    let page = 1;
    let synced = 0;
    const client = this.supabase.getClient();

    while (true) {
      const response = await fetch(
        `${config.wp_url}/wp-json/wp/v2/media?per_page=100&page=${page}&mime_type=application/pdf`,
        { headers }
      );

      if (!response.ok) break;
      const items: WPMedia[] = await response.json();
      if (!items.length) break;

      for (const item of items) {
        const category = this.inferCategory(item.title.rendered, item.slug);
        const language = this.inferLanguage(item.title.rendered, item.slug);

        await client.from('documents').upsert({
          title: item.title.rendered,
          description: item.description.rendered.replace(/<[^>]+>/g, '').trim(),
          category,
          file_url: item.source_url,
          language,
          tags: [],
          updated_at: new Date().toISOString(),
        }, { onConflict: 'file_url', ignoreDuplicates: false });

        synced++;
      }

      const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
      if (page >= totalPages) break;
      page++;
    }

    await client
      .from('wordpress_sync_config')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('company_id', companyId);

    return { synced, message: `Successfully synced ${synced} documents from WordPress` };
  }

  private inferCategory(title: string, slug: string): string {
    const combined = `${title} ${slug}`.toLowerCase();
    if (combined.includes('datasheet') || combined.includes('datenblatt')) return 'datasheet';
    if (combined.includes('spec') || combined.includes('spezif')) return 'spec_sheet';
    if (combined.includes('install') || combined.includes('montage')) return 'installation_guide';
    if (combined.includes('certificate') || combined.includes('zertifikat')) return 'certificate';
    return 'general';
  }

  private inferLanguage(title: string, slug: string): string {
    const combined = `${title} ${slug}`.toLowerCase();
    if (combined.includes('-de') || combined.includes('_de') || combined.includes('deutsch')) return 'de';
    if (combined.includes('-fr') || combined.includes('_fr') || combined.includes('francais')) return 'fr';
    return 'en';
  }
}
