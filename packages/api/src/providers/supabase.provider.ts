import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseProvider {
  private readonly client: SupabaseClient;
  private readonly adminClient: SupabaseClient;

  constructor() {
    const url = process.env['SUPABASE_URL'];
    const anonKey = process.env['SUPABASE_ANON_KEY'];
    const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!url || !anonKey || !serviceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.client = createClient(url, anonKey);
    this.adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  getAuthenticatedClient(accessToken: string): SupabaseClient {
    const url = process.env['SUPABASE_URL']!;
    const anonKey = process.env['SUPABASE_ANON_KEY']!;
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });
  }
}
