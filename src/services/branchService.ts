import { ERRORS } from '../constants/errors';
import { INTERNAL } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Branch } from '../types/domain/branch';
import type { TableRow } from '../types/database';

type BranchRow = TableRow<'branch'>;

function toBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    brandId: row.brand_id,
    hasBoxedChocolates: row.has_boxed_chocolates,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export interface ListBranchesOptions {
  brandId?: string;
  city?: string;
  includeInactive: boolean;
}

export async function listBranches({
  brandId,
  city,
  includeInactive,
}: ListBranchesOptions): Promise<Branch[]> {
  let query = db.from(TABLES.BRANCH).select('*').order('city').order('name');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }
  if (brandId) {
    query = query.eq('brand_id', brandId);
  }
  if (city) {
    query = query.eq('city', city);
  }

  const { data, error } = await query;
  if (error) {
    throw new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
      cause: error.message,
    });
  }
  return (data ?? []).map(toBranch);
}
