import { useMemo, useState } from 'react';

import { AdminPageHeader, AdminStatusBadge } from '@/features/admin/design-system';
import { useClientPaymentEvidence } from '@/features/payment-evidence/hooks/useClientPaymentEvidence';
import { usePublicSiteSettings } from '@/features/public-site-settings/hooks/usePublicSiteSettings';

import { ClientBillingOverview } from '../billing/components/ClientBillingOverview';
import { ClientInvoiceDetailDrawer } from '../billing/components/ClientInvoiceDetailDrawer';
import { ClientInvoiceList } from '../billing/components/ClientInvoiceList';
import { useClientInvoices } from '../billing/hooks/useClientInvoices';
import { filterClientInvoices } from '../billing/utils/client-billing-utils';

export function ClientInvoicesPage({
  now,
  customAdapter = null,
  customEvidenceAdapter = null,
  cloudinaryConfig = null,
} = {}) {
  const {
    invoices,
    metrics,
    referenceDateIso,
    isLoading,
    hasMore,
    isTruncated,
    error,
    retry,
    loadMore,
  } = useClientInvoices({ now, customAdapter });

  const evidenceInvoiceIds = useMemo(
    () => invoices
      .map((invoice) => String(invoice?.id || '').trim())
      .filter(Boolean),
    [invoices],
  );

  const { evidenceByInvoiceId } = useClientPaymentEvidence({
    invoiceIds: evidenceInvoiceIds,
    enabled: !isLoading && !error,
    customAdapter: customEvidenceAdapter,
  });

  const { settings: siteSettings } = usePublicSiteSettings();
  const studioName = siteSettings?.studioName || '37 Music Studio';
  const publicWhatsappNumber = siteSettings?.publicWhatsappNumber || '';

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

  const filteredInvoices = useMemo(
    () =>
      filterClientInvoices({
        invoices,
        statusFilter,
        searchQuery,
        referenceDateIso,
      }),
    [invoices, referenceDateIso, searchQuery, statusFilter],
  );

  const selectedFallbackInvoice = useMemo(
    () => invoices.find((inv) => inv.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId],
  );

  return (
    <div data-testid="client-invoices-page" className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        eyebrow="BILLING WORKSPACE"
        titleId="client-invoices-heading"
        title="Invoices & Payments"
        description="Review your studio invoices, payment status, and verified payment records."
        keepDescriptionOnMobile
        meta={
          <AdminStatusBadge
            tone={error ? 'danger' : isLoading ? 'ivory' : 'lime'}
            dot={!isLoading && !error}
          >
            {error ? 'Unavailable' : isLoading ? 'Loading...' : 'Live Updates'}
          </AdminStatusBadge>
        }
      />

      {/* Module A: Billing Overview */}
      <ClientBillingOverview
        metrics={metrics}
        isLoading={isLoading}
        error={error}
        onRetry={retry}
      />

      {/* Module B: Invoice Directory */}
      <ClientInvoiceList
        invoices={filteredInvoices}
        totalInvoiceCount={invoices.length}
        filterCounts={metrics.filterCounts}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        referenceDateIso={referenceDateIso}
        evidenceByInvoiceId={evidenceByInvoiceId}
        isLoading={isLoading}
        hasMore={hasMore}
        isTruncated={isTruncated}
        onLoadMore={loadMore}
        error={error}
        onRetry={retry}
        onSelectInvoice={(invoice) => setSelectedInvoiceId(invoice?.id || '')}
      />

      {/* Module C, D, E, F: Invoice Detail Drawer, Payment Timeline, Evidence Upload, Print & WhatsApp CTA */}
      <ClientInvoiceDetailDrawer
        open={Boolean(selectedInvoiceId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedInvoiceId('');
        }}
        invoiceId={selectedInvoiceId}
        fallbackInvoice={selectedFallbackInvoice}
        referenceDateIso={referenceDateIso}
        studioName={studioName}
        publicWhatsappNumber={publicWhatsappNumber}
        customAdapter={customAdapter}
        customEvidenceAdapter={customEvidenceAdapter}
        cloudinaryConfig={cloudinaryConfig}
      />
    </div>
  );
}

export default ClientInvoicesPage;
