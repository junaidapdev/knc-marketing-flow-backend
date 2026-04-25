import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const HEADER = 'x-request-id';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = incoming && incoming.trim().length > 0 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader(HEADER, id);
  next();
}
