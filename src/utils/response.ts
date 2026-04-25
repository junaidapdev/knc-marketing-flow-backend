import type { ApiFailure, ApiMeta, ApiSuccess } from '../types/api/envelope';

interface SuccessMetaInput {
  requestId?: string;
  [key: string]: unknown;
}

interface ErrorMetaInput extends SuccessMetaInput {}

function buildMeta(input?: SuccessMetaInput): ApiMeta {
  const { requestId, ...rest } = input ?? {};
  return {
    timestamp: new Date().toISOString(),
    requestId: requestId ?? 'unknown',
    ...rest,
  };
}

export function success<T>(data: T, meta?: SuccessMetaInput): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta: buildMeta(meta),
  };
}

export function error(
  code: string,
  message: string,
  details?: unknown,
  meta?: ErrorMetaInput,
): ApiFailure {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: buildMeta(meta),
  };
}
