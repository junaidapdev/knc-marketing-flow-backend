export interface ErrorDefinition {
  readonly code: string;
  readonly message: string;
}

export const ERRORS = {
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    message: 'The request failed validation.',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication is required to access this resource.',
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    message: 'The provided authentication token is invalid.',
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'The provided authentication token has expired.',
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected internal error occurred.',
  },
  DB_ERROR: {
    code: 'DB_ERROR',
    message: 'The database rejected the request.',
  },
  DB_CONNECTION_FAILED: {
    code: 'DB_CONNECTION_FAILED',
    message: 'Unable to reach the database.',
  },
  PLAN_NOT_FOUND: {
    code: 'PLAN_NOT_FOUND',
    message: 'The requested plan does not exist.',
  },
  PLAN_ALREADY_PUBLISHED: {
    code: 'PLAN_ALREADY_PUBLISHED',
    message: 'A published plan cannot be deleted.',
  },
  PLAN_DUPLICATE_MONTH: {
    code: 'PLAN_DUPLICATE_MONTH',
    message: 'A plan already exists for that month and year.',
  },
  ENTRY_NOT_FOUND: {
    code: 'ENTRY_NOT_FOUND',
    message: 'The requested calendar entry does not exist.',
  },
  ENTRY_DATE_OUT_OF_PLAN: {
    code: 'ENTRY_DATE_OUT_OF_PLAN',
    message: 'The entry date must fall within the plan month and year.',
  },
  TASK_NOT_FOUND: {
    code: 'TASK_NOT_FOUND',
    message: 'The requested task does not exist.',
  },
  INVALID_TASK_TRANSITION: {
    code: 'INVALID_TASK_TRANSITION',
    message: "The requested status change is not allowed from the task's current status.",
  },
  ROLE_ASSIGNEE_MISSING: {
    code: 'ROLE_ASSIGNEE_MISSING',
    message: 'No active assignee is configured for one of the required roles.',
  },
  TEMPLATE_NOT_FOUND: {
    code: 'TEMPLATE_NOT_FOUND',
    message: 'The requested recurring template does not exist.',
  },
  OFFER_NOT_FOUND: {
    code: 'OFFER_NOT_FOUND',
    message: 'The requested offer does not exist.',
  },
  SHOP_ACTIVITY_NOT_FOUND: {
    code: 'SHOP_ACTIVITY_NOT_FOUND',
    message: 'The requested shop activity does not exist.',
  },
  BUDGET_ENTRY_NOT_FOUND: {
    code: 'BUDGET_ENTRY_NOT_FOUND',
    message: 'The requested budget entry does not exist.',
  },
  INVALID_DATE_RANGE: {
    code: 'INVALID_DATE_RANGE',
    message: 'The end date must be on or after the start date.',
  },
  STORAGE_UPLOAD_FAILED: {
    code: 'STORAGE_UPLOAD_FAILED',
    message: 'Could not prepare the upload. Please try again.',
  },
  SOCIAL_ACCOUNT_NOT_FOUND: {
    code: 'SOCIAL_ACCOUNT_NOT_FOUND',
    message: 'No social account is configured for the requested platform.',
  },
  SOCIAL_SYNC_FAILED: {
    code: 'SOCIAL_SYNC_FAILED',
    message: 'The social sync run hit an error. Check the sync log for details.',
  },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = (typeof ERRORS)[keyof typeof ERRORS]['code'];
