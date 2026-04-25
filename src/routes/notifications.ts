import { Router, type NextFunction, type Request, type Response } from 'express';
import { OK } from '../constants/httpStatus';
import { getNotifications } from '../services/notificationService';
import { success } from '../utils/response';

const router = Router();

router.get('/notifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feed = await getNotifications();
    res.status(OK).json(success(feed, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

export default router;
