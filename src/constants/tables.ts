export const TABLES = Object.freeze({
  BRAND: 'brand',
  BRANCH: 'branch',
  ASSIGNEE: 'assignee',
  PLAN: 'plan',
  CALENDAR_ENTRY: 'calendar_entry',
  TASK: 'task',
  RECURRING_TEMPLATE: 'recurring_template',
  SHOP_ACTIVITY: 'shop_activity',
  OFFER: 'offer',
  BUDGET_ENTRY: 'budget_entry',
  USER_SETTINGS: 'user_settings',
  SOCIAL_ACCOUNT: 'social_account',
  SOCIAL_SNAPSHOTS: 'social_snapshots',
  SOCIAL_POSTS: 'social_posts',
  SOCIAL_SYNC_LOG: 'social_sync_log',
} as const);

export type TableName = (typeof TABLES)[keyof typeof TABLES];
