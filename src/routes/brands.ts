import { Router, type Request, type Response, type NextFunction } from 'express';
import { OK } from '../constants/httpStatus';
import { listBrandsQuerySchema } from '../schemas/brand';
import { listBrands } from '../services/brandService';
import { success } from '../utils/response';

const router = Router();

router.get('/brands', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { includeInactive } = listBrandsQuerySchema.parse(req.query);
    const brands = await listBrands({ includeInactive });
    res.status(OK).json(success(brands, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

export default router;
