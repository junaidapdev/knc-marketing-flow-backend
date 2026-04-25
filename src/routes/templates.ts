import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { CREATED, NO_CONTENT, OK } from '../constants/httpStatus';
import {
  applyTemplatesSchema,
  createRecurringTemplateSchema,
  updateRecurringTemplateSchema,
} from '../schemas/recurringTemplate';
import {
  applyTemplatesToPlan,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '../services/recurringTemplateService';
import { success } from '../utils/response';

const idParamSchema = z.object({ id: z.string().uuid() });
const planIdParamSchema = z.object({ planId: z.string().uuid() });

const listTemplatesQuerySchema = z.object({
  includeInactive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .default(false),
});

const router = Router();

router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { includeInactive } = listTemplatesQuerySchema.parse(req.query);
    const templates = await listTemplates(includeInactive);
    res.status(OK).json(success(templates, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const tmpl = await getTemplate(id);
    res.status(OK).json(success(tmpl, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createRecurringTemplateSchema.parse(req.body);
    const tmpl = await createTemplate(input);
    res.status(CREATED).json(success(tmpl, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = updateRecurringTemplateSchema.parse(req.body);
    const tmpl = await updateTemplate(id, patch);
    res.status(OK).json(success(tmpl, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.delete('/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteTemplate(id);
    res.status(NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
});

router.post(
  '/plans/:planId/apply-templates',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { planId } = planIdParamSchema.parse(req.params);
      const input = applyTemplatesSchema.parse(req.body);
      const summary = await applyTemplatesToPlan(planId, input);
      res.status(OK).json(success(summary, { requestId: req.requestId }));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
