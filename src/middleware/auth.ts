import type { NextFunction, Request, Response } from 'express';
import { ERRORS } from '../constants/errors';
import { UNAUTHORIZED } from '../constants/httpStatus';
import { db } from '../lib/supabase';
import { logger } from '../utils/logger';
import { error as errorEnvelope } from '../utils/response';

const BEARER_PREFIX = 'Bearer ';

function extractToken(header: string | undefined): string | null {
  if (!header) return null;
  if (!header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

function respondUnauthorized(req: Request, res: Response, code: string, message: string): void {
  res
    .status(UNAUTHORIZED)
    .json(errorEnvelope(code, message, undefined, { requestId: req.requestId }));
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req.header('authorization'));
  if (!token) {
    respondUnauthorized(req, res, ERRORS.UNAUTHORIZED.code, ERRORS.UNAUTHORIZED.message);
    return;
  }

  let result;
  try {
    result = await db.auth.getUser(token);
  } catch (err) {
    logger.warn({ err, requestId: req.requestId }, 'auth verification threw');
    respondUnauthorized(req, res, ERRORS.INVALID_TOKEN.code, ERRORS.INVALID_TOKEN.message);
    return;
  }

  if (result.error || !result.data.user) {
    const message = result.error?.message ?? '';
    const isExpired = /expired/i.test(message);
    const err = isExpired ? ERRORS.TOKEN_EXPIRED : ERRORS.INVALID_TOKEN;
    logger.info({ requestId: req.requestId, reason: message }, 'auth rejected');
    respondUnauthorized(req, res, err.code, err.message);
    return;
  }

  const { id, email } = result.data.user;
  if (!email) {
    respondUnauthorized(req, res, ERRORS.INVALID_TOKEN.code, ERRORS.INVALID_TOKEN.message);
    return;
  }

  req.user = { id, email };
  next();
}
