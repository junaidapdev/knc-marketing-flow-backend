export type PlanStatus = 'draft' | 'published';

export interface Plan {
  id: string;
  month: number;
  year: number;
  budgetCeiling: number | null;
  status: PlanStatus;
  createdAt: string;
}

export interface PlanWithEntryCount extends Plan {
  entryCount: number;
}
