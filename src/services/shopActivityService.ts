import { ERRORS } from '../constants/errors';
import { INTERNAL, NOT_FOUND } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type {
  CreateShopActivityInput,
  ListShopActivitiesQuery,
  UpdateShopActivityInput,
} from '../schemas/shopActivity';
import type { Json, TableRow, TableUpdate } from '../types/database';
import type { ShopActivity } from '../types/domain/shopActivity';
import { createSignedUpload, SHOP_ACTIVITY_BUCKET } from './storageService';
import { resolveAssigneesByRole } from './taskService';

type ShopActivityRow = TableRow<'shop_activity'>;

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

function toShopActivity(row: ShopActivityRow): ShopActivity {
  return {
    id: row.id,
    planId: row.plan_id,
    branchId: row.branch_id,
    weekOf: row.week_of,
    type: row.type,
    assigneeId: row.assignee_id,
    status: row.status,
    photoUrl: row.photo_url,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listShopActivities(
  filters: ListShopActivitiesQuery,
): Promise<ShopActivity[]> {
  let q = db.from(TABLES.SHOP_ACTIVITY).select('*').order('week_of');
  if (filters.planId) q = q.eq('plan_id', filters.planId);
  if (filters.branchId) q = q.eq('branch_id', filters.branchId);
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw dbError(error);
  return ((data ?? []) as ShopActivityRow[]).map(toShopActivity);
}

export async function getShopActivity(id: string): Promise<ShopActivity> {
  const { data, error } = await db
    .from(TABLES.SHOP_ACTIVITY)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.SHOP_ACTIVITY_NOT_FOUND.code,
      ERRORS.SHOP_ACTIVITY_NOT_FOUND.message,
    );
  }
  return toShopActivity(data as ShopActivityRow);
}

export async function createShopActivity(input: CreateShopActivityInput): Promise<ShopActivity> {
  let assigneeId = input.assigneeId;
  if (!assigneeId) {
    const byRole = await resolveAssigneesByRole();
    assigneeId = byRole.digital_marketing_production;
  }

  const activityPayload = {
    plan_id: input.planId,
    branch_id: input.branchId,
    week_of: input.weekOf,
    type: input.type,
    assignee_id: assigneeId,
    status: input.status,
    photo_url: input.photoUrl ?? null,
    notes: input.notes ?? null,
  };

  const taskPayload = {
    assignee_id: assigneeId,
    due_date: input.weekOf,
    step: 'execute',
    status: 'pending',
  };

  const { data, error } = await db.rpc('create_shop_activity_with_task', {
    p_activity: activityPayload as unknown as Json,
    p_task: taskPayload as unknown as Json,
  });
  if (error) throw dbError(error);
  return toShopActivity(data as unknown as ShopActivityRow);
}

export async function updateShopActivity(
  id: string,
  patch: UpdateShopActivityInput,
): Promise<ShopActivity> {
  const update: TableUpdate<'shop_activity'> = {};
  if (patch.branchId !== undefined) update.branch_id = patch.branchId;
  if (patch.weekOf !== undefined) update.week_of = patch.weekOf;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.assigneeId !== undefined) update.assignee_id = patch.assigneeId;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.photoUrl !== undefined) update.photo_url = patch.photoUrl;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await db
    .from(TABLES.SHOP_ACTIVITY)
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.SHOP_ACTIVITY_NOT_FOUND.code,
      ERRORS.SHOP_ACTIVITY_NOT_FOUND.message,
    );
  }
  return toShopActivity(data as ShopActivityRow);
}

export async function deleteShopActivity(id: string): Promise<void> {
  const { data: existing, error: fetchError } = await db
    .from(TABLES.SHOP_ACTIVITY)
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw dbError(fetchError);
  if (!existing) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.SHOP_ACTIVITY_NOT_FOUND.code,
      ERRORS.SHOP_ACTIVITY_NOT_FOUND.message,
    );
  }
  const { error } = await db.from(TABLES.SHOP_ACTIVITY).delete().eq('id', id);
  if (error) throw dbError(error);
}

export async function createPhotoUploadUrl(
  id: string,
): Promise<{ uploadUrl: string; path: string; publicUrl: string }> {
  // Ensure activity exists so we can't leak pre-signed URLs for fake ids.
  await getShopActivity(id);
  return createSignedUpload(SHOP_ACTIVITY_BUCKET, id);
}
