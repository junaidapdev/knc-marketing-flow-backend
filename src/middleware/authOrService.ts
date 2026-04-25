import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { requireAuth } from './auth';

const BEARER_PREFIX = 'Bearer ';
const SERVICE_USER_ID = '00000000-0000-0000-0000-000000000001';
const SERVICE_USER_EMAIL = 'service@marketing-flow.local';

/**
 * Auth middleware variant for routes the cron Edge Function hits.
 *
 * Accepts either:
 *   1. A valid Supabase user JWT (same as `requireAuth`), or
 *   2. The shared SERVICE_TOKEN — when matched, attaches a synthetic
 *      service principal as `req.user` so downstream handlers can
 *      record `triggered_by` without special-casing the caller type.
 *
 * The SERVICE_TOKEN path short-circuits the JWT verification so the
 * cron doesn't need to round-trip through Supabase Auth.
 */
export async function requireAuthOrService(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : '';
  const configured = env.SERVICE_TOKEN;

  if (configured && token && token === configured) {
    req.user = { id: SERVICE_USER_ID, email: SERVICE_USER_EMAIL };
    next();
    return;
  }

  await requireAuth(req, res, next);
}
