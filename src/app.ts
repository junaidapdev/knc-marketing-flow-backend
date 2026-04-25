import express, { type Express } from 'express';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import assigneesRouter from './routes/assignees';
import branchesRouter from './routes/branches';
import brandsRouter from './routes/brands';
import budgetEntriesRouter from './routes/budgetEntries';
import entriesRouter from './routes/entries';
import healthRouter from './routes/health';
import meRouter from './routes/me';
import notificationsRouter from './routes/notifications';
import offersRouter from './routes/offers';
import plansRouter from './routes/plans';
import settingsRouter from './routes/settings';
import shopActivitiesRouter from './routes/shopActivities';
import socialRouter from './routes/social';
import tasksRouter from './routes/tasks';
import templatesRouter from './routes/templates';
import wizardRouter from './routes/wizard';

export function buildApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(requestId);

  // Public routes
  app.use(healthRouter);

  // socialRouter owns its own auth middleware (`requireAuthOrService`)
  // so the cron Edge Function can invoke it with just the shared
  // SERVICE_TOKEN. Mounted before the global `requireAuth` so the JWT
  // check doesn't short-circuit the service-token path.
  app.use(socialRouter);

  // Authenticated routes
  app.use(requireAuth);
  app.use(meRouter);
  app.use(brandsRouter);
  app.use(branchesRouter);
  app.use(assigneesRouter);
  // wizardRouter before plansRouter so /plans/wizard doesn't get matched
  // against PATCH /plans/:id (the uuid guard would 422 "wizard").
  app.use(wizardRouter);
  app.use(plansRouter);
  app.use(entriesRouter);
  app.use(tasksRouter);
  app.use(templatesRouter);
  app.use(offersRouter);
  app.use(shopActivitiesRouter);
  app.use(budgetEntriesRouter);
  app.use(settingsRouter);
  app.use(notificationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
