import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { CREATED, NO_CONTENT, OK } from '../constants/httpStatus';
import {
  budgetDashboardQuerySchema,
  createBudgetEntrySchema,
  listBudgetEntriesQuerySchema,
  updateBudgetEntrySchema,
} from '../schemas/budgetEntry';
import {
  createBudgetEntry,
  deleteBudgetEntry,
  getBudgetDashboard,
  getBudgetEntry,
  listBudgetEntries,
  updateBudgetEntry,
} from '../services/budgetService';
import { success } from '../utils/response';

const idParamSchema = z.object({ id: z.string().uuid() });

const router = Router();

router.get('/budget-entries/dashboard', async (req, res, next: NextFunction) => {
  try {
    const { planId } = budgetDashboardQuerySchema.parse(req.query);
    const dashboard = await getBudgetDashboard(planId);
    res.status(OK).json(success(dashboard, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/budget-entries', async (req, res, next: NextFunction) => {
  try {
    const filters = listBudgetEntriesQuerySchema.parse(req.query);
    const entries = await listBudgetEntries(filters);
    res.status(OK).json(success(entries, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/budget-entries/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const entry = await getBudgetEntry(id);
    res.status(OK).json(success(entry, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.post('/budget-entries', async (req, res, next: NextFunction) => {
  try {
    const input = createBudgetEntrySchema.parse(req.body);
    const entry = await createBudgetEntry(input);
    res.status(CREATED).json(success(entry, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/budget-entries/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = updateBudgetEntrySchema.parse(req.body);
    const entry = await updateBudgetEntry(id, patch);
    res.status(OK).json(success(entry, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.delete('/budget-entries/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteBudgetEntry(id);
    res.status(NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
});

export default router;
