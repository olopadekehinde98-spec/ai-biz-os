import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseProvider) {}

  async syncUser(userId: string, email: string, fullName?: string, avatarUrl?: string) {
    const adminClient = this.supabase.getAdminClient();

    const { data: existing } = await adminClient
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existing) {
      const { error } = await adminClient.from('users').insert({
        id: userId,
        email,
        full_name: fullName ?? null,
        avatar_url: avatarUrl ?? null,
        plan: 'starter',
      });

      if (error) throw new BadRequestException(`Failed to create user: ${error.message}`);

      await adminClient.from('user_onboarding').insert({
        user_id: userId,
        step_completed: 0,
      });
    }

    return { userId };
  }

  async getUser(userId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getUserOnboarding(userId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('user_onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data;
  }
}
