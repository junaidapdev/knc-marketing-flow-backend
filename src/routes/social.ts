import { Router, type NextFunction, type Request, type Response } from 'express';
import { OK } from '../constants/httpStatus';
import { requireAuthOrService } from '../middleware/authOrService';
import { syncQuerySchema } from '../schemas/social';
import { runSocialSync } from '../services/socialSyncService';
import { success } from '../utils/response';

const router = Router();

// Both endpoints accept either a user JWT or the shared SERVICE_TOKEN so
// the cron Edge Function can invoke them without minting a user session.
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
// `/social/refresh` is the admin-facing alias documented for UIs and
// keyboard triggers. Same handler — the route just reads clearer in
// logs and in the frontend button label.
router.post('/social/refresh', handleSync);

export default router;
