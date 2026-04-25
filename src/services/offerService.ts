import { ERRORS } from '../constants/errors';
import { INTERNAL, NOT_FOUND, UNPROCESSABLE } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { CreateOfferInput, ListOffersQuery, UpdateOfferInput } from '../schemas/offer';
import type { Json, TableRow, TableUpdate } from '../types/database';
import type { Offer } from '../types/domain/offer';
import { resolveAssigneesByRole } from './taskService';

type OfferRow = TableRow<'offer'>;

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

function toOffer(row: OfferRow): Offer {
  return {
    id: row.id,
    planId: row.plan_id,
    brandId: row.brand_id,
    name: row.name,
    type: row.type,
    branchIds: row.branch_ids,
    startDate: row.start_date,
    endDate: row.end_date,
    productsText: row.products_text,
    mechanicText: row.mechanic_text,
    budgetAmount: row.budget_amount,
    assigneeId: row.assignee_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

const ONE_DAY_MS = 86_400_000;
const DATE_PAD_LENGTH = 2;

function dayBefore(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d) - ONE_DAY_MS);
  const pad = (n: number): string => String(n).padStart(DATE_PAD_LENGTH, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export async function listOffers(filters: ListOffersQuery): Promise<Offer[]> {
  let q = db.from(TABLES.OFFER).select('*').order('start_date');
  if (filters.planId) q = q.eq('plan_id', filters.planId);
  if (filters.brandId) q = q.eq('brand_id', filters.brandId);
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw dbError(error);
  return ((data ?? []) as OfferRow[]).map(toOffer);
}

export async function getOffer(id: string): Promise<Offer> {
  const { data, error } = await db.from(TABLES.OFFER).select('*').eq('id', id).maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(NOT_FOUND, ERRORS.OFFER_NOT_FOUND.code, ERRORS.OFFER_NOT_FOUND.message);
  }
  return toOffer(data as OfferRow);
}

export async function createOffer(input: CreateOfferInput): Promise<Offer> {
  if (input.endDate < input.startDate) {
    throw new HttpError(
      UNPROCESSABLE,
      ERRORS.INVALID_DATE_RANGE.code,
      ERRORS.INVALID_DATE_RANGE.message,
    );
  }

  // Default assignee is the digital_marketing_production role (Junaid seed).
  let assigneeId = input.assigneeId;
  if (!assigneeId) {
    const byRole = await resolveAssigneesByRole();
    assigneeId = byRole.digital_marketing_production;
  }

  const offerPayload = {
    plan_id: input.planId,
    brand_id: input.brandId,
    name: input.name,
    type: input.type,
    branch_ids: input.branchIds,
    start_date: input.startDate,
    end_date: input.endDate,
    products_text: input.productsText ?? null,
    mechanic_text: input.mechanicText ?? null,
    budget_amount: input.budgetAmount ?? null,
    assignee_id: assigneeId,
    status: input.status,
  };

  const taskPayload = {
    assignee_id: assigneeId,
    due_date: dayBefore(input.startDate),
    step: 'setup',
    status: 'pending',
  };

  const { data, error } = await db.rpc('create_offer_with_task', {
    p_offer: offerPayload as unknown as Json,
    p_task: taskPayload as unknown as Json,
  });
  if (error) throw dbError(error);
  return toOffer(data as unknown as OfferRow);
}

export async function updateOffer(id: string, patch: UpdateOfferInput): Promise<Offer> {
  const current = await getOffer(id);

  const nextStart = patch.startDate ?? current.startDate;
  const nextEnd = patch.endDate ?? current.endDate;
  if (nextEnd < nextStart) {
    throw new HttpError(
      UNPROCESSABLE,
      ERRORS.INVALID_DATE_RANGE.code,
      ERRORS.INVALID_DATE_RANGE.message,
    );
  }

  const update: TableUpdate<'offer'> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.branchIds !== undefined) update.branch_ids = patch.branchIds;
  if (patch.startDate !== undefined) update.start_date = patch.startDate;
  if (patch.endDate !== undefined) update.end_date = patch.endDate;
  if (patch.productsText !== undefined) update.products_text = patch.productsText;
  if (patch.mechanicText !== undefined) update.mechanic_text = patch.mechanicText;
  if (patch.budgetAmount !== undefined) update.budget_amount = patch.budgetAmount;
  if (patch.assigneeId !== undefined) update.assignee_id = patch.assigneeId;
  if (patch.status !== undefined) update.status = patch.status;

  const { data, error } = await db
    .from(TABLES.OFFER)
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(NOT_FOUND, ERRORS.OFFER_NOT_FOUND.code, ERRORS.OFFER_NOT_FOUND.message);
  }
  return toOffer(data as OfferRow);
}

export async function deleteOffer(id: string): Promise<void> {
  const { data: existing, error: fetchError } = await db
    .from(TABLES.OFFER)
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw dbError(fetchError);
  if (!existing) {
    throw new HttpError(NOT_FOUND, ERRORS.OFFER_NOT_FOUND.code, ERRORS.OFFER_NOT_FOUND.message);
  }
  const { error } = await db.from(TABLES.OFFER).delete().eq('id', id);
  if (error) throw dbError(error);
}

export { dayBefore as __dayBefore };
