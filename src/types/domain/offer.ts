export type OfferType =
  | 'threshold_coupon'
  | 'branch_deal'
  | 'single_product'
  | 'salary_week'
  | 'bundle';

export type OfferStatus = 'planned' | 'live' | 'ended';

export interface Offer {
  id: string;
  planId: string;
  brandId: string;
  name: string;
  type: OfferType;
  branchIds: string[];
  startDate: string;
  endDate: string;
  productsText: string | null;
  mechanicText: string | null;
  budgetAmount: number | null;
  assigneeId: string;
  status: OfferStatus;
  createdAt: string;
}
