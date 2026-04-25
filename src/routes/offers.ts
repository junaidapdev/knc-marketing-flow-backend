import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { CREATED, NO_CONTENT, OK } from '../constants/httpStatus';
import { createOfferSchema, listOffersQuerySchema, updateOfferSchema } from '../schemas/offer';
import {
  createOffer,
  deleteOffer,
  getOffer,
  listOffers,
  updateOffer,
} from '../services/offerService';
import { success } from '../utils/response';

const idParamSchema = z.object({ id: z.string().uuid() });

const router = Router();

router.get('/offers', async (req, res, next: NextFunction) => {
  try {
    const filters = listOffersQuerySchema.parse(req.query);
    const offers = await listOffers(filters);
    res.status(OK).json(success(offers, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/offers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const offer = await getOffer(id);
    res.status(OK).json(success(offer, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.post('/offers', async (req, res, next: NextFunction) => {
  try {
    const input = createOfferSchema.parse(req.body);
    const offer = await createOffer(input);
    res.status(CREATED).json(success(offer, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/offers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = updateOfferSchema.parse(req.body);
    const offer = await updateOffer(id, patch);
    res.status(OK).json(success(offer, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.delete('/offers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteOffer(id);
    res.status(NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
});

export default router;
