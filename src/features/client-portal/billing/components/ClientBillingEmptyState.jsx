import { AlertTriangle, CalendarPlus, FilterX, ReceiptText, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

import { AdminEmptyState } from '@/features/admin/design-system';

import { CLIENT_PORTAL_ROUTES } from '../../config/client-portal-config';

/**
 * Customer-friendly empty and error states for `/portal/invoices`.
 */
export function ClientBillingEmptyState({
  variant = 'no-invoices',
  errorMessage = '',
  onRetry,
  onResetFilters,
}) {
  if (variant === 'error') {
    return (
      <div data-testid="client-billing-error-state">
        <AdminEmptyState
          icon={AlertTriangle}
          tone="orange"
          title="Unable to load your invoices"
          description={
            errorMessage ||
            'We could not retrieve your studio invoices right now. Please check your connection and try again.'
          }
          action={
            onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Try Again</span>
              </button>
            ) : null
          }
        />
      </div>
    );
  }

  if (variant === 'no-matches') {
    return (
      <div data-testid="client-billing-no-matches-state">
        <AdminEmptyState
          icon={FilterX}
          tone="neutral"
          title="No matching invoices found"
          description="No invoices match your active status filter or search terms. Clear your filters to view all studio invoices."
          action={
            onResetFilters ? (
              <button
                type="button"
                onClick={onResetFilters}
                className="sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
              >
                <span>Clear Search & Filters</span>
              </button>
            ) : null
          }
        />
      </div>
    );
  }

  return (
    <div data-testid="client-billing-empty-state">
      <AdminEmptyState
        icon={ReceiptText}
        tone="lime"
        title="No studio invoices yet"
        description="Official studio invoices appear here automatically once your studio booking is confirmed by our desk."
        action={
          <Link
            to={CLIENT_PORTAL_ROUTES.BOOK}
            className="sa-btn-primary inline-flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Book a Session</span>
          </Link>
        }
      />
    </div>
  );
}
