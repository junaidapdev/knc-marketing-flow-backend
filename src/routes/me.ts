import { Router, type Request, type Response } from 'express';
import { ERRORS } from '../constants/errors';
import { OK, UNAUTHORIZED } from '../constants/httpStatus';
import { HttpError } from '../middleware/errorHandler';
import { success } from '../utils/response';

const router = Router();

router.get('/me', (req: Request, res: Response) => {
  if (!req.user) {
    throw new HttpError(UNAUTHORIZED, ERRORS.UNAUTHORIZED.code, ERRORS.UNAUTHORIZED.message);
  }
  res.status(OK).json(success(req.user, { requestId: req.requestId }));
});

export default router;
