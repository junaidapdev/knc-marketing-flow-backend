export type BudgetCategory =
  | 'general_marketing'
  | 'influencers'
  | 'in_shop_activities'
  | 'product_offers'
  | 'camera_production';

export type LinkedEntityType = 'calendar_entry' | 'offer' | 'shop_activity';

export interface BudgetEntry {
  id: string;
  planId: string;
  category: BudgetCategory;
  amountSar: number;
  date: string;
  description: string | null;
  branchId: string | null;
  linkedEntityType: LinkedEntityType | null;
  linkedEntityId: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

export interface BudgetDashboardComparison {
  total: number;
  deltaPercent: number;
}

export interface BudgetDashboard {
  totalSpent: number;
  byCategory: Record<BudgetCategory, number>;
  vsLastMonth: BudgetDashboardComparison | null;
  ceilingUsedPercent: number | null;
}
