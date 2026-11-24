import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, RefreshCw } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';
import { INVOICE_STATUS } from '@/features/admin/payment/utils/invoice-status';
import {
  PAYMENT_EVIDENCE_SOURCES,
  PAYMENT_EVIDENCE_STATUSES,
} from '@/features/payment-evidence/config/payment-evidence-config';
import { useClientPaymentEvidence } from '@/features/payment-evidence/hooks/useClientPaymentEvidence';

import { formatClientRupiah } from '../utils/client-billing-utils';
import { ClientPaymentEvidenceForm } from './ClientPaymentEvidenceForm';
import { ClientPaymentEvidenceTimeline } from './ClientPaymentEvidenceTimeline';

/**
 * Payment Evidence & Verification panel embedded inside `ClientInvoiceDetailDrawer`.
 *
 * Visibility contract (Section 8A):
 * - Shows upload form ONLY when:
 *   `invoice.invoiceStatus === 'issued' && invoice.clientPaymentEvidenceRequired === true && invoice.balanceDue > 0`
 * - Hides upload form while a `pending_review` submission is active (prevents accidental duplicates).
 * - Preserves evidence timeline for verified/rejected/fully-paid invoices.
 * - Does not display mandatory form for draft, void, paid, or non-Client-Portal invoices.
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
  const hasPendingSubmission = clientSubmissions.some(
    (ev) => ev.status === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW,
  );
  const latestSubmission = clientSubmissions[0] || null;
  const isLatestRejected = latestSubmission?.status === PAYMENT_EVIDENCE_STATUSES.REJECTED;

  // For historical / Admin-managed invoices without mandatory flag and no evidence records,
  // retain the existing Phase 4 billing drawer experience untouched.
  if (!requiresEvidence && items.length === 0 && !error) {
    return null;
  }

  const shouldRenderForm = isEligibleForUpload && !hasPendingSubmission;

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
                  ? 'Your latest payment proof is currently being reviewed by the studio team.'
                  : `Upload your payment receipt (${formatClientRupiah(invoice.balanceDue)} remaining) so our team can verify and record your payment.`
                : !hasOutstandingBalance && isIssued
                  ? 'Invoice settled in full. Your verified payment proof history is preserved below.'
                  : 'Submitted payment evidence history for this invoice.'}
            </p>
          </div>
        </div>

        {hasPendingSubmission ? (
          <AdminStatusBadge tone="amber" size="sm" dot>
            Under Review
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

      {/* Pending Review Callout (blocks duplicate submission while awaiting review) */}
      {isEligibleForUpload && hasPendingSubmission ? (
        <div
          data-testid="client-evidence-pending-banner"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-[#FEF4DD]/65 p-3 text-xs text-[#8A4B08]"
        >
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[#151515]">Waiting for Studio Verification</p>
            <p className="mt-0.5 leading-relaxed text-[#46433D]">
              We received your payment proof. Your invoice balance will update automatically once
              verified by our studio desk.
            </p>
          </div>
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
          canResubmit={isEligibleForUpload && !hasPendingSubmission}
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
          ) : null}
          <ClientPaymentEvidenceForm
            key={`${invoice.id}:${invoice.balanceDue}:${clientSubmissions.length}`}
            invoice={invoice}
            customEvidenceAdapter={customEvidenceAdapter}
            cloudinaryConfig={cloudinaryConfig}
          />
        </div>
      ) : null}
    </section>
  );
}
