import { z } from 'zod';

const TASK_STATUSES = ['pending', 'in_progress', 'done', 'skipped'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_NOTES_LENGTH = 2000;

export const taskDateSchema = z.string().regex(ISO_DATE, { message: 'Expected YYYY-MM-DD' });

export const listTasksQuerySchema = z.object({
  assigneeId: z.string().uuid().optional(),
  dueDate: taskDateSchema.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  planId: z.string().uuid().optional(),
});

export const updateTaskSchema = z
  .object({
    status: z.enum(TASK_STATUSES),
    notes: z.string().max(MAX_NOTES_LENGTH).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required',
  });

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
