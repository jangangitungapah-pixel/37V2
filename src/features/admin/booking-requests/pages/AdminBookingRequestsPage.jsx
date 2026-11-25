import { useMemo, useState } from 'react';
import { Inbox, Settings2 } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { AdminButton, AdminPageHeader, AdminStatusBadge } from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { BookingRequestDetailDrawer } from '../components/BookingRequestDetailDrawer';
import { BookingRequestList } from '../components/BookingRequestList';
import { BookingRequestToolbar } from '../components/BookingRequestToolbar';
import { WhatsAppTemplateManager } from '../components/WhatsAppTemplateManager';
import { useBookingRequests } from '../hooks/useBookingRequests';

export function AdminBookingRequestsPage() {
  const { user, profile, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const actorUid = user?.uid || profile?.uid || '';
  const actorName = profile?.displayName || user?.displayName || profile?.email || '';
  const actorRole = String(role || profile?.role || '').toLowerCase();
  const isOwner = actorRole === 'owner';

  const [statusFilter, setStatusFilter] = useState('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [preferredDateFilter, setPreferredDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);

  const selectedRequestId = searchParams.get('requestId') || '';

  const {
    filteredRequests,
    summaryCounts,
    isLoading,
    error,
    isTruncated,
    hasMore,
    isLoadingMore,
    loadMoreError,
    maxLimit,
    loadMore,
    retry,
  } = useBookingRequests({
    statusFilter,
    requestTypeFilter,
    serviceFilter,
    preferredDateFilter,
    searchQuery,
  });

  const hasActiveFilters = useMemo(
    () =>
      statusFilter !== 'all' ||
      requestTypeFilter !== 'all' ||
      serviceFilter !== 'all' ||
      Boolean(preferredDateFilter) ||
      Boolean(searchQuery.trim()),
    [statusFilter, requestTypeFilter, serviceFilter, preferredDateFilter, searchQuery],
  );

  const handleResetFilters = () => {
    setStatusFilter('all');
    setRequestTypeFilter('all');
    setServiceFilter('all');
    setPreferredDateFilter('');
    setSearchQuery('');
  };

  const handleSelectRequest = (reqId) => {
    const next = new URLSearchParams(searchParams);
    if (reqId) {
      next.set('requestId', reqId);
    } else {
      next.delete('requestId');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div data-calendar-scoped="true" className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        compactMobile
        eyebrow="CUSTOMER OPERATIONS"
        icon={Inbox}
        title="Booking Requests"
        titleId="incoming-booking-requests-heading"
        description="Satu inbox untuk permintaan Studio Booking dan proyek Mix & Master dari seluruh kanal."
        meta={
          <AdminStatusBadge
            tone={summaryCounts.newCount > 0 ? 'orange' : 'emerald'}
            size="sm"
            dot={summaryCounts.newCount > 0}
          >
            {summaryCounts.newCount > 0 ? `${summaryCounts.newCount} baru` : 'Tidak ada request baru'}
          </AdminStatusBadge>
        }
        actions={
          isOwner ? (
            <AdminButton
              variant="secondary"
              size="sm"
              onClick={() => setTemplateManagerOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Template WhatsApp</span>
            </AdminButton>
          ) : null
        }
      />

      <BookingRequestToolbar
        summaryCounts={summaryCounts}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        requestTypeFilter={requestTypeFilter}
        onRequestTypeFilterChange={setRequestTypeFilter}
        serviceFilter={serviceFilter}
        onServiceFilterChange={setServiceFilter}
        preferredDateFilter={preferredDateFilter}
        onPreferredDateFilterChange={setPreferredDateFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-bold tracking-tight text-[#151515] sm:text-base">
          Permintaan Masuk
        </h2>
        <span className="font-mono text-[11px] font-medium text-[#666159] tabular-nums">
          {isLoading ? 'Memuat inbox...' : error ? 'Inbox tidak tersedia' : `${filteredRequests.length} hasil · ${summaryCounts.totalLoaded} dimuat`}
        </span>
      </div>

      <BookingRequestList
        requests={filteredRequests}
        selectedRequestId={selectedRequestId}
        onSelectRequest={handleSelectRequest}
        isLoading={isLoading}
        error={error}
        onRetry={retry}
        isTruncated={isTruncated}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        loadMoreError={loadMoreError}
        onLoadMore={loadMore}
        maxLimit={maxLimit}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
      />

      <BookingRequestDetailDrawer
        key={selectedRequestId || 'closed'}
        requestId={selectedRequestId}
        open={Boolean(selectedRequestId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            handleSelectRequest('');
          }
        }}
        actorUid={actorUid}
        actorName={actorName}
      />

      {isOwner ? (
        <WhatsAppTemplateManager
          open={templateManagerOpen}
          onOpenChange={setTemplateManagerOpen}
          actorUid={actorUid}
          actorRole={actorRole}
        />
      ) : null}
    </div>
  );
}

export default AdminBookingRequestsPage;
