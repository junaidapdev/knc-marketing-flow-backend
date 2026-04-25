import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import type { Database } from '../types/database';

export type Db = SupabaseClient<Database>;

function createDbClient(): Db {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });
}

export const db: Db = createDbClient();
