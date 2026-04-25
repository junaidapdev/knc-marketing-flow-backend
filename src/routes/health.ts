import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Router, type Request, type Response } from 'express';
import { OK, SERVICE_UNAVAILABLE } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { logger } from '../utils/logger';
import { ERRORS } from '../constants/errors';
import { error as errorEnvelope, success } from '../utils/response';

const pkgPath = join(__dirname, '..', '..', 'package.json');
const { version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.status(OK).json(
    success(
      {
        status: 'ok',
        version,
        uptime: process.uptime(),
      },
      { requestId: req.requestId },
    ),
  );
});

// Deep health: verifies the DB connection. Used by uptime probes that
// need to know the API is *actually* serving traffic, not just that the
// process is running.
router.get('/health/deep', async (req: Request, res: Response) => {
  const started = Date.now();
  const { error } = await db.from(TABLES.BRAND).select('id', { head: true, count: 'exact' });
  const dbMs = Date.now() - started;
  if (error) {
    logger.warn({ requestId: req.requestId, dbError: error.message }, 'health/deep db ping failed');
    res
      .status(SERVICE_UNAVAILABLE)
      .json(
        errorEnvelope(
          ERRORS.DB_CONNECTION_FAILED.code,
          ERRORS.DB_CONNECTION_FAILED.message,
          undefined,
          { requestId: req.requestId },
        ),
      );
    return;
  }
  res.status(OK).json(
    success(
      {
        status: 'ok',
        version,
        uptime: process.uptime(),
        db: { ok: true, latencyMs: dbMs },
      },
      { requestId: req.requestId },
    ),
  );
});

export default router;
