import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Router, type Request, type Response } from 'express';
import { OK } from '../constants/httpStatus';
import { success } from '../utils/response';

const pkgPath = join(__dirname, '..', '..', 'package.json');
const { version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.status(OK).json(
    success(
      {
        status: 'ok',
        version,
        uptime: process.uptime(),
      },
      { requestId: req.requestId },
    ),
  );
});

export default router;
