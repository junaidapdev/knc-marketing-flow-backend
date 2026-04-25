import { ERRORS } from '../constants/errors';
import { INTERNAL } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Brand } from '../types/domain/brand';
import type { TableRow } from '../types/database';

type BrandRow = TableRow<'brand'>;

function toBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    isHidden: row.is_hidden,
    accentColor: row.accent_color,
    createdAt: row.created_at,
  };
}

export interface ListBrandsOptions {
  includeInactive: boolean;
}

export async function listBrands({ includeInactive }: ListBrandsOptions): Promise<Brand[]> {
  let query = db.from(TABLES.BRAND).select('*').eq('is_hidden', false).order('name');
  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    throw new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
      cause: error.message,
    });
  }
  return (data ?? []).map(toBrand);
}
