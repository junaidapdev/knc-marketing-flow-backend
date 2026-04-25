import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ERRORS } from '../constants/errors';
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL,
  NOT_FOUND,
  UNAUTHORIZED,
  UNPROCESSABLE,
} from '../constants/httpStatus';
import { logger } from '../utils/logger';
import { error as errorEnvelope } from '../utils/response';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(NOT_FOUND).json(
    errorEnvelope(ERRORS.NOT_FOUND.code, ERRORS.NOT_FOUND.message, undefined, {
      requestId: req.requestId,
    }),
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    logger.warn({ err: err.flatten(), requestId }, 'validation error');
    res
      .status(UNPROCESSABLE)
      .json(
        errorEnvelope(
          ERRORS.VALIDATION_FAILED.code,
          ERRORS.VALIDATION_FAILED.message,
          err.flatten(),
          { requestId },
        ),
      );
    return;
  }

  if (err instanceof HttpError) {
    logger.warn(
      { err: { code: err.code, message: err.message, details: err.details }, requestId },
      'http error',
    );
    res.status(err.status).json(errorEnvelope(err.code, err.message, err.details, { requestId }));
    return;
  }

  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: number }).status === BAD_REQUEST
  ) {
    res.status(BAD_REQUEST).json(
      errorEnvelope(ERRORS.VALIDATION_FAILED.code, 'Malformed JSON body.', undefined, {
        requestId,
      }),
    );
    return;
  }

  logger.error({ err, requestId }, 'unhandled error');
  res.status(INTERNAL).json(
    errorEnvelope(ERRORS.INTERNAL_ERROR.code, ERRORS.INTERNAL_ERROR.message, undefined, {
      requestId,
    }),
  );
}

export const HTTP_STATUS_BY_CODE: Readonly<Record<string, number>> = Object.freeze({
  [ERRORS.VALIDATION_FAILED.code]: UNPROCESSABLE,
  [ERRORS.UNAUTHORIZED.code]: UNAUTHORIZED,
  [ERRORS.FORBIDDEN.code]: FORBIDDEN,
  [ERRORS.NOT_FOUND.code]: NOT_FOUND,
  [ERRORS.INTERNAL_ERROR.code]: INTERNAL,
});
