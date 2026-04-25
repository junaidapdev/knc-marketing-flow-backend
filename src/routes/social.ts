import { Router, type NextFunction, type Request, type Response } from 'express';
import { OK } from '../constants/httpStatus';
import { requireAuthOrService } from '../middleware/authOrService';
import { postsQuerySchema, snapshotsQuerySchema, syncQuerySchema } from '../schemas/social';
import {
  computeKpis,
  getSyncStatus,
  listPosts,
  listSnapshots,
} from '../services/socialReadService';
import { runSocialSync } from '../services/socialSyncService';
import { success } from '../utils/response';

const router = Router();

// All routes accept either user JWT or shared SERVICE_TOKEN.
router.use(requireAuthOrService);

async function handleSync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { platform } = syncQuerySchema.parse(req.query);
    const summary = await runSocialSync({
      platform,
      triggeredBy: req.user?.email ?? null,
    });
    res.status(OK).json(success(summary, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
}

router.post('/social/sync', handleSync);
router.post('/social/refresh', handleSync);

// --- Read endpoints used by the dashboard --------------------------------

router.get('/social/snapshots', async (req, res, next: NextFunction) => {
  try {
    const filters = snapshotsQuerySchema.parse(req.query);
    const data = await listSnapshots(filters);
    res.status(OK).json(success(data, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/social/kpis', async (req, res, next: NextFunction) => {
  try {
    const data = await computeKpis();
    res.status(OK).json(success(data, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/social/posts', async (req, res, next: NextFunction) => {
  try {
    const filters = postsQuerySchema.parse(req.query);
    const data = await listPosts(filters);
    res.status(OK).json(success(data, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/social/sync-status', async (req, res, next: NextFunction) => {
  try {
    const data = await getSyncStatus();
    res.status(OK).json(success(data, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

export default router;
