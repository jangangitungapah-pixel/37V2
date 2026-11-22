import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

import { AdminButton, AdminSurface } from '@/features/admin/design-system';

import { BookingRequestEmptyState } from './BookingRequestEmptyState';
import { BookingRequestListItem } from './BookingRequestListItem';

export function BookingRequestList({
  requests = [],
  selectedRequestId = '',
  onSelectRequest,
  isLoading = false,
  error = null,
  onRetry,
  isTruncated = false,
  hasMore = false,
  isLoadingMore = false,
  loadMoreError = '',
  onLoadMore,
  maxLimit = 50,
  hasActiveFilters = false,
  onResetFilters,
}) {
  if (error) {
    return (
      <AdminSurface
        role="alert"
        variant="card"
        className="flex flex-col items-start justify-between gap-3 border-red-300 bg-red-50/70 p-4 sm:flex-row sm:items-center"
      >
        <div className="flex items-start gap-2.5 text-xs text-red-900 sm:text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
        {onRetry ? (
          <AdminButton variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Coba Lagi</span>
          </AdminButton>
        ) : null}
      </AdminSurface>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2.5" aria-label="Memuat daftar booking request">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="h-24 animate-pulse rounded-2xl border border-[#151515]/[0.07] bg-white/70 p-4"
          />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <BookingRequestEmptyState
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {isTruncated ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-[#FEF4DD] px-3.5 py-2 text-xs text-[#6B3B08]"
        >
          <span>
            Menampilkan maksimal {maxLimit} request terbaru terlebih dahulu agar kueri tetap
            terkendali.
          </span>
        </div>
      ) : null}

      <div className="space-y-2.5">
        {requests.map((req) => (
          <BookingRequestListItem
            key={req.id}
            request={req}
            isSelected={req.id === selectedRequestId}
            onSelect={onSelectRequest}
          />
        ))}
      </div>

      {hasMore ? (
        <div className="flex flex-col items-center gap-2 pt-2">
          {loadMoreError ? (
            <p role="alert" className="text-xs font-medium text-red-700">
              {loadMoreError}
            </p>
          ) : null}
          <AdminButton variant="secondary" size="sm" disabled={isLoadingMore} onClick={onLoadMore}>
            {isLoadingMore ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>Memuat berikutnya...</span>
              </>
            ) : (
              <span>Muat Request Berikutnya</span>
            )}
          </AdminButton>
        </div>
      ) : null}
    </div>
  );
}
