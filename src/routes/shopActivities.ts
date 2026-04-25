import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { CREATED, NO_CONTENT, OK } from '../constants/httpStatus';
import {
  createShopActivitySchema,
  listShopActivitiesQuerySchema,
  updateShopActivitySchema,
} from '../schemas/shopActivity';
import {
  createPhotoUploadUrl,
  createShopActivity,
  deleteShopActivity,
  getShopActivity,
  listShopActivities,
  updateShopActivity,
} from '../services/shopActivityService';
import { success } from '../utils/response';

const idParamSchema = z.object({ id: z.string().uuid() });

const router = Router();

router.get('/shop-activities', async (req, res, next: NextFunction) => {
  try {
    const filters = listShopActivitiesQuerySchema.parse(req.query);
    const activities = await listShopActivities(filters);
    res.status(OK).json(success(activities, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/shop-activities/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const activity = await getShopActivity(id);
    res.status(OK).json(success(activity, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.post('/shop-activities', async (req, res, next: NextFunction) => {
  try {
    const input = createShopActivitySchema.parse(req.body);
    const activity = await createShopActivity(input);
    res.status(CREATED).json(success(activity, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/shop-activities/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = updateShopActivitySchema.parse(req.body);
    const activity = await updateShopActivity(id, patch);
    res.status(OK).json(success(activity, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.delete('/shop-activities/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteShopActivity(id);
    res.status(NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
});

router.post(
  '/shop-activities/:id/photo-upload-url',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const urls = await createPhotoUploadUrl(id);
      res.status(OK).json(success(urls, { requestId: req.requestId }));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
