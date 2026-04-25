import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { CREATED, OK } from '../constants/httpStatus';
import { wizardDraftSchema, wizardSubmitSchema } from '../schemas/wizard';
import { getWizardDraft, saveWizardDraft, submitWizard } from '../services/wizardService';
import { success } from '../utils/response';

const planIdParamSchema = z.object({ id: z.string().uuid() });

const router = Router();

router.post('/plans/wizard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = wizardSubmitSchema.parse(req.body);
    const summary = await submitWizard(input);
    res.status(CREATED).json(success(summary, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/plans/:id/wizard-draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = planIdParamSchema.parse(req.params);
    const record = await getWizardDraft(id);
    res.status(OK).json(success(record, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/plans/:id/wizard-draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = planIdParamSchema.parse(req.params);
    const draft = wizardDraftSchema.parse(req.body);
    const record = await saveWizardDraft(id, draft);
    res.status(OK).json(success(record, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

export default router;
