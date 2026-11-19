import { useEffect, useState } from 'react';

import {
  COMMISSION_BATCHES_PAGE_SIZE,
  getCommissionRepositoryAdapter,
} from '../repositories/commission-repository';

/**
 * Subscribes to posted `commissionBatches` ordered newest first (`postedAt desc`).
 * Skips Firestore subscription entirely when `enabled === false`.
 */
export function useCommissionBatches({
  enabled = true,
  maxLimit = COMMISSION_BATCHES_PAGE_SIZE,
} = {}) {
  const activeKey = `${enabled ? '1' : '0'}:${maxLimit}`;

  const [state, setState] = useState({
    key: '',
    batches: [],
    hasMore: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const adapter = getCommissionRepositoryAdapter();
    const currentKey = activeKey;

    const unsubscribe = adapter.subscribeCommissionBatches({
      maxLimit,
      onData: ({ batches, hasMore }) => {
        setState({
          key: currentKey,
          batches: batches || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          key: currentKey,
          error: err?.message || 'Gagal memuat riwayat batch posting komisi.',
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [enabled, activeKey, maxLimit]);

  return {
    batches: enabled && state.key === activeKey ? state.batches : [],
    hasMore: enabled && state.key === activeKey ? state.hasMore : false,
    isLoading: Boolean(enabled && state.key !== activeKey),
    error: enabled ? state.error : null,
  };
}
