import { ERRORS } from '../constants/errors';
import { INTERNAL } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Assignee } from '../types/domain/assignee';
import type { TableRow } from '../types/database';

type AssigneeRow = TableRow<'assignee'>;

function toAssignee(row: AssigneeRow): Assignee {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export interface ListAssigneesOptions {
  includeInactive: boolean;
}

export async function listAssignees({
  includeInactive,
}: ListAssigneesOptions): Promise<Assignee[]> {
  let query = db.from(TABLES.ASSIGNEE).select('*').order('name');
  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    throw new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
      cause: error.message,
    });
  }
  return (data ?? []).map(toAssignee);
}
