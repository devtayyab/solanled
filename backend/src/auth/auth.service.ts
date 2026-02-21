import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private supabaseService: SupabaseService) {}

  async login(loginDto: LoginDto) {
    const { data, error } = await this.supabaseService.signIn(loginDto.email, loginDto.password);

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    const { data: profileData } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', data.user.id)
      .maybeSingle();

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        profile: profileData,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const { email, password, full_name, company_name, language } = registerDto;

    const { data: authData, error: authError } = await this.supabaseService.signUp(
      email,
      password,
      { full_name, language: language || 'en' },
    );

    if (authError) {
      throw new BadRequestException(authError.message);
    }

    if (!authData.user) {
      throw new BadRequestException('Registration failed');
    }

    const userId = authData.user.id;
    let companyId: string | null = null;

    if (company_name) {
      const { data: companyData, error: companyError } = await this.supabaseService
        .getClient()
        .from('companies')
        .insert({ name: company_name })
        .select()
        .single();

      if (!companyError && companyData) {
        companyId = companyData.id;
      }
    }

    await this.supabaseService
      .getClient()
      .from('profiles')
      .update({
        full_name,
        company_id: companyId,
        role: company_name ? 'admin' : 'employee',
        language: language || 'en',
      })
      .eq('id', userId);

    const { data: profileData } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', userId)
      .maybeSingle();

    return {
      access_token: authData.session?.access_token,
      refresh_token: authData.session?.refresh_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile: profileData,
      },
    };
  }

  async logout(token: string) {
    await this.supabaseService.signOut(token);
    return { message: 'Logged out successfully' };
  }

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
}
