import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, RefreshCw } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';
import { INVOICE_STATUS } from '@/features/admin/payment/utils/invoice-status';
import {
  PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE,
  PAYMENT_EVIDENCE_SOURCES,
  PAYMENT_EVIDENCE_STATUSES,
} from '@/features/payment-evidence/config/payment-evidence-config';
import { useClientPaymentEvidence } from '@/features/payment-evidence/hooks/useClientPaymentEvidence';
import { summarizePendingEvidence } from '@/features/payment-evidence/utils/payment-evidence-utils';

import { formatClientRupiah } from '../utils/client-billing-utils';
import { ClientPaymentEvidenceForm } from './ClientPaymentEvidenceForm';
import { ClientPaymentEvidenceTimeline } from './ClientPaymentEvidenceTimeline';

/**
 * Payment Evidence & Verification panel embedded inside `ClientInvoiceDetailDrawer`.
 *
 * Visibility contract (Phase 3 / OD-05 Multi-Pending):
 * - Shows upload form when:
 *   `invoice.invoiceStatus === 'issued' && invoice.clientPaymentEvidenceRequired === true && invoice.balanceDue > 0`
 *   AND `pendingCount < PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE` (50).
 * - Allows multiple concurrent `pending_review` receipts (installments / split transfers)
 *   while clearly summarizing pending claimed totals and enforcing the hard lock cap of 50.
 * - Preserves evidence timeline for verified/rejected/fully-paid invoices.
 */
export function ClientPaymentEvidencePanel({
  invoice,
  customEvidenceAdapter = null,
  cloudinaryConfig = null,
}) {
  const { items, isLoading, error, retry } = useClientPaymentEvidence({
    invoiceId: invoice?.id || '',
    enabled: Boolean(invoice?.id),
    customAdapter: customEvidenceAdapter,
  });

  if (!invoice) return null;

  const isIssued = invoice.invoiceStatus === INVOICE_STATUS.ISSUED;
  const requiresEvidence = Boolean(invoice.clientPaymentEvidenceRequired);
  const hasOutstandingBalance = (Number(invoice.balanceDue) || 0) > 0;
  const isEligibleForUpload = isIssued && requiresEvidence && hasOutstandingBalance;

  const clientSubmissions = items.filter(
    (ev) => ev.evidenceSource === PAYMENT_EVIDENCE_SOURCES.CLIENT_PORTAL,
  );
  const pendingSummary = summarizePendingEvidence(clientSubmissions, invoice.balanceDue);
  const pendingCount = pendingSummary.pendingCount;
  const hasPendingSubmission = pendingCount > 0;
  const isPendingLimitReached = pendingCount >= PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE;
  const latestSubmission = clientSubmissions[0] || null;
  const isLatestRejected = latestSubmission?.status === PAYMENT_EVIDENCE_STATUSES.REJECTED;

  // For historical / Admin-managed invoices without mandatory flag and no evidence records,
  // retain the existing Phase 4 billing drawer experience untouched.
  if (!requiresEvidence && items.length === 0 && !error) {
    return null;
  }

  const shouldRenderForm = isEligibleForUpload && !isPendingLimitReached;

  const handleFocusResubmitForm = () => {
    const amountField = document.getElementById('client-evidence-amount');
    if (amountField) {
      amountField.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      amountField.focus?.();
    }
  };

  return (
    <section
      aria-label="Payment evidence and verification"
      data-testid="client-payment-evidence-panel"
      className="space-y-3 rounded-2xl border border-[#151515]/12 bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
          <div>
            <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
              Payment Proof &amp; Verification
            </h3>
            <p className="mt-0.5 text-[11px] text-[#666159]">
              {isEligibleForUpload
                ? hasPendingSubmission
                  ? `${pendingCount} payment ${pendingCount === 1 ? 'proof is' : 'proofs are'} awaiting studio review. You can upload additional receipts if paying in installments.`
                  : `Upload your payment receipt (${formatClientRupiah(invoice.balanceDue)} remaining) so our team can verify and record your payment.`
                : !hasOutstandingBalance && isIssued
                  ? 'Invoice settled in full. Your verified payment proof history is preserved below.'
                  : 'Submitted payment evidence history for this invoice.'}
            </p>
          </div>
        </div>

        {hasPendingSubmission ? (
          <AdminStatusBadge tone="amber" size="sm" dot>
            {pendingCount > 1 ? `Under Review (${pendingCount})` : 'Under Review'}
          </AdminStatusBadge>
        ) : !hasOutstandingBalance && isIssued ? (
          <AdminStatusBadge tone="emerald" size="sm" dot>
            Paid
          </AdminStatusBadge>
        ) : isLatestRejected && isEligibleForUpload ? (
          <AdminStatusBadge tone="danger" size="sm">
            Resubmission Needed
          </AdminStatusBadge>
        ) : isEligibleForUpload ? (
          <AdminStatusBadge tone="orange" size="sm">
            Evidence Required
          </AdminStatusBadge>
        ) : null}
      </div>

      {isLoading && items.length === 0 ? (
        <div className="h-16 w-full animate-pulse rounded-xl bg-[#151515]/[0.06]" />
      ) : error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs text-[#B92B0C]"
        >
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </span>
          <button
            type="button"
            onClick={retry}
            className="sa-btn-secondary inline-flex min-h-8 cursor-pointer items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Try Again</span>
          </button>
        </div>
      ) : null}

      {/* Pending Review Summary Banner (multi-pending allowed up to 50) */}
      {isEligibleForUpload && hasPendingSubmission ? (
        <div
          data-testid="client-evidence-pending-banner"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-[#FEF4DD]/65 p-3 text-xs text-[#8A4B08]"
        >
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-[#151515]">
              {pendingCount} Pending Verification{pendingCount > 1 ? 's' : ''} (Total Claimed:{' '}
              <span className="font-mono">
                {formatClientRupiah(pendingSummary.totalPendingClaimed)}
              </span>
              )
            </p>
            <p className="leading-relaxed text-[#46433D]">
              Your invoice balance updates only after studio staff verifies each receipt. If you
              paid in multiple transfers, you may upload another proof below (maximum{' '}
              {PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE} pending receipts per invoice).
            </p>
            {pendingSummary.exceedsBalance ? (
              <p className="font-medium text-[#B92B0C]">
                Note: Combined pending claimed amounts exceed your remaining balance (
                {formatClientRupiah(invoice.balanceDue)}). Only verified amounts up to the remaining
                balance will apply.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isEligibleForUpload && isPendingLimitReached ? (
        <div
          role="alert"
          data-testid="client-evidence-pending-limit-banner"
          className="flex items-start gap-2.5 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs text-[#B92B0C]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Maximum of {PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE} pending payment proofs reached for
            this invoice. Please wait for the studio team to review an existing submission before
            uploading another proof.
          </span>
        </div>
      ) : null}

      {/* Paid Completion Summary */}
      {isIssued && !hasOutstandingBalance && items.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-[#E6F6EC]/60 px-3 py-2 text-xs font-medium text-[#0F6246]">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Invoice fully paid — no further payment proof required.</span>
        </div>
      ) : null}

      {/* Submission History Timeline */}
      {items.length > 0 ? (
        <ClientPaymentEvidenceTimeline
          items={items}
          canResubmit={shouldRenderForm}
          onStartResubmit={handleFocusResubmitForm}
        />
      ) : null}

      {/* Mandatory Payment Proof Submission Form */}
      {shouldRenderForm ? (
        <div className={items.length > 0 ? 'border-t border-[#151515]/10 pt-3.5' : ''}>
          {isLatestRejected ? (
            <p className="mb-2.5 text-xs font-semibold text-[#151515]">
              Submit Corrected Payment Proof
            </p>
          ) : hasPendingSubmission ? (
            <p className="mb-2.5 text-xs font-semibold text-[#151515]">
              Upload Additional Payment Proof
            </p>
          ) : null}
          <ClientPaymentEvidenceForm
            key={`${invoice.id}:${invoice.balanceDue}:${clientSubmissions.length}`}
            invoice={invoice}
            existingEvidence={clientSubmissions}
            customEvidenceAdapter={customEvidenceAdapter}
            cloudinaryConfig={cloudinaryConfig}
          />
        </div>
      ) : null}
    </section>
  );
}
