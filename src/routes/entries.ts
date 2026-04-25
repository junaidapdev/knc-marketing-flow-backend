import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { CREATED, NO_CONTENT, OK } from '../constants/httpStatus';
import {
  createCalendarEntrySchema,
  listCalendarEntriesQuerySchema,
  updateCalendarEntrySchema,
} from '../schemas/calendarEntry';
import {
  createPlanEntry,
  deleteEntry,
  listPlanEntries,
  updateEntry,
} from '../services/calendarEntryService';
import { success } from '../utils/response';

const idParamSchema = z.object({ id: z.string().uuid() });
const planIdParamSchema = z.object({ planId: z.string().uuid() });

const router = Router();

router.get('/plans/:planId/entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = planIdParamSchema.parse(req.params);
    const filters = listCalendarEntriesQuerySchema.parse(req.query);
    const entries = await listPlanEntries(planId, filters);
    res.status(OK).json(success(entries, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.post('/plans/:planId/entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = planIdParamSchema.parse(req.params);
    const input = createCalendarEntrySchema.parse(req.body);
    const entry = await createPlanEntry(planId, input);
    res.status(CREATED).json(success(entry, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/entries/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = updateCalendarEntrySchema.parse(req.body);
    const entry = await updateEntry(id, patch);
    res.status(OK).json(success(entry, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.delete('/entries/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteEntry(id);
    res.status(NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
});

export default router;
