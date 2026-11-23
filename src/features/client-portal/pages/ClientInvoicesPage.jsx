import { CheckCircle2, FileText, ReceiptText, Wallet } from 'lucide-react';

import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';

const INVOICE_PREVIEW_COLUMNS = [
  'Invoice Number',
  'Booking Reference',
  'Invoice Date',
  'Total Amount',
  'Amount Paid',
  'Balance Due',
  'Payment Status',
];

export function ClientInvoicesPage() {
  return (
    <div data-testid="client-invoices-page" className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        eyebrow="BILLING WORKSPACE"
        titleId="client-invoices-heading"
        title="Invoices & Payments"
        description="View your studio invoices and keep track of your payments."
        keepDescriptionOnMobile
        meta={<AdminStatusBadge tone="ivory">Billing Coming Soon</AdminStatusBadge>}
      />

      {/* Billing Summary Placeholders */}
      <section aria-labelledby="client-billing-summary-heading" className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h3
            id="client-billing-summary-heading"
            className="text-xs font-semibold tracking-wider text-[#666159] uppercase"
          >
            Billing Summary
          </h3>
          <span className="font-mono text-[10.5px] text-[#8B857B]">Read-only preview</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminMetricCard
            label="Total Outstanding"
            value="—"
            hint="Available once online billing launches"
            icon={Wallet}
            tone="orange"
          />
          <AdminMetricCard
            label="Total Paid"
            value="—"
            hint="Settled payments will appear once active"
            icon={CheckCircle2}
            tone="emerald"
          />
          <AdminMetricCard
            label="Unpaid Invoices"
            value="—"
            hint="Online invoice records coming soon"
            icon={FileText}
            tone="neutral"
          />
        </div>
      </section>

      {/* Spatial Invoice Ledger Preview */}
      <AdminSurface as="section" variant="card" className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#151515] sm:text-base">Studio Invoices</h3>
            <p className="text-xs text-[#666159]">
              Structured ledger layout prepared for upcoming Client Billing integration
            </p>
          </div>
          <AdminStatusBadge tone="neutral">No Ledger Active</AdminStatusBadge>
        </div>

        <div className="sa-panel-ivory mb-4 overflow-x-auto px-3 py-2.5">
          <div className="grid min-w-[680px] grid-cols-7 gap-3 font-mono text-[10.5px] font-semibold tracking-wide text-[#666159] uppercase">
            {INVOICE_PREVIEW_COLUMNS.map((col) => (
              <span key={col} className="truncate">
                {col}
              </span>
            ))}
          </div>
        </div>

        <AdminEmptyState
          icon={ReceiptText}
          tone="neutral"
          title="Invoices & Payment Records Not Connected Yet"
          description="Your invoices and payment history will appear here automatically after Client Billing integration is launched in an upcoming phase."
        />
      </AdminSurface>
    </div>
  );
}

export default ClientInvoicesPage;
