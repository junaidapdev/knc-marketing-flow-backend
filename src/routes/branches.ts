import { Router, type Request, type Response, type NextFunction } from 'express';
import { OK } from '../constants/httpStatus';
import { listBranchesQuerySchema } from '../schemas/branch';
import { listBranches } from '../services/branchService';
import { success } from '../utils/response';

const router = Router();

router.get('/branches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listBranchesQuerySchema.parse(req.query);
    const branches = await listBranches(query);
    res.status(OK).json(success(branches, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

export default router;
