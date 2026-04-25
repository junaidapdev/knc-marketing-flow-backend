import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { OK } from '../constants/httpStatus';
import { listTasksQuerySchema, updateTaskSchema } from '../schemas/task';
import { listTasks, listTasksDueToday, updateTaskStatus } from '../services/taskService';
import { success } from '../utils/response';

const idParamSchema = z.object({ id: z.string().uuid() });

const router = Router();

router.get('/tasks/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const grouped = await listTasksDueToday();
    res.status(OK).json(success(grouped, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.get('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = listTasksQuerySchema.parse(req.query);
    const tasks = await listTasks(filters);
    res.status(OK).json(success(tasks, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const patch = updateTaskSchema.parse(req.body);
    const task = await updateTaskStatus(id, patch);
    res.status(OK).json(success(task, { requestId: req.requestId }));
  } catch (err) {
    next(err);
  }
});

export default router;
