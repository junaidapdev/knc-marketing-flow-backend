import { Router, type Request, type Response, type NextFunction } from 'express';
import { OK } from '../constants/httpStatus';
import { listAssigneesQuerySchema } from '../schemas/assignee';
import { listAssignees } from '../services/assigneeService';
import { success } from '../utils/response';

const router = Router();

router.get('/assignees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { includeInactive } = listAssigneesQuerySchema.parse(req.query);
    const assignees = await listAssignees({ includeInactive });
    res.status(OK).json(success(assignees, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

export default router;
