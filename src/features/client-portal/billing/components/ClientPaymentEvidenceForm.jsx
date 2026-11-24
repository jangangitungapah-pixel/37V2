import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { parseMoneyInput } from '@/features/admin/calendar/utils/booking-pricing';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { SUPPORTED_PAYMENT_METHODS } from '@/features/admin/payment/utils/invoice-status';
import { useAuth } from '@/features/auth/AuthContext';
import { PaymentEvidenceUploadField } from '@/features/payment-evidence/components/PaymentEvidenceUploadField';
import { usePaymentEvidenceUpload } from '@/features/payment-evidence/hooks/usePaymentEvidenceUpload';
import { validateClientEvidenceSubmissionInput } from '@/features/payment-evidence/schemas/payment-evidence-schema';
import {
  mapPaymentEvidenceErrorToMessage,
  submitClientPaymentEvidence,
} from '@/features/payment-evidence/services/payment-evidence-service';
import { generatePaymentEvidenceId } from '@/features/payment-evidence/utils/payment-evidence-utils';

import {
  formatClientRupiah,
  getClientPaymentMethodLabel,
} from '../utils/client-billing-utils';

/**
 * Client Portal mandatory payment evidence submission form.
 * Never writes directly to `paymentTransactions` or updates invoice aggregates.
 * Preserves validated Cloudinary upload metadata if Firestore metadata save fails so retries
 * never upload duplicate images.
 */
export function ClientPaymentEvidenceForm({
  invoice,
  customEvidenceAdapter = null,
  cloudinaryConfig = null,
  onSubmitted,
}) {
  const { user, clientAccount } = useAuth();
  const upload = usePaymentEvidenceUpload({ cloudinaryConfig });

  const [submissionEvidenceId, setSubmissionEvidenceId] = useState(() =>
    generatePaymentEvidenceId('ev'),
  );
  const [amountInput, setAmountInput] = useState(() =>
    invoice?.balanceDue > 0 ? String(invoice.balanceDue) : '',
  );
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [claimedPaidAt, setClaimedPaidAt] = useState(() => getJakartaTodayIso());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!invoice) return null;

  const currentBalance = Number(invoice.balanceDue) || 0;
  const parsedAmount = parseMoneyInput(amountInput);
  const exceedsBalance = parsedAmount > currentBalance;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setFieldErrors({});
    setSubmitError('');

    const validation = validateClientEvidenceSubmissionInput(
      {
        claimedAmount: parsedAmount,
        paymentMethod,
        claimedPaidAt,
        referenceNumber,
      },
      currentBalance,
    );

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    if (!upload.selectedFile && !upload.hasPreservedUpload) {
      setFieldErrors({ evidence: 'Please attach a payment proof image before submitting.' });
      return;
    }

    setIsSubmitting(true);
    let uploadedAsset = null;
    try {
      // Step 1: Upload to Cloudinary once (or reuse preserved asset on Firestore retry)
      uploadedAsset = await upload.ensureUploaded();

      // Step 2: Persist `paymentEvidence/{evidenceId}` (`pending_review`) in Firestore
      upload.markSavingMetadata();
      const result = await submitClientPaymentEvidence({
        evidenceId: submissionEvidenceId,
        invoiceId: invoice.id,
        claimedAmount: validation.data.claimedAmount,
        paymentMethod: validation.data.paymentMethod,
        claimedPaidAt: validation.data.claimedPaidAt,
        referenceNumber: validation.data.referenceNumber,
        evidenceAsset: uploadedAsset,
        actorUid: user?.uid || '',
        customerId: clientAccount?.customerId || '',
        expectedCloudName: upload.config.cloudName,
        ...(customEvidenceAdapter ? { adapter: customEvidenceAdapter } : {}),
      });

      upload.markCompleted();
      toast.success('Payment proof submitted for studio verification.');
      // Reset local state and generate fresh operation ID for any future submission
      upload.reset();
      setSubmissionEvidenceId(generatePaymentEvidenceId('ev'));
      setReferenceNumber('');
      onSubmitted?.(result.evidence);
    } catch (err) {
      const friendly = mapPaymentEvidenceErrorToMessage(err, { locale: 'en' });
      if (uploadedAsset || upload.hasPreservedUpload) {
        upload.markMetadataFailed(
          `${friendly} Your image is already uploaded — click Retry Submission to save without re-uploading.`,
        );
      }
      setSubmitError(friendly);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      data-testid="client-payment-evidence-form"
      className="space-y-3.5"
    >
      {submitError ? (
        <div
          role="alert"
          data-testid="client-evidence-submit-error"
          className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      ) : null}

      {/* 1. Payment Amount */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="client-evidence-amount"
            className="block text-xs font-semibold text-[#151515]"
          >
            Payment Amount (IDR) <span className="text-[#FF4B22]">*</span>
          </label>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setAmountInput(String(currentBalance));
              setFieldErrors((prev) => ({ ...prev, claimedAmount: '' }));
            }}
            className="cursor-pointer rounded-full border border-[#8BAD12]/35 bg-[#EDF8C2] px-2.5 py-0.5 text-[11px] font-semibold text-[#243300] hover:bg-[#C8F13A]"
          >
            Full Balance ({formatClientRupiah(currentBalance)})
          </button>
        </div>

        <input
          id="client-evidence-amount"
          type="text"
          inputMode="numeric"
          disabled={isSubmitting}
          value={amountInput}
          onChange={(e) => {
            setAmountInput(e.target.value.replace(/[^\d]/g, ''));
            setFieldErrors((prev) => ({ ...prev, claimedAmount: '' }));
          }}
          placeholder="e.g. 250000"
          className="sa-input mt-1.5 h-10 w-full px-3 font-mono text-sm font-bold tabular-nums"
        />

        {exceedsBalance ? (
          <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
            Amount cannot exceed the current remaining balance ({formatClientRupiah(currentBalance)}).
          </p>
        ) : fieldErrors.claimedAmount ? (
          <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
            {fieldErrors.claimedAmount}
          </p>
        ) : null}
      </div>

      {/* 2. Payment Method */}
      <div>
        <span className="block text-xs font-semibold text-[#151515]">
          Payment Method <span className="text-[#FF4B22]">*</span>
        </span>
        <div
          role="group"
          aria-label="Select payment method"
          className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
        >
          {SUPPORTED_PAYMENT_METHODS.map((method) => {
            const active = paymentMethod === method;
            return (
              <button
                key={method}
                type="button"
                disabled={isSubmitting}
                aria-pressed={active}
                onClick={() => setPaymentMethod(method)}
                className={
                  active
                    ? 'min-h-9 cursor-pointer rounded-xl border border-[#8BAD12]/50 bg-[#EDF8C2] px-2 py-1.5 text-xs font-semibold text-[#243300]'
                    : 'min-h-9 cursor-pointer rounded-xl border border-[#151515]/12 bg-[#FAF8F3] px-2 py-1.5 text-xs font-medium text-[#46433D] hover:bg-white'
                }
              >
                {getClientPaymentMethodLabel(method)}
              </button>
            );
          })}
        </div>
        {fieldErrors.paymentMethod ? (
          <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
            {fieldErrors.paymentMethod}
          </p>
        ) : null}
      </div>

      {/* 3. Payment Date + 4. Optional Reference Number */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="client-evidence-date"
            className="block text-xs font-semibold text-[#151515]"
          >
            Payment Date <span className="text-[#FF4B22]">*</span>
          </label>
          <input
            id="client-evidence-date"
            type="date"
            disabled={isSubmitting}
            value={claimedPaidAt}
            onChange={(e) => {
              setClaimedPaidAt(e.target.value);
              setFieldErrors((prev) => ({ ...prev, claimedPaidAt: '' }));
            }}
            className="sa-input mt-1.5 h-10 w-full px-3 font-mono text-xs font-medium"
          />
          {fieldErrors.claimedPaidAt ? (
            <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
              {fieldErrors.claimedPaidAt}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="client-evidence-ref"
            className="block text-xs font-semibold text-[#151515]"
          >
            Transaction Reference <span className="font-normal text-[#666159]">(Optional)</span>
          </label>
          <input
            id="client-evidence-ref"
            type="text"
            maxLength={120}
            disabled={isSubmitting}
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g. BCA-20261124-991"
            className="sa-input mt-1.5 h-10 w-full px-3 font-mono text-xs"
          />
          {fieldErrors.referenceNumber ? (
            <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
              {fieldErrors.referenceNumber}
            </p>
          ) : null}
        </div>
      </div>

      {/* 5. Mandatory Payment Proof Image */}
      <PaymentEvidenceUploadField
        upload={upload}
        label="Payment Proof Image"
        required
        disabled={isSubmitting}
        locale="en"
        showPrivacyNotice
        inputTestId="client-payment-evidence-file-input"
      />
      {fieldErrors.evidence ? (
        <p role="alert" className="text-xs font-medium text-[#B92B0C]">
          {fieldErrors.evidence}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-[#666159]">
          Submitting proof does not immediately mark your invoice paid — our team verifies it first.
        </p>

        <button
          type="submit"
          disabled={isSubmitting || exceedsBalance || !upload.config.isConfigured}
          data-testid="client-evidence-submit-btn"
          className="sa-btn-primary inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>{upload.hasPreservedUpload ? 'Saving...' : 'Uploading & Sending...'}</span>
            </>
          ) : upload.hasPreservedUpload ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry Submission</span>
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Submit Payment Proof</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
