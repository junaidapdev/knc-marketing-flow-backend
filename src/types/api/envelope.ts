export interface ApiMeta {
  timestamp: string;
  requestId: string;
  [key: string]: unknown;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
