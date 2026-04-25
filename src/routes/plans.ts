import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { CREATED, NO_CONTENT, OK } from '../constants/httpStatus';
import { createPlanSchema, updatePlanSchema } from '../schemas/plan';
import { createPlan, deletePlan, getPlan, listPlans, updatePlan } from '../services/planService';
import { success } from '../utils/response';

const idParamSchema = z.object({ id: z.string().uuid() });

const router = Router();

router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await listPlans();
    res.status(OK).json(success(plans, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const plan = await getPlan(id);
    res.status(OK).json(success(plan, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.post('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createPlanSchema.parse(req.body);
    const plan = await createPlan(input);
    res.status(CREATED).json(success(plan, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = updatePlanSchema.parse(req.body);
    const plan = await updatePlan(id, patch);
    res.status(OK).json(success(plan, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.delete('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deletePlan(id);
    res.status(NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
});

export default router;
