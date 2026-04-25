import { describe, expect, it } from 'vitest';
import { aggregateBudget } from '../src/services/budgetService';
import type { BudgetAggregationRow } from '../src/services/budgetService';

describe('aggregateBudget', () => {
  it('sums totals and groups by category', () => {
    const rows: BudgetAggregationRow[] = [
      { amount_sar: '100.00', category: 'general_marketing' },
      { amount_sar: '250.00', category: 'general_marketing' },
      { amount_sar: 400, category: 'influencers' },
    ];
    const result = aggregateBudget(rows, null, null);
    expect(result.totalSpent).toBe(750);
    expect(result.byCategory.general_marketing).toBe(350);
    expect(result.byCategory.influencers).toBe(400);
    expect(result.byCategory.camera_production).toBe(0);
    expect(result.vsLastMonth).toBeNull();
    expect(result.ceilingUsedPercent).toBeNull();
  });

  it('computes ceilingUsedPercent when ceiling > 0', () => {
    const rows: BudgetAggregationRow[] = [{ amount_sar: 500, category: 'general_marketing' }];
    const result = aggregateBudget(rows, null, 1000);
    expect(result.ceilingUsedPercent).toBe(50);
  });

  it('returns null ceilingUsedPercent when ceiling is 0 or null', () => {
    const rows: BudgetAggregationRow[] = [{ amount_sar: 500, category: 'general_marketing' }];
    expect(aggregateBudget(rows, null, 0).ceilingUsedPercent).toBeNull();
    expect(aggregateBudget(rows, null, null).ceilingUsedPercent).toBeNull();
  });

  it('computes vsLastMonth delta when previous rows are supplied', () => {
    const current: BudgetAggregationRow[] = [{ amount_sar: 600, category: 'general_marketing' }];
    const previous: BudgetAggregationRow[] = [{ amount_sar: 400, category: 'general_marketing' }];
    const result = aggregateBudget(current, previous, 1000);
    expect(result.vsLastMonth).toEqual({ total: 400, deltaPercent: 50 });
  });

  it('reports 0% delta when previous total is zero', () => {
    const current: BudgetAggregationRow[] = [{ amount_sar: 250, category: 'influencers' }];
    const result = aggregateBudget(current, [], null);
    expect(result.vsLastMonth).toEqual({ total: 0, deltaPercent: 0 });
  });
});
