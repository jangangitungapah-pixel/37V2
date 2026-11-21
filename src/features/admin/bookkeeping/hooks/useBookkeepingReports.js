import { useMemo } from 'react';

import { buildExpenseCategoryBreakdown } from '../utils/bookkeeping-calculation';

/**
 * Derives period expense category breakdown and ECharts data cleanly from real records.
 */
export function useBookkeepingReports({
  entries = [],
  activePayables = [],
  periodBounds = null,
} = {}) {
  const categoryBreakdown = useMemo(
    () =>
      buildExpenseCategoryBreakdown({
        bookkeepingEntries: entries,
        activePayables,
        periodBounds,
      }),
    [entries, activePayables, periodBounds],
  );

  const totalBreakdownAmount = useMemo(
    () => categoryBreakdown.reduce((acc, item) => acc + item.amount, 0),
    [categoryBreakdown],
  );

  return {
    categoryBreakdown,
    totalBreakdownAmount,
  };
}
