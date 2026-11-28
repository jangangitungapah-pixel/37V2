import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/public-site-settings/hooks/usePublicSiteSettings', () => ({
  usePublicSiteSettings: () => ({
    settings: {
      studioName: '37 Music Studio',
      publicWhatsappNumber: '+62 812-8888-3737',
    },
    isLoading: false,
  }),
}));

import {
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_TYPES,
} from '@/features/admin/booking-requests/config/booking-request-config';
import {
  createInMemoryBookingRequestRepositoryAdapter,
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from '@/features/admin/booking-requests/repositories/booking-request-repository';
import { BookingFormDialog } from '@/features/admin/calendar/components/BookingFormDialog';
import { INITIAL_PAYMENT_STATUS } from '@/features/admin/calendar/config/calendar-config';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  createBooking,
  createInMemoryBookingRepositoryAdapter,
} from '@/features/admin/calendar/services/calendar-booking-service';
import {
  createInMemoryCustomerRepositoryAdapter,
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
} from '@/features/admin/customer/repositories/customer-repository';
import { RecordPaymentDialog } from '@/features/admin/payment/components/RecordPaymentDialog';
import { AdminPaymentAndBillPage } from '@/features/admin/payment/pages/AdminPaymentAndBillPage';
import {
  createInMemoryPaymentRepositoryAdapter,
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from '@/features/admin/payment/repositories/payment-repository';
import {
  recordInvoicePayment,
  reversePaymentTransaction,
} from '@/features/admin/payment/services/payment-service';
import { buildInvoiceId, buildInvoiceNumber } from '@/features/admin/payment/utils/invoice-number';
import {
  INVOICE_STATUS,
  PAYMENT_SOURCE,
  PAYMENT_STATUS,
} from '@/features/admin/payment/utils/invoice-status';
import { AuthContext } from '@/features/auth/AuthContext';
import {
  createInMemoryClientBillingRepositoryAdapter,
  resetClientBillingRepositoryAdapter,
  setClientBillingRepositoryAdapter,
} from '@/features/client-portal/billing/repositories/client-billing-repository';
import { ClientInvoicesPage } from '@/features/client-portal/pages/ClientInvoicesPage';

import {
  getPaymentEvidenceCloudinaryConfig,
  PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE,
  PAYMENT_EVIDENCE_SOURCES,
  PAYMENT_EVIDENCE_STATUSES,
  PAYMENT_EVIDENCE_UPLOAD_LIMITS,
  resetPaymentEvidenceCloudinaryConfigOverride,
  setPaymentEvidenceCloudinaryConfigOverride,
} from './config/payment-evidence-config';
import { PaymentEvidencePreview } from './components/PaymentEvidencePreview';
import {
  normalizePaymentEvidenceAsset,
  validateClientEvidenceSubmissionInput,
  validatePaymentEvidenceAsset,
} from './schemas/payment-evidence-schema';
import {
  createInMemoryPaymentEvidenceRepositoryAdapter,
  resetPaymentEvidenceRepositoryAdapter,
  setPaymentEvidenceRepositoryAdapter,
} from './repositories/payment-evidence-repository';
import {
  resetPaymentEvidenceUploadTransport,
  setPaymentEvidenceUploadTransport,
  uploadPaymentEvidenceImage,
  validatePaymentEvidenceCloudinaryResponse,
  validatePaymentEvidenceFile,
} from './services/cloudinary-payment-evidence-upload-service';
import {
  rejectClientPaymentEvidence,
  submitClientPaymentEvidence,
  verifyClientPaymentEvidence,
} from './services/payment-evidence-service';
import { buildEvidencePaymentId } from './utils/payment-evidence-utils';

const TEST_CLOUDINARY_CONFIG = Object.freeze(
  getPaymentEvidenceCloudinaryConfig({
    VITE_CLOUDINARY_CLOUD_NAME: 'studio37demo',
    VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET: '37payment-evidence',
  }),
);

function makeImageFile({
  name = 'transfer-receipt.jpg',
  type = 'image/jpeg',
  size = 128000,
  width = 1080,
  height = 1920,
} = {}) {
  const bytes = new Uint8Array(Math.min(size, 64));
  const file = new File([bytes], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  file.width = width;
  file.height = height;
  return file;
}

function makeValidCloudinaryAsset(overrides = {}) {
  return {
    provider: 'cloudinary',
    cloudName: TEST_CLOUDINARY_CONFIG.cloudName,
    cloudinaryPublicId: 'payment-evidence/pe_random9911',
    cloudinaryAssetId: 'asset_pe_9911',
    secureUrl:
      'https://res.cloudinary.com/studio37demo/image/upload/v1732400000/payment-evidence/pe_random9911.jpg',
    resourceType: 'image',
    format: 'jpg',
    width: 1080,
    height: 1920,
    bytes: 128000,
    ...overrides,
  };
}

function makeCloudinaryRawResponse(overrides = {}) {
  return {
    asset_id: 'asset_pe_9911',
    public_id: 'payment-evidence/pe_random9911',
    secure_url:
      'https://res.cloudinary.com/studio37demo/image/upload/v1732400000/payment-evidence/pe_random9911.jpg',
    resource_type: 'image',
    format: 'jpg',
    width: 1080,
    height: 1920,
    bytes: 128000,
    ...overrides,
  };
}

function makeBookingFormValues(overrides = {}) {
  return {
    customerName: 'Nadia Pratama',
    phone: '081234567890',
    bandName: 'Velvet Echo',
    studioId: 'room-a',
    serviceTypeId: 'rehearsal',
    serviceOptionId: 'rehearsal-regular',
    serviceId: 'rehearsal',
    date: '2026-11-28',
    startMinute: 600,
    durationPreset: '180',
    customDurationMinutes: '180',
    initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
    dpAmount: '',
    paymentMethod: 'transfer',
    notes: '',
    ...overrides,
  };
}

function makeClientAuthValue({
  uid = 'client-uid-a',
  customerId = 'cust_client_a',
  status = 'active',
  accountType = 'client',
} = {}) {
  return {
    status: uid ? 'authenticated' : 'unauthenticated',
    accountType,
    role: accountType === 'client' ? 'client' : null,
    user: uid ? { uid, email: 'nadia@gmail.com', displayName: 'Nadia Pratama' } : null,
    clientAccount: uid
      ? {
          uid,
          role: 'client',
          status,
          customerId,
          displayName: 'Nadia Pratama',
          emailNormalized: 'nadia@gmail.com',
        }
      : null,
    clientProfile: uid
      ? {
          customerId,
          displayName: 'Nadia Pratama',
          phoneDisplay: '+62 812-3456-7890',
        }
      : null,
  };
}

function makeStaffAuthValue({ uid = 'staff-uid-1', role = 'staff' } = {}) {
  return {
    status: 'authenticated',
    accountType: 'staff',
    role,
    user: { uid, email: 'staff@37studio.com', displayName: 'Rina Studio Staff' },
    profile: { uid, email: 'staff@37studio.com', displayName: 'Rina Studio Staff', role, active: true },
  };
}

function seedRawInvoice(bookingAdapter, overrides = {}) {
  const bookingId = overrides.bookingId || 'bkg_ev_1';
  const invoiceId = buildInvoiceId(bookingId);
  const bookingDate = overrides.bookingDate || '2026-11-28';
  const invoiceNumber =
    overrides.invoiceNumber || buildInvoiceNumber({ bookingId, bookingDate });
  const totalAmount = overrides.totalAmount ?? 360000;
  const amountPaid = overrides.amountPaid ?? 0;
  const balanceDue = overrides.balanceDue ?? Math.max(0, totalAmount - amountPaid);

  const doc = {
    id: invoiceId,
    invoiceNumber,
    bookingId,
    customerId: overrides.customerId || 'cust_client_a',
    invoiceStatus: overrides.invoiceStatus || INVOICE_STATUS.ISSUED,
    currency: 'IDR',
    customerSnapshot: {
      name: overrides.customerName || 'Nadia Pratama',
      phone: '+6281234567890',
      bandName: overrides.bandName || 'Velvet Echo',
    },
    bookingSnapshot: {
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Reguler',
      studioId: 'room-a',
      bookingDate,
      startMinute: 600,
      endMinute: 780,
      durationMinutes: 180,
    },
    financialSnapshot: {
      subtotal: totalAmount,
      discountAmount: 0,
      totalAmount,
    },
    amountPaid,
    balanceDue,
    paymentStatus:
      balanceDue === 0
        ? PAYMENT_STATUS.PAID
        : amountPaid > 0
          ? PAYMENT_STATUS.PARTIAL
          : PAYMENT_STATUS.UNPAID,
    invoiceDate: '2026-11-28T09:00:00.000Z',
    dueDate: overrides.dueDate ?? '2026-11-29',
    lastPaymentTransactionId: overrides.lastPaymentTransactionId ?? null,
    voidReason: overrides.voidReason ?? '',
    clientPaymentEvidenceRequired: Boolean(overrides.clientPaymentEvidenceRequired),
    createdAt: '2026-11-28T09:00:00.000Z',
    createdByUid: 'staff-uid-1',
    updatedAt: '2026-11-28T09:00:00.000Z',
    updatedByUid: 'staff-uid-1',
    version: overrides.version ?? 1,
  };

  bookingAdapter._sharedStore.invoices.set(invoiceId, doc);
  bookingAdapter._sharedStore.notifyInvoices();
  return doc;
}

describe('Payment Evidence & Verification v1 — Full Suite (Sections 14A, 14B, 14C, 14D)', () => {
  let bookingAdapter;
  let customerAdapter;
  let paymentAdapter;
  let evidenceAdapter;
  let clientBillingAdapter;
  let bookingRequestAdapter;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    bookingAdapter = createInMemoryBookingRepositoryAdapter();
    customerAdapter = createInMemoryCustomerRepositoryAdapter(bookingAdapter);
    paymentAdapter = createInMemoryPaymentRepositoryAdapter(bookingAdapter);
    evidenceAdapter = createInMemoryPaymentEvidenceRepositoryAdapter({ bookingAdapter });
    clientBillingAdapter = createInMemoryClientBillingRepositoryAdapter({ bookingAdapter });
    bookingRequestAdapter = createInMemoryBookingRequestRepositoryAdapter(bookingAdapter);

    setBookingRepositoryAdapter(bookingAdapter);
    setCustomerRepositoryAdapter(customerAdapter);
    setPaymentRepositoryAdapter(paymentAdapter);
    setPaymentEvidenceRepositoryAdapter(evidenceAdapter);
    setClientBillingRepositoryAdapter(clientBillingAdapter);
    setBookingRequestRepositoryAdapter(bookingRequestAdapter);
    setPaymentEvidenceCloudinaryConfigOverride(TEST_CLOUDINARY_CONFIG);
  });

  afterEach(() => {
    cleanup();
    resetPaymentEvidenceUploadTransport();
    resetPaymentEvidenceCloudinaryConfigOverride();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPaymentRepositoryAdapter();
    resetPaymentEvidenceRepositoryAdapter();
    resetClientBillingRepositoryAdapter();
    resetBookingRequestRepositoryAdapter();
  });

  describe('14A. Cloudinary Upload Module — Validation, Dedicated Preset, Random Filenames & No-Reupload Retry', () => {
    it('validates file rules (missing, empty, >5 MB, AVIF/PDF/SVG rejected; JPG/PNG/WEBP accepted)', async () => {
      await expect(validatePaymentEvidenceFile(null)).rejects.toMatchObject({
        code: 'payment-evidence/missing-file',
      });
      await expect(
        validatePaymentEvidenceFile(makeImageFile({ size: 0 })),
      ).rejects.toMatchObject({
        code: 'payment-evidence/empty-file',
      });
      await expect(
        validatePaymentEvidenceFile(
          makeImageFile({ size: PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxFileSizeBytes + 1 }),
        ),
      ).rejects.toMatchObject({
        code: 'payment-evidence/file-too-large',
      });

      for (const bad of [
        { name: 'receipt.avif', type: 'image/avif' },
        { name: 'invoice.pdf', type: 'application/pdf' },
        { name: 'vector.svg', type: 'image/svg+xml' },
        { name: 'anim.gif', type: 'image/gif' },
      ]) {
        await expect(validatePaymentEvidenceFile(makeImageFile(bad))).rejects.toMatchObject({
          code: 'payment-evidence/unsupported-format',
        });
      }

      for (const good of [
        { name: 'proof.jpg', type: 'image/jpeg' },
        { name: 'proof.png', type: 'image/png' },
        { name: 'proof.webp', type: 'image/webp' },
      ]) {
        const res = await validatePaymentEvidenceFile(makeImageFile(good));
        expect(res.valid).toBe(true);
      }
    });

    it('uploads unsigned with random non-identifying filename, zero secrets, strict response validation & dedicated preset isolation', async () => {
      const capturedForms = [];
      const transport = vi.fn(async ({ endpoint, formData }) => {
        capturedForms.push({ endpoint, entries: Object.fromEntries(formData.entries()) });
        return makeCloudinaryRawResponse();
      });

      const file = makeImageFile({
        name: 'Nadia-Pratama-081234567890-37MS-20261128.jpg',
        type: 'image/jpeg',
      });
      const uploaded = await uploadPaymentEvidenceImage({
        file,
        config: TEST_CLOUDINARY_CONFIG,
        transport,
      });

      expect(uploaded).toMatchObject({
        provider: 'cloudinary',
        cloudName: 'studio37demo',
        cloudinaryPublicId: 'payment-evidence/pe_random9911',
        resourceType: 'image',
        format: 'jpg',
      });

      expect(capturedForms).toHaveLength(1);
      expect(capturedForms[0].endpoint).toBe(
        'https://api.cloudinary.com/v1_1/studio37demo/image/upload',
      );
      expect(capturedForms[0].entries.upload_preset).toBe('37payment-evidence');
      expect(capturedForms[0].entries.api_key).toBeUndefined();
      expect(capturedForms[0].entries.api_secret).toBeUndefined();
      expect(capturedForms[0].entries.signature).toBeUndefined();
      // Filename sent in FormData MUST be randomized (`pe_*.jpg`), NEVER containing customer PII
      const sentFile = capturedForms[0].entries.file;
      expect(sentFile.name).toMatch(/^pe_[a-z0-9_-]+\.jpg$/i);
      expect(sentFile.name).not.toContain('Nadia');
      expect(sentFile.name).not.toContain('081234567890');
      expect(sentFile.name).not.toContain('37MS');

      // Missing dedicated preset MUST fail gracefully and NEVER fall back to Gallery's `37gallery`
      const unconfigured = getPaymentEvidenceCloudinaryConfig({
        VITE_CLOUDINARY_CLOUD_NAME: 'studio37demo',
        VITE_CLOUDINARY_UPLOAD_PRESET: '37gallery',
        VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET: '',
      });
      expect(unconfigured.isConfigured).toBe(false);
      expect(unconfigured.uploadPreset).toBe('');
      await expect(
        uploadPaymentEvidenceImage({ file, config: unconfigured, transport }),
      ).rejects.toMatchObject({ code: 'payment-evidence/cloudinary-unconfigured' });

      // Malformed / wrong cloudName / HTTP / wrong resourceType responses rejected
      expect(() =>
        validatePaymentEvidenceCloudinaryResponse(null, { expectedCloudName: 'studio37demo' }),
      ).toThrow();
      expect(() =>
        validatePaymentEvidenceCloudinaryResponse(
          makeCloudinaryRawResponse({
            secure_url: 'https://res.cloudinary.com/wrongcloud/image/upload/v1/pe_1.jpg',
          }),
          { expectedCloudName: 'studio37demo' },
        ),
      ).toThrow();
      expect(() =>
        validatePaymentEvidenceCloudinaryResponse(
          makeCloudinaryRawResponse({
            secure_url: 'http://res.cloudinary.com/studio37demo/image/upload/v1/pe_1.jpg',
          }),
          { expectedCloudName: 'studio37demo' },
        ),
      ).toThrow();
      expect(() =>
        validatePaymentEvidenceCloudinaryResponse(
          makeCloudinaryRawResponse({ resource_type: 'raw' }),
          { expectedCloudName: 'studio37demo' },
        ),
      ).toThrow();

      // Network failure handled cleanly
      await expect(
        uploadPaymentEvidenceImage({
          file,
          config: TEST_CLOUDINARY_CONFIG,
          transport: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
        }),
      ).rejects.toThrow(/failed to fetch/i);
    });
  });

  describe('14B. Client Portal — Mandatory Eligibility, Upload Retry Reuse, Timeline, Resubmission & Isolation', () => {
    it('renders mandatory form ONLY for eligible Client Portal invoices, preserves uploaded image on Firestore retry, blocks duplicates while pending, and supports resubmission after rejection', async () => {
      const user = userEvent.setup();
      const eligibleInv = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_cp_eligible',
        customerId: 'cust_client_a',
        totalAmount: 360000,
        clientPaymentEvidenceRequired: true,
      });
      const adminManualInv = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_admin_noreq',
        customerId: 'cust_client_a',
        totalAmount: 240000,
        clientPaymentEvidenceRequired: false,
      });
      const voidInv = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_cp_void',
        customerId: 'cust_client_a',
        invoiceStatus: INVOICE_STATUS.VOID,
        totalAmount: 180000,
        clientPaymentEvidenceRequired: true,
      });
      const paidInv = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_cp_paid',
        customerId: 'cust_client_a',
        totalAmount: 180000,
        amountPaid: 180000,
        balanceDue: 0,
        clientPaymentEvidenceRequired: true,
      });
      seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_cp_draft',
        customerId: 'cust_client_a',
        invoiceStatus: INVOICE_STATUS.DRAFT,
        totalAmount: 180000,
        clientPaymentEvidenceRequired: true,
      });

      const uploadTransportSpy = vi.fn(async () => makeCloudinaryRawResponse());
      setPaymentEvidenceUploadTransport(uploadTransportSpy);

      render(
        <AuthContext.Provider value={makeClientAuthValue()}>
          <MemoryRouter initialEntries={['/portal/invoices']}>
            <ClientInvoicesPage
              now={new Date('2026-11-28T10:00:00+07:00')}
              customAdapter={clientBillingAdapter}
              customEvidenceAdapter={evidenceAdapter}
              cloudinaryConfig={TEST_CLOUDINARY_CONFIG}
            />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      // Eligible invoice shows secondary indicator without replacing financial status
      const eligibleRow = await screen.findByTestId(`client-invoice-row-${eligibleInv.id}`);
      expect(within(eligibleRow).getByText('Unpaid')).toBeTruthy();
      expect(within(eligibleRow).getByText('Payment Evidence Required')).toBeTruthy();

      // Draft invoice never rendered
      expect(screen.queryByTestId('client-invoice-row-inv_bkg_cp_draft')).toBeNull();

      // Admin-managed invoice hides mandatory form
      await user.click(screen.getByTestId(`client-invoice-row-${adminManualInv.id}`));
      await screen.findByTestId('client-invoice-detail-drawer');
      expect(screen.queryByTestId('client-payment-evidence-form')).toBeNull();
      await user.click(screen.getByRole('button', { name: /close invoice details/i }));

      // Void & Paid invoices hide mandatory form
      await user.click(screen.getByTestId(`client-invoice-row-${voidInv.id}`));
      await screen.findByTestId('client-invoice-detail-drawer');
      expect(screen.queryByTestId('client-payment-evidence-form')).toBeNull();
      await user.click(screen.getByRole('button', { name: /close invoice details/i }));

      await user.click(screen.getByTestId(`client-invoice-row-${paidInv.id}`));
      await screen.findByTestId('client-invoice-detail-drawer');
      expect(screen.queryByTestId('client-payment-evidence-form')).toBeNull();
      await user.click(screen.getByRole('button', { name: /close invoice details/i }));

      // Open eligible invoice -> shows mandatory form
      await user.click(screen.getByTestId(`client-invoice-row-${eligibleInv.id}`));
      const form = await screen.findByTestId('client-payment-evidence-form');

      // Missing image rejected
      await user.click(within(form).getByRole('button', { name: /submit payment proof/i }));
      expect(await within(form).findByRole('alert')).toBeTruthy();

      // Over-balance amount rejected
      const amountInput = within(form).getByLabelText(/payment amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '999999');
      const fileInput = within(form).getByTestId('client-payment-evidence-file-input');
      fireEvent.change(fileInput, { target: { files: [makeImageFile()] } });
      await user.click(within(form).getByRole('button', { name: /submit payment proof/i }));
      expect(await within(form).findByText(/cannot exceed|exceeds/i)).toBeTruthy();

      // Valid amount + simulated transient Firestore failure -> uploads ONCE, retry reuses asset!
      await user.clear(amountInput);
      await user.type(amountInput, '180000');

      const origRunTx = evidenceAdapter.runAtomicTransaction;
      let failOnce = true;
      evidenceAdapter.runAtomicTransaction = async (fn) => {
        if (failOnce) {
          failOnce = false;
          const err = new Error('Firestore temporarily unavailable');
          err.code = 'unavailable';
          throw err;
        }
        return origRunTx(fn);
      };

      await user.click(within(form).getByTestId('client-evidence-submit-btn'));
      const submitErrBanner = await within(form).findByTestId('client-evidence-submit-error');
      expect(submitErrBanner.textContent).toMatch(/unable to reach the studio ledger/i);
      expect(within(form).getByText(/click retry submission/i)).toBeTruthy();
      expect(uploadTransportSpy).toHaveBeenCalledTimes(1);

      // Retry submit -> MUST NOT re-upload image to Cloudinary (still called 1 time total!)
      await user.click(within(form).getByTestId('client-evidence-submit-btn'));

      // Form remains available on Client Portal while pending_review (OD-05 multi-pending up to 50)
      await screen.findByTestId('client-evidence-pending-banner');
      expect(uploadTransportSpy).toHaveBeenCalledTimes(1);
      const multiForm = await screen.findByTestId('client-payment-evidence-form');
      expect(within(multiForm).queryByRole('button', { name: /^cash$/i })).toBeNull();
      expect(screen.getByTestId('client-portal-cash-notice')).toBeTruthy();

      // Client can upload a 2nd concurrent pending proof (installment) while 1st is awaiting review
      const secondAmountInput = within(multiForm).getByLabelText(/payment amount/i);
      await user.clear(secondAmountInput);
      await user.type(secondAmountInput, '90000');
      await user.type(within(multiForm).getByLabelText(/transaction reference/i), 'TRF-INSTALL-2');
      fireEvent.change(within(multiForm).getByTestId('client-payment-evidence-file-input'), {
        target: { files: [makeImageFile({ name: 'proof-2.jpg' })] },
      });
      await user.click(within(multiForm).getByTestId('client-evidence-submit-btn'));
      expect(await screen.findByText(/2 pending verifications/i)).toBeTruthy();
      expect(bookingAdapter._sharedStore.paymentEvidenceLocks.get(eligibleInv.id).pendingCount).toBe(2);

      // Invoice totals MUST remain untouched after Client submission
      const invAfterSubmit = bookingAdapter._sharedStore.invoices.get(eligibleInv.id);
      expect(invAfterSubmit.amountPaid).toBe(0);
      expect(invAfterSubmit.balanceDue).toBe(360000);
      expect(bookingAdapter._sharedStore.paymentTransactions.size).toBe(0);

      // Staff rejects first submission -> Client sees rejection reason & still can resubmit
      const submittedList = Array.from(bookingAdapter._sharedStore.paymentEvidence.values()).sort(
        (a, b) => Number(a.claimedAmount) - Number(b.claimedAmount),
      );
      const submittedEv = submittedList[1];
      await act(async () => {
        await rejectClientPaymentEvidence({
          evidenceId: submittedEv.id,
          rejectionReason: 'Transfer screenshot cropped, please show full amount.',
          actorUid: 'staff-uid-1',
          evidenceAdapter,
        });
      });

      expect(
        await screen.findByText(/transfer screenshot cropped, please show full amount/i),
      ).toBeTruthy();
      expect(await screen.findByTestId('client-payment-evidence-form')).toBeTruthy();
    });

    it('enforces cross-client ownership isolation and blocks unauthenticated/suspended client submissions', async () => {
      const invA = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_iso_a',
        customerId: 'cust_client_a',
        totalAmount: 240000,
        clientPaymentEvidenceRequired: true,
      });

      // Client B cannot submit evidence for Client A's invoice
      await expect(
        submitClientPaymentEvidence({
          invoiceId: invA.id,
          claimedAmount: 120000,
          paymentMethod: 'transfer',
          claimedPaidAt: '2026-11-28',
          evidenceAsset: makeValidCloudinaryAsset(),
          actorUid: 'client-uid-b',
          customerId: 'cust_client_b',
          adapter: evidenceAdapter,
        }),
      ).rejects.toMatchObject({ code: 'permission-denied' });

      // Missing auth / missing customerId rejected
      await expect(
        submitClientPaymentEvidence({
          invoiceId: invA.id,
          claimedAmount: 120000,
          paymentMethod: 'transfer',
          claimedPaidAt: '2026-11-28',
          evidenceAsset: makeValidCloudinaryAsset(),
          actorUid: '',
          customerId: '',
          adapter: evidenceAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment-evidence/unauthenticated' });

      // Regression: Client submission must NEVER read non-existent paymentEvidence/{id} inside tx
      // (Firestore Rules intentionally enforce `resource != null` on Client `get`), yet still supports idempotent replay
      let getPaymentEvidenceCalledInTx = false;
      const wrappedAdapter = {
        ...evidenceAdapter,
        runAtomicTransaction: (fn) =>
          evidenceAdapter.runAtomicTransaction((tx) =>
            fn({
              ...tx,
              getPaymentEvidence: async (...args) => {
                getPaymentEvidenceCalledInTx = true;
                return tx.getPaymentEvidence(...args);
              },
            }),
          ),
      };

      const firstSubmit = await submitClientPaymentEvidence({
        evidenceId: 'ev_no_pre_get_1',
        invoiceId: invA.id,
        claimedAmount: 120000,
        paymentMethod: 'transfer',
        claimedPaidAt: '2026-11-28',
        evidenceAsset: makeValidCloudinaryAsset(),
        actorUid: 'client-uid-a',
        customerId: 'cust_client_a',
        adapter: wrappedAdapter,
      });
      expect(getPaymentEvidenceCalledInTx).toBe(false);
      expect(firstSubmit.idempotentReplay).toBe(false);

      const replaySubmit = await submitClientPaymentEvidence({
        evidenceId: 'ev_no_pre_get_1',
        invoiceId: invA.id,
        claimedAmount: 120000,
        paymentMethod: 'transfer',
        claimedPaidAt: '2026-11-28',
        evidenceAsset: makeValidCloudinaryAsset(),
        actorUid: 'client-uid-a',
        customerId: 'cust_client_a',
        adapter: wrappedAdapter,
      });
      expect(getPaymentEvidenceCalledInTx).toBe(false);
      expect(replaySubmit.idempotentReplay).toBe(true);
      expect(replaySubmit.evidence.id).toBe('ev_no_pre_get_1');
    });
  });

  describe('14C. Admin Portal — Payment Evidence Tab, Review Drawer, Optional Dialog Attachments & Client Portal Conversion Policy', () => {
    it('renders Payment Evidence tab with pending badge, verifies edited amount atomically in Review Drawer, and preserves history', async () => {
      const user = userEvent.setup();
      const inv = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_admin_rev_1',
        customerId: 'cust_client_a',
        totalAmount: 360000,
        clientPaymentEvidenceRequired: true,
      });

      const submitted = await submitClientPaymentEvidence({
        evidenceId: 'ev_admin_review_1',
        invoiceId: inv.id,
        claimedAmount: 200000,
        paymentMethod: 'transfer',
        claimedPaidAt: '2026-11-28',
        referenceNumber: 'BCA-778899',
        evidenceAsset: makeValidCloudinaryAsset(),
        actorUid: 'client-uid-a',
        customerId: 'cust_client_a',
        adapter: evidenceAdapter,
      });

      render(
        <AuthContext.Provider value={makeStaffAuthValue()}>
          <MemoryRouter initialEntries={['/admin/payment-and-bill?tab=evidence']}>
            <AdminPaymentAndBillPage />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      // 3rd tab present with pending badge `1`
      const evidenceTab = await screen.findByRole('tab', { name: /payment evidence/i });
      await waitFor(() => {
        expect(evidenceTab.textContent).toContain('1');
      });

      const row = await screen.findByTestId(`admin-evidence-row-${submitted.evidence.id}`);
      await user.click(within(row).getByRole('button', { name: /tinjau/i }));

      const drawer = await screen.findByTestId('admin-payment-evidence-review-drawer');
      expect(within(drawer).getByRole('link', { name: /buka gambar asli/i })).toBeTruthy();

      // Adjust verified amount from 200,000 -> 180,000 (partial payment)
      const verifiedInput = within(drawer).getByLabelText(/nominal terverifikasi/i);
      await user.clear(verifiedInput);
      await user.type(verifiedInput, '180000');

      // Click verify -> deliberate confirmation panel -> confirm
      await user.click(
        within(drawer).getByRole('button', { name: /verifikasi & catat pembayaran/i }),
      );
      const confirmBox = await within(drawer).findByTestId('admin-evidence-verify-confirmation');
      await user.click(
        within(confirmBox).getByRole('button', { name: /ya, verifikasi & catat pembayaran/i }),
      );

      await waitFor(() => {
        expect(screen.queryByTestId('admin-payment-evidence-review-drawer')).toBeNull();
      });

      const updatedInv = bookingAdapter._sharedStore.invoices.get(inv.id);
      expect(updatedInv.amountPaid).toBe(180000);
      expect(updatedInv.balanceDue).toBe(180000);
      expect(updatedInv.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);

      const txId = buildEvidencePaymentId(submitted.evidence.id);
      const createdTx = bookingAdapter._sharedStore.paymentTransactions.get(txId);
      expect(createdTx).toMatchObject({
        amount: 180000,
        source: PAYMENT_SOURCE.CLIENT_EVIDENCE_VERIFIED,
        invoiceId: inv.id,
      });

      const updatedEv = bookingAdapter._sharedStore.paymentEvidence.get(submitted.evidence.id);
      expect(updatedEv).toMatchObject({
        status: PAYMENT_EVIDENCE_STATUSES.VERIFIED,
        verifiedAmount: 180000,
        linkedTransactionId: txId,
      });
    });

    it('supports optional Admin payment evidence in RecordPaymentDialog (cash without proof works; transfer with optional proof attaches atomically)', async () => {
      const user = userEvent.setup();
      const inv = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_manual_rec_1',
        customerId: 'cust_walkin_1',
        totalAmount: 300000,
        clientPaymentEvidenceRequired: false,
      });

      const uploadSpy = vi.fn(async () => makeCloudinaryRawResponse());
      setPaymentEvidenceUploadTransport(uploadSpy);

      // 1. Cash payment WITHOUT attaching any proof succeeds immediately with zero uploads
      const onSubmitCash = vi.fn(async (payload) =>
        recordInvoicePayment({ ...payload, actorUid: 'staff-uid-1', adapter: paymentAdapter }),
      );
      const { unmount } = render(
        <RecordPaymentDialog
          open
          invoice={inv}
          onOpenChange={vi.fn()}
          onSubmitPayment={onSubmitCash}
          cloudinaryConfig={TEST_CLOUDINARY_CONFIG}
        />,
      );

      const amountInput = screen.getByLabelText(/nominal pembayaran/i);
      await user.clear(amountInput);
      await user.type(amountInput, '100000');
      await user.click(screen.getByRole('button', { name: /^cash$/i }));
      await user.click(screen.getByRole('button', { name: /simpan pembayaran/i }));

      await waitFor(() => expect(onSubmitCash).toHaveBeenCalledTimes(1));
      expect(uploadSpy).toHaveBeenCalledTimes(0);
      expect(bookingAdapter._sharedStore.paymentEvidence.size).toBe(0);
      expect(bookingAdapter._sharedStore.invoices.get(inv.id).amountPaid).toBe(100000);
      unmount();

      // 2. Second payment WITH optional proof image uploads & creates `admin_manual` `attached` evidence atomically
      const latestInv = bookingAdapter._sharedStore.invoices.get(inv.id);
      const onSubmitWithProof = vi.fn(async (payload) =>
        recordInvoicePayment({ ...payload, actorUid: 'staff-uid-1', adapter: paymentAdapter }),
      );
      render(
        <RecordPaymentDialog
          open
          invoice={latestInv}
          onOpenChange={vi.fn()}
          onSubmitPayment={onSubmitWithProof}
          cloudinaryConfig={TEST_CLOUDINARY_CONFIG}
        />,
      );

      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [makeImageFile()] } });
      await user.click(screen.getByRole('button', { name: /simpan pembayaran/i }));

      await waitFor(() => expect(onSubmitWithProof).toHaveBeenCalledTimes(1));
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(bookingAdapter._sharedStore.invoices.get(inv.id).balanceDue).toBe(0);
      const attachedEvidence = Array.from(bookingAdapter._sharedStore.paymentEvidence.values());
      expect(attachedEvidence).toHaveLength(1);
      expect(attachedEvidence[0]).toMatchObject({
        evidenceSource: PAYMENT_EVIDENCE_SOURCES.ADMIN_MANUAL,
        status: PAYMENT_EVIDENCE_STATUSES.ATTACHED,
        verifiedAmount: 200000,
      });
    });

    it('BookingFormDialog: locks Client Portal conversion to Unpaid, hides upload on edit, and supports optional initial proof on Admin DP/Paid create', async () => {
      const user = userEvent.setup();
      const uploadSpy = vi.fn(async () => makeCloudinaryRawResponse());
      setPaymentEvidenceUploadTransport(uploadSpy);

      // 1. Client Portal source request locks initial payment to Unpaid and shows policy notice
      const { unmount: unmountCp } = render(
        <MemoryRouter>
          <BookingFormDialog
            open
            mode="create"
            sourceBookingRequest={{
              id: 'req_cp_conv_1',
              requestReference: 'REQ-CP001',
              source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
              serviceLabelSnapshot: 'Rehearsal',
              serviceOptionName: 'Reguler',
              requestedRoomLabel: 'Room A',
              preferredDate: '2026-11-28',
              preferredTimeLabel: '10:00',
              preferredDurationMinutes: 120,
            }}
            onOpenChange={vi.fn()}
            onSubmitBooking={vi.fn()}
            cloudinaryConfig={TEST_CLOUDINARY_CONFIG}
          />
        </MemoryRouter>,
      );

      expect(screen.getByTestId('booking-client-portal-evidence-policy-notice')).toBeTruthy();
      expect(document.getElementById('booking-initial-payment-evidence')).toBeNull();
      unmountCp();

      // 2. Edit mode NEVER renders optional initial payment evidence upload
      const { unmount: unmountEdit } = render(
        <MemoryRouter>
          <BookingFormDialog
            open
            mode="edit"
            editingBooking={{
              id: 'bkg_edit_1',
              customerName: 'Nadia',
              phone: '081234567890',
              studioId: 'room-a',
              serviceTypeId: 'rehearsal',
              serviceOptionId: 'rehearsal-regular',
              date: '2026-11-28',
              startMinute: 600,
              durationMinutes: 120,
              initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
              initialPaidAmount: 100000,
              paymentMethod: 'transfer',
              totalAmount: 240000,
              version: 1,
            }}
            onOpenChange={vi.fn()}
            onSubmitBooking={vi.fn()}
            cloudinaryConfig={TEST_CLOUDINARY_CONFIG}
          />
        </MemoryRouter>,
      );
      expect(document.getElementById('booking-initial-payment-evidence')).toBeNull();
      unmountEdit();

      // 3. Admin-managed create with DP shows optional upload field & passes uploaded asset to onSubmitBooking
      const onSubmitBooking = vi.fn(async ({ bookingId, eventId, formValues, customerResolution, optionalInitialPaymentEvidence, initialEvidenceId }) =>
        createBooking({
          bookingId,
          eventId,
          actorUid: 'staff-uid-1',
          formValues,
          customerResolution,
          optionalInitialPaymentEvidence,
          initialEvidenceId,
          adapter: bookingAdapter,
        }),
      );

      render(
        <MemoryRouter>
          <BookingFormDialog
            open
            mode="create"
            initialSlot={{
              customerName: 'Dika Admin',
              phone: '081299998888',
              studioId: 'room-a',
              date: '2026-11-28',
              startMinute: 600,
              durationMinutes: 120,
            }}
            onOpenChange={vi.fn()}
            onSubmitBooking={onSubmitBooking}
            cloudinaryConfig={TEST_CLOUDINARY_CONFIG}
          />
        </MemoryRouter>,
      );

      // Initially Unpaid -> no upload field
      expect(document.getElementById('booking-initial-payment-evidence')).toBeNull();

      // Select DP -> upload field appears
      await user.click(screen.getByRole('button', { name: /^dp/i }));
      const dpInput = screen.getByLabelText(/nominal dp/i);
      await user.type(dpInput, '50000');
      const proofInput = document.querySelector('input[type="file"]');
      expect(proofInput).toBeTruthy();
      fireEvent.change(proofInput, { target: { files: [makeImageFile()] } });

      await user.click(screen.getByRole('button', { name: /simpan booking/i }));
      await waitFor(() => expect(onSubmitBooking).toHaveBeenCalledTimes(1));

      expect(uploadSpy).toHaveBeenCalledTimes(1);
      const attached = Array.from(bookingAdapter._sharedStore.paymentEvidence.values());
      expect(attached).toHaveLength(1);
      expect(attached[0]).toMatchObject({
        evidenceSource: PAYMENT_EVIDENCE_SOURCES.ADMIN_MANUAL,
        status: PAYMENT_EVIDENCE_STATUSES.ATTACHED,
        claimedAmount: 50000,
        verifiedAmount: 50000,
      });
    });
  });

  describe('14D. Financial Integrity — Policy Flag Derivation, Bypass Prevention, Concurrency, Idempotency, Rollback & Reversal', () => {
    it('derives clientPaymentEvidenceRequired strictly from trusted request source and blocks manual bypasses', async () => {
      // Seed Client Portal booking request
      await bookingRequestAdapter.createPublicBookingRequest({
        requestId: 'req_cp_policy_1',
        payload: {
          schemaVersion: 1,
          requestReference: 'REQ-POL001',
          requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
          status: 'new',
          statusReason: '',
          customerName: 'Nadia Client',
          bandName: 'Velvet Echo',
          contactPhone: '+6281234567890',
          publicServiceId: 'rehearsal',
          serviceLabelSnapshot: 'Rehearsal',
          requestedRoomId: 'room-a',
          preferredDate: '2026-11-28',
          preferredStartMinute: 600,
          preferredDurationMinutes: 120,
          targetDeadline: null,
          notes: '',
          privacyConsent: true,
          consentVersion: 'v1',
          source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
          clientUid: 'client-uid-a',
          customerId: 'cust_client_a',
          serviceOptionId: 'rehearsal-regular',
          serviceOptionName: 'Reguler',
          pricingVersion: 3,
          assignedStaffUid: '',
          assignedStaffName: '',
          lastCommunicationAt: null,
          lastCommunicationType: '',
          lastCommunicationStatus: '',
          linkedBookingId: null,
          confirmedBookingSnapshot: null,
          confirmedAt: null,
          confirmedByUid: '',
          appCheckState: 'unconfigured',
          updatedByUid: '',
          version: 1,
        },
      });

      // Attempting to convert Client Portal request with initialPaidAmount > 0 is REJECTED
      await expect(
        createBooking({
          bookingId: 'bkg_cp_bypass',
          eventId: 'evt_cp_bypass',
          actorUid: 'staff-uid-1',
          bookingRequestId: 'req_cp_policy_1',
          formValues: makeBookingFormValues({
            initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
            dpAmount: '50000',
          }),
          adapter: bookingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/client-evidence-required' });

      // Converting with Unpaid succeeds and sets `clientPaymentEvidenceRequired: true`
      const cpBooking = await createBooking({
        bookingId: 'bkg_cp_valid',
        eventId: 'evt_cp_valid',
        actorUid: 'staff-uid-1',
        bookingRequestId: 'req_cp_policy_1',
        formValues: makeBookingFormValues({
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
        }),
        adapter: bookingAdapter,
      });

      const cpInvoice = bookingAdapter._sharedStore.invoices.get(buildInvoiceId(cpBooking.id));
      expect(cpInvoice.clientPaymentEvidenceRequired).toBe(true);
      expect(cpInvoice.amountPaid).toBe(0);

      // Generic manual `recordInvoicePayment` MUST NOT bypass Client Portal invoice!
      await expect(
        recordInvoicePayment({
          invoiceId: cpInvoice.id,
          amount: 100000,
          paymentMethod: 'transfer',
          actorUid: 'staff-uid-1',
          adapter: paymentAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment/client-evidence-required' });

      // Regular Admin walk-in booking gets `clientPaymentEvidenceRequired: false` and allows manual payment
      const adminBooking = await createBooking({
        bookingId: 'bkg_admin_walkin',
        eventId: 'evt_admin_walkin',
        actorUid: 'staff-uid-1',
        formValues: makeBookingFormValues({
          studioId: 'room-b',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
        }),
        adapter: bookingAdapter,
      });
      const adminInvoice = bookingAdapter._sharedStore.invoices.get(buildInvoiceId(adminBooking.id));
      expect(adminInvoice.clientPaymentEvidenceRequired).toBe(false);

      const manualRes = await recordInvoicePayment({
        invoiceId: adminInvoice.id,
        amount: 100000,
        paymentMethod: 'cash',
        actorUid: 'staff-uid-1',
        adapter: paymentAdapter,
      });
      expect(manualRes.invoice.amountPaid).toBe(100000);
    });

    it('prevents overpayment, double verification, concurrent two-pending negative balance, rolls back failures, and preserves evidence on reversal', async () => {
      const inv = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_integrity_1',
        customerId: 'cust_client_a',
        totalAmount: 300000,
        clientPaymentEvidenceRequired: true,
      });
      bookingAdapter._seedClientReservation('bkg_integrity_1', {
        schemaVersion: 2,
        bookingId: 'bkg_integrity_1',
        bookingReference: 'BKG-INTEGRITY-1',
        customerId: 'cust_client_a',
        clientUid: 'client-uid-a',
        sourceRequestId: '',
        acceptedOfferId: '',
        invoiceId: inv.id,
        studioId: 'room-a',
        studioName: 'Room A — Live Room',
        serviceTypeName: 'Rehearsal',
        serviceOptionName: 'Reguler',
        date: '2026-11-28',
        startMinute: 600,
        endMinute: 780,
        durationMinutes: 180,
        timeZone: 'Asia/Jakarta',
        reservationStatus: 'confirmed',
        sessionStatus: 'upcoming',
        holdExpiresAt: null,
        effectiveTotalAmount: 300000,
        minimumDepositAmount: null,
        depositStatus: null,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        createdAt: '2026-11-26T00:00:00.000Z',
        updatedAt: '2026-11-26T00:00:00.000Z',
        version: 1,
      });

      // Two pending submissions each claiming 200,000 against a 300,000 balance
      await submitClientPaymentEvidence({
        evidenceId: 'ev_int_1',
        invoiceId: inv.id,
        claimedAmount: 200000,
        paymentMethod: 'transfer',
        claimedPaidAt: '2026-11-28',
        evidenceAsset: makeValidCloudinaryAsset(),
        actorUid: 'client-uid-a',
        customerId: 'cust_client_a',
        adapter: evidenceAdapter,
      });
      await submitClientPaymentEvidence({
        evidenceId: 'ev_int_2',
        invoiceId: inv.id,
        claimedAmount: 200000,
        paymentMethod: 'qris',
        claimedPaidAt: '2026-11-28',
        evidenceAsset: makeValidCloudinaryAsset(),
        actorUid: 'client-uid-a',
        customerId: 'cust_client_a',
        adapter: evidenceAdapter,
      });

      // Overpayment verification (> 300,000) rejected & leaves DB clean
      await expect(
        verifyClientPaymentEvidence({
          evidenceId: 'ev_int_1',
          verifiedAmount: 350000,
          expectedInvoiceVersion: 1,
          actorUid: 'staff-uid-1',
          paymentAdapter,
          evidenceAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment/overpayment-not-allowed' });
      expect(bookingAdapter._sharedStore.paymentTransactions.size).toBe(0);
      expect(bookingAdapter._sharedStore.paymentEvidence.get('ev_int_1').status).toBe(
        PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW,
      );

      // Verify first submission (200,000 -> balanceDue becomes 100,000, version becomes 2)
      const firstVerify = await verifyClientPaymentEvidence({
        evidenceId: 'ev_int_1',
        verifiedAmount: 200000,
        expectedInvoiceVersion: 1,
        expectedEvidenceVersion: 1,
        notes: 'Nominal dan rekening transfer sudah dicocokkan.',
        actorUid: 'staff-uid-1',
        paymentAdapter,
        evidenceAdapter,
      });
      expect(firstVerify.invoice.amountPaid).toBe(200000);
      expect(firstVerify.invoice.balanceDue).toBe(100000);
      expect(firstVerify.invoice.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);
      expect(bookingAdapter._inspectState().clientReservations.get('bkg_integrity_1')?.paymentStatus).toBe(
        PAYMENT_STATUS.PARTIAL,
      );
      expect(firstVerify.transaction.notes).toBe('Nominal dan rekening transfer sudah dicocokkan.');

      // Repeated verification of already verified evidence NEVER double-records payment
      const replay = await verifyClientPaymentEvidence({
        evidenceId: 'ev_int_1',
        verifiedAmount: 200000,
        expectedInvoiceVersion: 1,
        actorUid: 'staff-uid-1',
        paymentAdapter,
        evidenceAdapter,
      });
      expect(replay.idempotentReplay).toBe(true);
      expect(bookingAdapter._sharedStore.invoices.get(inv.id).amountPaid).toBe(200000);
      expect(bookingAdapter._sharedStore.paymentTransactions.size).toBe(1);

      // Second pending submission with stale version (1) fails closed
      await expect(
        verifyClientPaymentEvidence({
          evidenceId: 'ev_int_2',
          verifiedAmount: 100000,
          expectedInvoiceVersion: 1,
          actorUid: 'staff-uid-1',
          paymentAdapter,
          evidenceAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment/stale-invoice' });

      // Second pending submission for 200,000 against remaining 100,000 fails overpayment guard (NO negative balance!)
      await expect(
        verifyClientPaymentEvidence({
          evidenceId: 'ev_int_2',
          verifiedAmount: 200000,
          expectedInvoiceVersion: 2,
          actorUid: 'staff-uid-1',
          paymentAdapter,
          evidenceAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment/overpayment-not-allowed' });
      expect(bookingAdapter._sharedStore.invoices.get(inv.id).balanceDue).toBe(100000);

      // Adjusting second verification to exact remaining 100,000 settles invoice to PAID!
      const secondVerify = await verifyClientPaymentEvidence({
        evidenceId: 'ev_int_2',
        verifiedAmount: 100000,
        expectedInvoiceVersion: 2,
        actorUid: 'staff-uid-1',
        paymentAdapter,
        evidenceAdapter,
      });
      expect(secondVerify.invoice.amountPaid).toBe(300000);
      expect(secondVerify.invoice.balanceDue).toBe(0);
      expect(secondVerify.invoice.paymentStatus).toBe(PAYMENT_STATUS.PAID);
      expect(bookingAdapter._inspectState().clientReservations.get('bkg_integrity_1')?.paymentStatus).toBe(
        PAYMENT_STATUS.PAID,
      );

      // Reversing the verified payment restores balance AND preserves paymentEvidence history!
      const reversalRes = await reversePaymentTransaction({
        invoiceId: inv.id,
        originalTransactionId: firstVerify.transaction.id,
        expectedVersion: 3,
        reason: 'Bank transfer returned by clearing house',
        actorUid: 'staff-uid-1',
        adapter: paymentAdapter,
      });
      expect(reversalRes.invoice.amountPaid).toBe(100000);
      expect(reversalRes.invoice.balanceDue).toBe(200000);
      expect(reversalRes.invoice.clientPaymentEvidenceRequired).toBe(true);
      expect(bookingAdapter._inspectState().clientReservations.get('bkg_integrity_1')?.paymentStatus).toBe(
        PAYMENT_STATUS.PARTIAL,
      );
      expect(bookingAdapter._sharedStore.paymentEvidence.get('ev_int_1')).toMatchObject({
        status: PAYMENT_EVIDENCE_STATUSES.VERIFIED,
        linkedTransactionId: firstVerify.transaction.id,
      });
    });
  });

  describe('14E. Phase 3 — Cash Exclusion, SecureUrl 500/600 Cap & 50-Pending Guard', () => {
    it('hard-blocks cash method on Client Portal submissions across Zod, service, and UI while supporting Staff Cash Desk offline', async () => {
      const schemaRes = validateClientEvidenceSubmissionInput(
        {
          claimedAmount: 100000,
          paymentMethod: 'cash',
          claimedPaidAt: '2026-11-28',
        },
        300000,
      );
      expect(schemaRes.isValid).toBe(false);
      expect(schemaRes.errors.paymentMethod).toMatch(/transfer|qris|other/i);

      const inv = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_p3_cash_block',
        customerId: 'cust_client_a',
        totalAmount: 300000,
        clientPaymentEvidenceRequired: true,
      });

      await expect(
        submitClientPaymentEvidence({
          evidenceId: 'ev_cash_client_attempt',
          invoiceId: inv.id,
          claimedAmount: 100000,
          paymentMethod: 'cash',
          claimedPaidAt: '2026-11-28',
          evidenceAsset: makeValidCloudinaryAsset(),
          actorUid: 'client-uid-a',
          customerId: 'cust_client_a',
          expectedCloudName: TEST_CLOUDINARY_CONFIG.cloudName,
          adapter: evidenceAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment-evidence/cash-not-allowed' });
    });

    it('harmonizes new secureUrl limit to <= 500 chars while preserving read/preview compatibility for legacy 501..600 records', () => {
      const prefix = `https://res.cloudinary.com/${TEST_CLOUDINARY_CONFIG.cloudName}/image/upload/`;
      const ok500 = `${prefix}${'a'.repeat(500 - prefix.length)}`;
      const bad501 = `${prefix}${'a'.repeat(501 - prefix.length)}`;

      expect(ok500).toHaveLength(500);
      expect(bad501).toHaveLength(501);

      expect(
        validatePaymentEvidenceAsset(
          makeValidCloudinaryAsset({ secureUrl: ok500 }),
          TEST_CLOUDINARY_CONFIG.cloudName,
        ).isValid,
      ).toBe(true);
      expect(
        validatePaymentEvidenceAsset(
          makeValidCloudinaryAsset({ secureUrl: bad501 }),
          TEST_CLOUDINARY_CONFIG.cloudName,
        ).isValid,
      ).toBe(false);

      // Historical 550-char URL record remains readable & previewable
      const legacyUrl = `${prefix}${'b'.repeat(550 - prefix.length)}`;
      const normalized = normalizePaymentEvidenceAsset(
        makeValidCloudinaryAsset({ secureUrl: legacyUrl }),
      );
      expect(normalized.secureUrl).toBe(legacyUrl);

      render(<PaymentEvidencePreview evidence={normalized} size="sm" locale="en" />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('src')).toContain('w_320');
    });

    it('enforces max 50 pending evidence lock cleanly in service and hides Client upload form at 50 pending', async () => {
      const inv = seedRawInvoice(bookingAdapter, {
        bookingId: 'bkg_p3_limit50',
        customerId: 'cust_client_a',
        totalAmount: 1000000,
        clientPaymentEvidenceRequired: true,
      });

      const pendingIds = [];
      for (let i = 1; i <= PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE; i += 1) {
        const id = `ev_limit_${i}`;
        pendingIds.push(id);
        bookingAdapter._sharedStore.paymentEvidence.set(id, {
          id,
          schemaVersion: 1,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          bookingId: inv.bookingId,
          customerId: 'cust_client_a',
          clientUid: 'client-uid-a',
          evidenceSource: PAYMENT_EVIDENCE_SOURCES.CLIENT_PORTAL,
          status: PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW,
          claimedAmount: 10000,
          paymentMethod: 'transfer',
          claimedPaidAt: '2026-11-28',
          referenceNumber: `REF-${i}`,
          evidence: makeValidCloudinaryAsset(),
          submittedByUid: 'client-uid-a',
          submittedAt: '2026-11-28T10:00:00.000Z',
          reviewedAt: null,
          reviewedByUid: '',
          rejectionReason: '',
          verifiedAmount: null,
          linkedTransactionId: null,
          createdAt: '2026-11-28T10:00:00.000Z',
          updatedAt: '2026-11-28T10:00:00.000Z',
          version: 1,
        });
      }
      bookingAdapter._sharedStore.paymentEvidenceLocks.set(inv.id, {
        schemaVersion: 1,
        invoiceId: inv.id,
        bookingId: inv.bookingId,
        customerId: 'cust_client_a',
        clientUid: 'client-uid-a',
        pendingEvidenceIds: pendingIds,
        pendingCount: PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE,
        updatedAt: '2026-11-28T10:00:00.000Z',
        updatedByUid: 'client-uid-a',
        version: PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE,
      });

      await expect(
        submitClientPaymentEvidence({
          evidenceId: 'ev_limit_51',
          invoiceId: inv.id,
          claimedAmount: 10000,
          paymentMethod: 'qris',
          claimedPaidAt: '2026-11-28',
          evidenceAsset: makeValidCloudinaryAsset(),
          actorUid: 'client-uid-a',
          customerId: 'cust_client_a',
          expectedCloudName: TEST_CLOUDINARY_CONFIG.cloudName,
          adapter: evidenceAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment-evidence/pending-limit-reached' });

      // Client UI shows 50-pending limit banner & disables additional form upload
      const user = userEvent.setup();
      render(
        <AuthContext.Provider value={makeClientAuthValue()}>
          <MemoryRouter initialEntries={['/portal/invoices']}>
            <ClientInvoicesPage
              now={new Date('2026-11-28T10:00:00+07:00')}
              customAdapter={clientBillingAdapter}
              customEvidenceAdapter={evidenceAdapter}
              cloudinaryConfig={TEST_CLOUDINARY_CONFIG}
            />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      await user.click(await screen.findByTestId(`client-invoice-row-${inv.id}`));
      expect(await screen.findByTestId('client-evidence-pending-limit-banner')).toBeTruthy();
      expect(screen.queryByTestId('client-payment-evidence-form')).toBeNull();
    });
  });
});
