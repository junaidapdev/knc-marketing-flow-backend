import { ERRORS } from '../constants/errors';
import { INTERNAL } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { UpdateSettingsInput } from '../schemas/settings';
import type { TableRow } from '../types/database';
import type { UserSettings } from '../types/domain/userSettings';

type SettingsRow = TableRow<'user_settings'>;

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

function redact(row: SettingsRow): UserSettings {
  return {
    userId: row.user_id,
    claudeApiKeySet: Boolean(row.claude_api_key && row.claude_api_key.length > 0),
    updatedAt: row.updated_at,
  };
}

/**
 * Load the settings row for this user; create an empty one lazily if it
 * doesn't exist yet. Returns the redacted shape (key is never echoed
 * back).
 */
export async function getSettingsForUser(userId: string): Promise<UserSettings> {
  const { data, error } = await db
    .from(TABLES.USER_SETTINGS)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw dbError(error);
  if (data) return redact(data as SettingsRow);

  const { data: inserted, error: insertError } = await db
    .from(TABLES.USER_SETTINGS)
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (insertError) throw dbError(insertError);
  return redact(inserted as SettingsRow);
}

export async function updateSettingsForUser(
  userId: string,
  input: UpdateSettingsInput,
): Promise<UserSettings> {
  // Upsert so first-ever update works without a prior read.
  const { data, error } = await db
    .from(TABLES.USER_SETTINGS)
    .upsert(
      {
        user_id: userId,
        claude_api_key: input.claudeApiKey ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();
  if (error) throw dbError(error);
  return redact(data as SettingsRow);
}
