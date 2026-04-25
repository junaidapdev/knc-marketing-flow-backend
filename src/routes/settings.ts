import { Router, type NextFunction, type Request, type Response } from 'express';
import { ERRORS } from '../constants/errors';
import { OK, UNAUTHORIZED } from '../constants/httpStatus';
import { HttpError } from '../middleware/errorHandler';
import { updateSettingsSchema } from '../schemas/settings';
import { getSettingsForUser, updateSettingsForUser } from '../services/settingsService';
import { success } from '../utils/response';

const router = Router();

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new HttpError(UNAUTHORIZED, ERRORS.UNAUTHORIZED.code, ERRORS.UNAUTHORIZED.message);
  }
  return req.user.id;
}

router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const settings = await getSettingsForUser(userId);
    res.status(OK).json(success(settings, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUserId(req);
    const input = updateSettingsSchema.parse(req.body);
    const settings = await updateSettingsForUser(userId, input);
    res.status(OK).json(success(settings, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

export default router;
