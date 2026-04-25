export type ShopActivityType =
  | 'sampling'
  | 'display_change'
  | 'tasting'
  | 'promotion_setup'
  | 'other';

export type ShopActivityStatus = 'planned' | 'in_progress' | 'completed';

export interface ShopActivity {
  id: string;
  planId: string;
  branchId: string;
  weekOf: string;
  type: ShopActivityType;
  assigneeId: string;
  status: ShopActivityStatus;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
}
