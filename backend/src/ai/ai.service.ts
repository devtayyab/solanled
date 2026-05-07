import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class AiService {
  constructor(
    private supabaseService: SupabaseService,
    private configService: ConfigService,
  ) {}

  async startSession(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('ai_sessions')
      .insert({ user_id: userId, voiceflow_session_id: `vf_${Date.now()}_${userId.slice(0, 8)}` })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async sendMessage(userId: string, sessionId: string, message: string, token?: string) {
    const client = token ? this.supabaseService.getClientWithToken(token) : this.supabaseService.getClient();

    const { data: session } = await client
      .from('ai_sessions')
      .select('id, voiceflow_session_id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!session) throw new BadRequestException('Session not found');

    await client
      .from('ai_messages')
      .insert({ session_id: sessionId, role: 'user', content: message });

    // Fetch the user's company_id from their profile to log the request
    const { data: profileData } = await client
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();

    // Log the AI request for distributor dashboard metrics
    await client
      .from('ai_request_log')
      .insert({
        user_id: userId,
        company_id: profileData?.company_id || null,
        session_id: sessionId,
        intent: 'chat_message',
        prompt_preview: message.substring(0, 50)
      });

    let assistantReply = '';
    const voiceflowKey = this.configService.get<string>('VOICEFLOW_API_KEY');

    if (voiceflowKey && voiceflowKey !== 'your_voiceflow_api_key_here') {
      try {
        const response = await fetch(
          `https://general-runtime.voiceflow.com/state/user/${session.voiceflow_session_id}/interact`,
          {
            method: 'POST',
            headers: {
              Authorization: voiceflowKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: { type: 'text', payload: message },
            }),
          },
        );

        const vfData = await response.json();
        const textTraces = vfData.filter((t: any) => t.type === 'text');
        assistantReply = textTraces.map((t: any) => t.payload.message).join('\n') ||
          'I received your message. How can I help you further?';
      } catch {
        assistantReply = this.getFallbackResponse(message);
      }
    } else {
      assistantReply = this.getFallbackResponse(message);
    }

    const { data: savedMessage } = await client
      .from('ai_messages')
      .insert({ session_id: sessionId, role: 'assistant', content: assistantReply })
      .select()
      .single();

    return { message: savedMessage, reply: assistantReply };
  }

  private getFallbackResponse(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('install') || lower.includes('installation')) {
      return 'For installation support, please refer to the Installation Guide in the Documents section. Our SloanLED products come with step-by-step instructions. If you need further assistance, contact our technical team at support@sloanled.eu.';
    }
    if (lower.includes('datasheet') || lower.includes('spec') || lower.includes('specification')) {
      return 'You can find all technical datasheets and specification sheets in the Documents section of this app. Documents are available in multiple languages including English, German, and French.';
    }
    if (lower.includes('project') || lower.includes('status')) {
      return 'You can manage all your projects in the Projects tab. Create new projects, update their status, capture GPS coordinates on-site, and upload installation photos.';
    }
    if (lower.includes('gps') || lower.includes('location')) {
      return 'GPS coordinates are automatically captured when you mark a project as "Installed" on-site. Simply open a project and tap "Mark as Installed" to capture your current location.';
    }
    if (lower.includes('photo') || lower.includes('image') || lower.includes('picture')) {
      return 'You can upload photos directly from your phone camera or gallery. Open any project and tap the camera icon to add installation photos.';
    }
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return 'Hello! I\'m the SloanLED AI Assistant. I can help you with product information, installation guidance, project management tips, and more. What can I help you with today?';
    }
    return 'Thank you for your question. I\'m the SloanLED AI Assistant here to help with product information, installation guidance, and project management. For specific technical questions, please check our Documents section or contact support@sloanled.eu.';
  }

  async getSessionMessages(userId: string, sessionId: string) {
    const { data: session } = await this.supabaseService
      .getClient()
      .from('ai_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!session) throw new BadRequestException('Session not found');

    const { data, error } = await this.supabaseService
      .getClient()
      .from('ai_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getUserSessions(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('ai_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }
}
