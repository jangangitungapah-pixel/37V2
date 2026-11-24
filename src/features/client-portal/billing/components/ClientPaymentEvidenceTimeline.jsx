import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';

import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';
import { PaymentEvidencePreview } from '@/features/payment-evidence/components/PaymentEvidencePreview';
import { PAYMENT_EVIDENCE_STATUSES } from '@/features/payment-evidence/config/payment-evidence-config';
import { getPaymentEvidenceStatusMeta } from '@/features/payment-evidence/utils/payment-evidence-utils';

import {
  formatClientRupiah,
  getClientPaymentMethodLabel,
} from '../utils/client-billing-utils';

/**
 * Customer-safe payment evidence submission timeline inside Client Invoice Detail Drawer.
 * Never displays internal reviewer UIDs, submitter UIDs, customerId, or linkedTransactionId.
 */
export function ClientPaymentEvidenceTimeline({
  items = [],
  canResubmit = false,
  onStartResubmit,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div data-testid="client-payment-evidence-timeline" className="space-y-2.5">
      <ul className="space-y-2.5">
        {items.map((item, idx) => {
          const statusMeta = getPaymentEvidenceStatusMeta(item.status, { locale: 'en' });
          const isPending = item.status === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW;
          const isVerified = item.status === PAYMENT_EVIDENCE_STATUSES.VERIFIED;
          const isRejected = item.status === PAYMENT_EVIDENCE_STATUSES.REJECTED;
          const submittedLabel = formatIndonesianTimestamp(item.submittedAt);
          const paidDateLabel = item.claimedPaidAt
            ? formatIndonesianDateMedium(item.claimedPaidAt)
            : '—';

          return (
            <li
              key={item.id}
              data-testid={`client-evidence-item-${item.status}`}
              className={`rounded-xl border p-3.5 text-xs ${
                isPending
                  ? 'border-amber-500/25 bg-[#FEF4DD]/45'
                  : isVerified
                    ? 'border-emerald-500/25 bg-[#E6F6EC]/50'
                    : isRejected
                      ? 'border-[#FF4B22]/25 bg-[#FFEDE8]/55'
                      : 'border-[#151515]/10 bg-[#FAF8F3]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <PaymentEvidencePreview
                    evidence={item.evidence}
                    size="sm"
                    locale="en"
                    showMeta={false}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AdminStatusBadge tone={statusMeta.tone} size="sm" dot={isPending || isVerified}>
                        {statusMeta.label}
                      </AdminStatusBadge>
                      <span className="font-mono text-[11px] font-bold text-[#151515] tabular-nums">
                        {isVerified && item.verifiedAmount != null
                          ? formatClientRupiah(item.verifiedAmount)
                          : formatClientRupiah(item.claimedAmount)}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-[#46433D]">
                      {getClientPaymentMethodLabel(item.paymentMethod)} · Paid date: {paidDateLabel}
                    </p>
                    {item.referenceNumber ? (
                      <p className="mt-0.5 font-mono text-[11px] text-[#46433D]">
                        Ref: {item.referenceNumber}
                      </p>
                    ) : null}
                    {submittedLabel && submittedLabel !== '-' ? (
                      <p className="mt-0.5 font-mono text-[10px] text-[#8B857B]">
                        Submitted: {submittedLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {isPending ? (
                <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-white/80 px-2.5 py-2 text-[11px] text-[#8A4B08]">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Evidence received and awaiting studio verification. Your invoice balance has not
                    changed yet.
                  </span>
                </div>
              ) : null}

              {isVerified ? (
                <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-white/80 px-2.5 py-2 text-[11px] text-[#0F6246]">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Payment verified by the studio team (
                    <strong>{formatClientRupiah(item.verifiedAmount ?? item.claimedAmount)}</strong>
                    ). Official payment record added to Payment History.
                  </span>
                </div>
              ) : null}

              {isRejected ? (
                <div className="mt-2.5 space-y-2 rounded-lg bg-white/85 px-2.5 py-2 text-[11px] text-[#B92B0C]">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Submission rejected by studio team</p>
                      {item.rejectionReason ? (
                        <p className="mt-0.5 text-[#46433D]">Reason: {item.rejectionReason}</p>
                      ) : null}
                      <p className="mt-0.5 text-[#666159]">
                        You can submit a clearer or corrected payment proof below.
                      </p>
                    </div>
                  </div>
                  {idx === 0 && canResubmit && onStartResubmit ? (
                    <button
                      type="button"
                      onClick={onStartResubmit}
                      className="sa-btn-secondary inline-flex min-h-8 cursor-pointer items-center gap-1.5 px-3 py-1 text-[11px] font-semibold"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      <span>Submit Corrected Proof</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
