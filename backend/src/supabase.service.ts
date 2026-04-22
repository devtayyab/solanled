import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_ANON_KEY');
    this.client = createClient(url, key);
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getClientWithToken(token: string): SupabaseClient {
    return createClient(
      this.configService.get<string>('SUPABASE_URL'),
      this.configService.get<string>('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } } }
    );
  }

  async signIn(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  async signUp(email: string, password: string, metadata: Record<string, any> = {}) {
    return this.client.auth.signUp({ email, password, options: { data: metadata } });
  }

  async signOut(token: string) {
    const authClient = createClient(
      this.configService.get<string>('SUPABASE_URL'),
      this.configService.get<string>('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    return authClient.auth.signOut();
  }

  async getUser(token: string) {
    return this.client.auth.getUser(token);
  }
}
