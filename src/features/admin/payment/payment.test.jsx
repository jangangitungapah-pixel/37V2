import fs from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnAuthStateChanged = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn((_db, collectionName, docId) => ({
  path: `${collectionName}/${docId}`,
  id: docId,
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ app: { name: '[DEFAULT]' } })),
  signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ app: { name: '[DEFAULT]' } })),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => true,
  getFirebaseApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

import { AppRoutes } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';
import {
  BOOKING_SESSION_STATUS,
  INITIAL_PAYMENT_STATUS,
} from '@/features/admin/calendar/config/calendar-config';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  createBooking,
  createInMemoryBookingRepositoryAdapter,
  updateOrRescheduleBooking,
} from '@/features/admin/calendar/services/calendar-booking-service';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import {
  createInMemoryCustomerRepositoryAdapter,
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
} from '@/features/admin/customer/repositories/customer-repository';
import {
  mergeCustomerProfiles,
  updateCustomerProfile,
} from '@/features/admin/customer/services/customer-service';
import { CUSTOMER_RESOLUTION_MODE } from '@/features/admin/customer/utils/customer-identity';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from '@/features/admin/settings/pricing/repositories/pricing-settings-repository';
import {
  createInMemoryPaymentEvidenceRepositoryAdapter,
  resetPaymentEvidenceRepositoryAdapter,
  setPaymentEvidenceRepositoryAdapter,
} from '@/features/payment-evidence/repositories/payment-evidence-repository';

import {
  createInMemoryPaymentRepositoryAdapter,
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from './repositories/payment-repository';
import { updateInvoiceDueDate, voidInvoice } from './services/invoice-service';
import {
  importLegacyBookingInvoices,
  reconcileNeedsReviewLegacyBooking,
  scanLegacyBookingsForInvoicesPreview,
} from './services/legacy-invoice-service';
import { recordInvoicePayment, reversePaymentTransaction } from './services/payment-service';
import { buildWhatsAppInvoiceSummary } from './utils/invoice-format';
import {
  buildInitialPaymentId,
  buildInvoiceId,
  buildInvoiceNumber,
  isValidInvoiceNumber,
} from './utils/invoice-number';
import {
  getEffectivePaymentStatus,
  INVOICE_STATUS,
  PAYMENT_SOURCE,
  PAYMENT_STATUS,
  TRANSACTION_TYPE,
} from './utils/invoice-status';

function mockAuthenticatedStaff(role = 'owner', uid = 'owner-uid-1') {
  const displayName = role === 'owner' ? '37 Music Studio Owner' : 'Rina Studio Staff';
  const email = role === 'owner' ? 'owner@37studio.com' : 'staff@37studio.com';

  mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
    queueMicrotask(() => callback({ uid, email, displayName }));
    return () => {};
  });

  mockGetDoc.mockResolvedValue({
    id: uid,
    exists: () => true,
    data: () => ({
      displayName,
      email,
      role,
      active: true,
    }),
  });
}

function renderAppAt(initialEntry = '/admin/payment-and-bill') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

function buildBookingForm(overrides = {}) {
  return {
    customerName: 'Arief Music',
    phone: '081234567890',
    bandName: 'Velvet Band',
    studioId: 'room-a',
    serviceTypeId: 'rehearsal',
    serviceOptionId: 'rehearsal-regular',
    serviceId: 'rehearsal',
    date: '2026-11-20',
    startMinute: 600,
    durationPreset: '180', // 3 hours -> Rp 300k - Rp 30k auto discount = Rp 270k
    customDurationMinutes: '180',
    initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
    dpAmount: '100000',
    paymentMethod: 'transfer',
    notes: '',
    ...overrides,
  };
}

describe('Phase 8 — Payment & Bill Management (Invoice Generation & Customer Payment Ledger)', () => {
  let bookingAdapter;
  let customerAdapter;
  let paymentAdapter;
  let pricingAdapter;
  const todayIso = getJakartaTodayIso();

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockGetDoc.mockReset();
    mockOnAuthStateChanged.mockReset();

    bookingAdapter = createInMemoryBookingRepositoryAdapter();
    customerAdapter = createInMemoryCustomerRepositoryAdapter(bookingAdapter);
    paymentAdapter = createInMemoryPaymentRepositoryAdapter(bookingAdapter);
    pricingAdapter = createInMemoryPricingSettingsAdapter();

    setBookingRepositoryAdapter(bookingAdapter);
    setCustomerRepositoryAdapter(customerAdapter);
    setPaymentRepositoryAdapter(paymentAdapter);
    setPaymentEvidenceRepositoryAdapter(
      createInMemoryPaymentEvidenceRepositoryAdapter({ bookingAdapter }),
    );
    setPricingSettingsRepositoryAdapter(pricingAdapter);
  });

  afterEach(() => {
    cleanup();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPaymentRepositoryAdapter();
    resetPaymentEvidenceRepositoryAdapter();
    resetPricingSettingsRepositoryAdapter();
  });

  describe('A. Automatic Invoice Generation, Initial Payments, Rollback & Idempotency', () => {
    it('atomically creates 1 invoice + initial payment for DP/Paid, 0 payment records for Unpaid, rolls back on slot conflict, and stays idempotent on retry', async () => {
      // 1. Booking with DP (Rp 100.000 of Rp 270.000) -> 1 invoice + 1 initial payment tx
      const bkgDp = await createBooking({
        bookingId: 'bkg-p8-dp',
        eventId: 'evt-p8-dp',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          date: '2026-11-20',
          startMinute: 600,
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
          dpAmount: '100000',
          paymentMethod: 'transfer',
        }),
        adapter: bookingAdapter,
      });

      const invDpId = buildInvoiceId(bkgDp.id);
      const invDp = await paymentAdapter.getInvoiceById(invDpId);
      expect(invDp).toBeTruthy();
      expect(isValidInvoiceNumber(invDp.invoiceNumber)).toBe(true);
      expect(invDp.invoiceNumber).toBe(
        buildInvoiceNumber({ bookingId: bkgDp.id, bookingDate: '2026-11-20' }),
      );
      expect(invDp.invoiceStatus).toBe(INVOICE_STATUS.ISSUED);
      expect(invDp.financialSnapshot).toEqual({
        subtotal: 300000,
        discountAmount: 30000,
        totalAmount: 270000,
      });
      expect(invDp.amountPaid).toBe(100000);
      expect(invDp.balanceDue).toBe(170000);
      expect(invDp.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);

      const initTx = await paymentAdapter.getPaymentTransactionById(
        buildInitialPaymentId(bkgDp.id),
      );
      expect(initTx).toBeTruthy();
      expect(initTx.amount).toBe(100000);
      expect(initTx.source).toBe(PAYMENT_SOURCE.BOOKING_INITIAL_PAYMENT);
      expect(initTx.paymentMethod).toBe('transfer');

      // 2. Idempotent retry with identical bookingId + eventId creates NO duplicate invoice/payment
      await createBooking({
        bookingId: 'bkg-p8-dp',
        eventId: 'evt-p8-dp',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          date: '2026-11-20',
          startMinute: 600,
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
          dpAmount: '100000',
          paymentMethod: 'transfer',
        }),
        adapter: bookingAdapter,
      });
      expect(paymentAdapter._inspectState().invoices.size).toBe(1);
      expect(paymentAdapter._inspectState().paymentTransactions.size).toBe(1);

      // 3. Unpaid booking creates invoice with amountPaid=0 and ZERO paymentTransactions
      const bkgUnpaid = await createBooking({
        bookingId: 'bkg-p8-unpaid',
        eventId: 'evt-p8-unpaid',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          customerName: 'Budi Bass',
          phone: '081333444555',
          date: '2026-11-21',
          startMinute: 600,
          durationPreset: '120',
          customDurationMinutes: '120',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '0',
          paymentMethod: '',
        }),
        adapter: bookingAdapter,
      });
      const invUnpaid = await paymentAdapter.getInvoiceById(buildInvoiceId(bkgUnpaid.id));
      expect(invUnpaid.amountPaid).toBe(0);
      expect(invUnpaid.balanceDue).toBe(200000);
      expect(invUnpaid.paymentStatus).toBe(PAYMENT_STATUS.UNPAID);
      expect(invUnpaid.lastPaymentTransactionId).toBeNull();
      expect(
        await paymentAdapter.getPaymentTransactionById(buildInitialPaymentId(bkgUnpaid.id)),
      ).toBeNull();

      // 4. Paid booking creates invoice immediately paid + 1 initial payment equal to total
      const bkgPaid = await createBooking({
        bookingId: 'bkg-p8-paid',
        eventId: 'evt-p8-paid',
        actorUid: 'owner-uid-1',
        formValues: buildBookingForm({
          customerName: 'Siti Vocal',
          phone: '081444555666',
          date: '2026-11-22',
          startMinute: 600,
          durationPreset: '60',
          customDurationMinutes: '60',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
          dpAmount: '100000',
          paymentMethod: 'qris',
        }),
        adapter: bookingAdapter,
      });
      const invPaid = await paymentAdapter.getInvoiceById(buildInvoiceId(bkgPaid.id));
      expect(invPaid.amountPaid).toBe(100000);
      expect(invPaid.balanceDue).toBe(0);
      expect(invPaid.paymentStatus).toBe(PAYMENT_STATUS.PAID);

      // 5. Slot conflict rolls back atomically -> ZERO orphan invoice or payment record
      await expect(
        createBooking({
          bookingId: 'bkg-p8-conflict',
          eventId: 'evt-p8-conflict',
          actorUid: 'staff-uid-2',
          formValues: buildBookingForm({
            customerName: 'Conflict Attempt',
            phone: '081999888777',
            date: '2026-11-20',
            startMinute: 630, // overlaps bkg-p8-dp (10:00-13:00 on room-a)
            initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
            dpAmount: '270000',
            paymentMethod: 'cash',
          }),
          adapter: bookingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/slot-conflict' });

      expect(await paymentAdapter.getInvoiceById(buildInvoiceId('bkg-p8-conflict'))).toBeNull();
      expect(
        await paymentAdapter.getPaymentTransactionById(buildInitialPaymentId('bkg-p8-conflict')),
      ).toBeNull();
    });
  });

  describe('B & C. Payment Ledger, Concurrency, Reversals, Overdue & Void Rules', () => {
    it('supports multi-method partial/final payments, rejects zero/negative/overpayment, prevents concurrent negative balance, enforces append-only reversals, overdue dates, and void guards', async () => {
      const bkg = await createBooking({
        bookingId: 'bkg-p8-ledger',
        eventId: 'evt-p8-ledger',
        actorUid: 'owner-uid-1',
        formValues: buildBookingForm({
          date: '2026-11-20',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '0',
        }),
        adapter: bookingAdapter,
      });
      const invId = buildInvoiceId(bkg.id);
      expect(bookingAdapter._inspectState().clientReservations.get(bkg.id)?.paymentStatus).toBe(
        PAYMENT_STATUS.UNPAID,
      );

      // Zero & negative amounts rejected
      await expect(
        recordInvoicePayment({
          invoiceId: invId,
          amount: 0,
          paymentMethod: 'cash',
          actorUid: 'staff-uid-2',
          adapter: paymentAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment/validation-error' });

      await expect(
        recordInvoicePayment({
          invoiceId: invId,
          amount: -50000,
          paymentMethod: 'cash',
          actorUid: 'staff-uid-2',
          adapter: paymentAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment/validation-error' });

      // Overpayment rejected without modifying invoice
      await expect(
        recordInvoicePayment({
          invoiceId: invId,
          amount: 300000,
          paymentMethod: 'transfer',
          actorUid: 'staff-uid-2',
          adapter: paymentAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment/overpayment-not-allowed' });
      expect((await paymentAdapter.getInvoiceById(invId)).amountPaid).toBe(0);

      // No dueDate -> never overdue; past dueDate with balanceDue > 0 -> overdue
      let currentInv = await paymentAdapter.getInvoiceById(invId);
      expect(getEffectivePaymentStatus(currentInv, '2026-11-25')).toBe(PAYMENT_STATUS.UNPAID);

      currentInv = await updateInvoiceDueDate({
        invoiceId: invId,
        expectedVersion: currentInv.version,
        dueDate: '2026-11-18',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });
      expect(getEffectivePaymentStatus(currentInv, '2026-11-20')).toBe(PAYMENT_STATUS.OVERDUE);

      // Record Cash, Transfer, QRIS, Other payments step-by-step
      const p1 = await recordInvoicePayment({
        transactionId: 'pay-cash-1',
        invoiceId: invId,
        expectedVersion: currentInv.version,
        amount: 50000,
        paymentMethod: 'cash',
        receivedDate: '2026-11-19',
        referenceNumber: 'CASH-01',
        notes: 'Bayar tahap 1',
        actorUid: 'staff-uid-2',
        adapter: paymentAdapter,
      });
      expect(p1.invoice.amountPaid).toBe(50000);
      expect(p1.invoice.balanceDue).toBe(220000);
      expect(p1.invoice.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);
      expect(bookingAdapter._inspectState().clientReservations.get(bkg.id)?.paymentStatus).toBe(
        PAYMENT_STATUS.PARTIAL,
      );

      // Duplicate transactionId replay is strictly idempotent (does NOT add 50k again)
      const p1Replay = await recordInvoicePayment({
        transactionId: 'pay-cash-1',
        invoiceId: invId,
        expectedVersion: p1.invoice.version,
        amount: 50000,
        paymentMethod: 'cash',
        actorUid: 'staff-uid-2',
        adapter: paymentAdapter,
      });
      expect(p1Replay.idempotentReplay).toBe(true);
      expect((await paymentAdapter.getInvoiceById(invId)).amountPaid).toBe(50000);

      const p2 = await recordInvoicePayment({
        transactionId: 'pay-qris-2',
        invoiceId: invId,
        expectedVersion: p1.invoice.version,
        amount: 100000,
        paymentMethod: 'qris',
        referenceNumber: 'QRIS-99',
        actorUid: 'staff-uid-2',
        adapter: paymentAdapter,
      });
      expect(p2.invoice.amountPaid).toBe(150000);
      expect(p2.invoice.balanceDue).toBe(120000);

      // Concurrent payments racing for remaining Rp 120.000 -> strictly one succeeds, zero negative balance!
      const [c1, c2] = await Promise.allSettled([
        recordInvoicePayment({
          transactionId: 'pay-concurrent-a',
          invoiceId: invId,
          expectedVersion: p2.invoice.version,
          amount: 100000,
          paymentMethod: 'transfer',
          actorUid: 'staff-uid-2',
          adapter: paymentAdapter,
        }),
        recordInvoicePayment({
          transactionId: 'pay-concurrent-b',
          invoiceId: invId,
          expectedVersion: p2.invoice.version,
          amount: 100000,
          paymentMethod: 'other',
          actorUid: 'owner-uid-1',
          adapter: paymentAdapter,
        }),
      ]);
      const fulfilled = [c1, c2].filter((r) => r.status === 'fulfilled');
      const rejected = [c1, c2].filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((await paymentAdapter.getInvoiceById(invId)).balanceDue).toBe(20000);

      // Final Rp 20.000 via 'other' transitions invoice to PAID (and clears overdue!)
      const invBeforeFinal = await paymentAdapter.getInvoiceById(invId);
      const pFinal = await recordInvoicePayment({
        transactionId: 'pay-other-final',
        invoiceId: invId,
        expectedVersion: invBeforeFinal.version,
        amount: 20000,
        paymentMethod: 'other',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });
      expect(pFinal.invoice.amountPaid).toBe(270000);
      expect(pFinal.invoice.balanceDue).toBe(0);
      expect(pFinal.invoice.paymentStatus).toBe(PAYMENT_STATUS.PAID);
      expect(bookingAdapter._inspectState().clientReservations.get(bkg.id)?.paymentStatus).toBe(
        PAYMENT_STATUS.PAID,
      );
      expect(getEffectivePaymentStatus(pFinal.invoice, '2026-12-01')).toBe(PAYMENT_STATUS.PAID);

      // Voiding an invoice with amountPaid > 0 is strictly blocked
      await expect(
        voidInvoice({
          invoiceId: invId,
          expectedVersion: pFinal.invoice.version,
          reason: 'Coba void saat sudah lunas',
          actorUid: 'owner-uid-1',
          adapter: paymentAdapter,
        }),
      ).rejects.toMatchObject({ code: 'invoice/has-payments' });

      // Append-only reversal of pFinal restores balanceDue to Rp 20.000 & keeps original record
      const rev = await reversePaymentTransaction({
        invoiceId: invId,
        originalTransactionId: 'pay-other-final',
        expectedVersion: pFinal.invoice.version,
        reason: 'Salah catat pembayaran akhir',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });
      expect(rev.reversal.transactionType).toBe(TRANSACTION_TYPE.REVERSAL);
      expect(rev.reversal.reversalOfTransactionId).toBe('pay-other-final');
      expect(rev.invoice.amountPaid).toBe(250000);
      expect(rev.invoice.balanceDue).toBe(20000);
      expect(rev.invoice.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);
      expect(bookingAdapter._inspectState().clientReservations.get(bkg.id)?.paymentStatus).toBe(
        PAYMENT_STATUS.PARTIAL,
      );

      // Duplicate reversal of the same original transaction is strictly rejected
      await expect(
        reversePaymentTransaction({
          invoiceId: invId,
          originalTransactionId: 'pay-other-final',
          expectedVersion: rev.invoice.version,
          reason: 'Coba reverse dua kali',
          actorUid: 'owner-uid-1',
          adapter: paymentAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment/already-reversed' });

      // Void unpaid invoice requires reason, succeeds with reason, and blocks subsequent payments
      const bkgToVoid = await createBooking({
        bookingId: 'bkg-p8-voidable',
        eventId: 'evt-p8-voidable',
        actorUid: 'owner-uid-1',
        formValues: buildBookingForm({
          date: '2026-11-23',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '0',
        }),
        adapter: bookingAdapter,
      });
      const voidInvId = buildInvoiceId(bkgToVoid.id);
      await expect(
        voidInvoice({
          invoiceId: voidInvId,
          expectedVersion: 1,
          reason: '',
          actorUid: 'owner-uid-1',
          adapter: paymentAdapter,
        }),
      ).rejects.toMatchObject({ code: 'invoice/validation-error' });

      const voided = await voidInvoice({
        invoiceId: voidInvId,
        expectedVersion: 1,
        reason: 'Customer batal sebelum pembayaran',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });
      expect(voided.invoiceStatus).toBe(INVOICE_STATUS.VOID);

      await expect(
        recordInvoicePayment({
          invoiceId: voidInvId,
          expectedVersion: voided.version,
          amount: 50000,
          paymentMethod: 'cash',
          actorUid: 'owner-uid-1',
          adapter: paymentAdapter,
        }),
      ).rejects.toMatchObject({ code: 'payment/invoice-void' });
    });

    it('does not synchronize a Client reservation when its non-empty UID conflicts with the invoice UID', async () => {
      const booking = await createBooking({
        bookingId: 'bkg-p8-uid-mismatch',
        eventId: 'evt-p8-uid-mismatch',
        actorUid: 'owner-uid-1',
        formValues: buildBookingForm({
          date: '2026-11-28',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '0',
        }),
        adapter: bookingAdapter,
      });
      const invoiceId = buildInvoiceId(booking.id);

      await paymentAdapter.runAtomicTransaction(async (tx) => {
        const invoice = await tx.getInvoice(invoiceId);
        tx.updateInvoice(invoiceId, {
          ...invoice,
          clientUid: 'invoice-client-uid',
        });
      });

      const currentReservation = bookingAdapter._inspectState().clientReservations.get(booking.id);
      expect(currentReservation?.paymentStatus).toBe(PAYMENT_STATUS.UNPAID);
      bookingAdapter._seedClientReservation(booking.id, {
        ...currentReservation,
        clientUid: 'reservation-client-uid',
      });

      const payment = await recordInvoicePayment({
        transactionId: 'pay-p8-uid-mismatch',
        invoiceId,
        expectedVersion: 1,
        amount: 25000,
        paymentMethod: 'cash',
        actorUid: 'staff-uid-2',
        adapter: paymentAdapter,
      });

      expect(payment.invoice.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);
      expect(payment.invoice.clientUid).toBe('invoice-client-uid');
      expect(
        bookingAdapter._inspectState().clientReservations.get(booking.id)?.paymentStatus,
      ).toBe(PAYMENT_STATUS.UNPAID);

      // Reversal, due-date edit, and void must also preserve non-empty invoice clientUid
      const reversal = await reversePaymentTransaction({
        invoiceId,
        originalTransactionId: payment.transaction.id,
        expectedVersion: payment.invoice.version,
        reason: 'Koreksi input untuk verifikasi retensi clientUid',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });
      expect(reversal.invoice.clientUid).toBe('invoice-client-uid');
      expect(
        bookingAdapter._inspectState().clientReservations.get(booking.id)?.paymentStatus,
      ).toBe(PAYMENT_STATUS.UNPAID);

      const dueUpdated = await updateInvoiceDueDate({
        invoiceId,
        expectedVersion: reversal.invoice.version,
        dueDate: '2026-12-05',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });
      expect(dueUpdated.clientUid).toBe('invoice-client-uid');

      const voided = await voidInvoice({
        invoiceId,
        expectedVersion: dueUpdated.version,
        reason: 'Pembatalan invoice uji retensi clientUid',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });
      expect(voided.clientUid).toBe('invoice-client-uid');
    });

    it('synchronizes Client reservation paymentStatus when non-empty UIDs match cleanly and keeps empty UID rules strict', async () => {
      const booking = await createBooking({
        bookingId: 'bkg-p8-uid-match',
        eventId: 'evt-p8-uid-match',
        actorUid: 'owner-uid-1',
        formValues: buildBookingForm({
          date: '2026-11-28',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '0',
        }),
        adapter: bookingAdapter,
      });
      const invoiceId = buildInvoiceId(booking.id);
      const currentReservation = bookingAdapter._inspectState().clientReservations.get(booking.id);

      await paymentAdapter.runAtomicTransaction(async (tx) => {
        const invoice = await tx.getInvoice(invoiceId);
        tx.updateInvoice(invoiceId, {
          ...invoice,
          clientUid: 'matched-client-uid',
        });
      });
      bookingAdapter._seedClientReservation(booking.id, {
        ...currentReservation,
        clientUid: 'matched-client-uid',
      });

      const payment = await recordInvoicePayment({
        transactionId: 'pay-p8-uid-match',
        invoiceId,
        expectedVersion: 1,
        amount: 25000,
        paymentMethod: 'cash',
        actorUid: 'staff-uid-2',
        adapter: paymentAdapter,
      });

      expect(payment.invoice.clientUid).toBe('matched-client-uid');
      expect(
        bookingAdapter._inspectState().clientReservations.get(booking.id)?.paymentStatus,
      ).toBe(PAYMENT_STATUS.PARTIAL);

      // Invoice with empty clientUid never invents an identity when booking/reservation has a different UID
      const bookingNoInvUid = await createBooking({
        bookingId: 'bkg-p8-empty-inv-uid',
        eventId: 'evt-p8-empty-inv-uid',
        actorUid: 'owner-uid-1',
        formValues: buildBookingForm({
          date: '2026-11-29',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '0',
        }),
        adapter: bookingAdapter,
      });
      const paymentNoUid = await recordInvoicePayment({
        transactionId: 'pay-p8-empty-inv-uid',
        invoiceId: buildInvoiceId(bookingNoInvUid.id),
        expectedVersion: 1,
        amount: 25000,
        paymentMethod: 'cash',
        actorUid: 'staff-uid-2',
        adapter: paymentAdapter,
      });
      expect(paymentNoUid.invoice.clientUid).toBe('');
      expect(
        bookingAdapter._inspectState().clientReservations.get(bookingNoInvUid.id)?.paymentStatus,
      ).toBe(PAYMENT_STATUS.PARTIAL);
    });
  });

  describe('D. Snapshot Integrity & Internal Commission Isolation', () => {
    it('keeps historical invoice snapshots immutable after Customer rename or Booking reschedule and excludes internal fees', async () => {
      const bkg = await createBooking({
        bookingId: 'bkg-p8-snap',
        eventId: 'evt-p8-snap',
        actorUid: 'owner-uid-1',
        formValues: buildBookingForm({
          customerName: 'Original Client',
          phone: '081555666777',
          bandName: 'Original Band',
          date: '2026-11-24',
        }),
        adapter: bookingAdapter,
      });
      const invId = buildInvoiceId(bkg.id);
      const originalInv = await paymentAdapter.getInvoiceById(invId);
      expect(originalInv.financialSnapshot.totalAmount).toBe(bkg.totalAmount);
      // Internal commissionSnapshot must NEVER appear on customer invoice
      expect(originalInv.commissionSnapshot).toBeUndefined();

      // WhatsApp summary contains invoice figures and zero fabricated tax/bank data
      const waSummary = buildWhatsAppInvoiceSummary(originalInv);
      expect(waSummary).toContain(originalInv.invoiceNumber);
      expect(waSummary).not.toMatch(/npwp|rekening|staff fee|owner fee/i);

      // Renaming Customer Profile does NOT alter historical invoice customerSnapshot
      await updateCustomerProfile({
        customerId: bkg.customerId,
        expectedVersion: 1,
        actorUid: 'owner-uid-1',
        input: { displayName: 'Renamed Client Later', notes: '' },
        adapter: customerAdapter,
      });

      // Rescheduling booking does NOT create a second invoice or mutate historical invoice snapshot
      await updateOrRescheduleBooking({
        bookingId: bkg.id,
        expectedVersion: bkg.version,
        actorUid: 'owner-uid-1',
        mode: 'reschedule',
        formValues: buildBookingForm({
          customerName: 'Edited Booking Contact',
          phone: '081555666777',
          bandName: 'Edited Band',
          date: '2026-11-26',
          startMinute: 720,
        }),
        adapter: bookingAdapter,
      });

      expect(paymentAdapter._inspectState().invoices.size).toBe(1);
      const invAfter = await paymentAdapter.getInvoiceById(invId);
      expect(invAfter.customerSnapshot.name).toBe('Original Client');
      expect(invAfter.bookingSnapshot.bookingDate).toBe('2026-11-24');
      expect(invAfter.financialSnapshot.totalAmount).toBe(270000);
    });
  });

  describe('E. Legacy Booking & Initial Payment Reconciliation (No Double Counting)', () => {
    it('scans legacy bookings read-only, imports in resumable batches idempotently, preserves bookings, and supports Needs Review reconciliation', async () => {
      const legacyBookingAdapter = createInMemoryBookingRepositoryAdapter([
        {
          id: 'leg-p8-paid',
          customerId: 'cust-leg-1',
          customerName: 'Legacy Paid Band',
          phone: '081211112222',
          phoneNormalized: '+6281211112222',
          bandName: 'Retro Rock',
          studioId: 'room-a',
          date: '2026-10-10',
          startMinute: 600,
          durationMinutes: 120,
          unitRate: 100000,
          subtotal: 200000,
          discountAmount: 0,
          totalAmount: 200000,
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
          initialPaidAmount: 200000,
          paymentMethod: 'transfer',
          sessionStatus: BOOKING_SESSION_STATUS.COMPLETED,
          version: 1,
        },
        {
          id: 'leg-p8-partial',
          customerId: 'cust-leg-2',
          customerName: 'Legacy DP Client',
          phone: '081233334444',
          phoneNormalized: '+6281233334444',
          studioId: 'room-b',
          date: '2026-10-11',
          startMinute: 600,
          durationMinutes: 120,
          unitRate: 100000,
          subtotal: 200000,
          discountAmount: 0,
          totalAmount: 200000,
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
          initialPaidAmount: 50000,
          paymentMethod: 'cash',
          sessionStatus: BOOKING_SESSION_STATUS.COMPLETED,
          version: 1,
        },
        {
          id: 'leg-p8-unpaid',
          customerId: 'cust-leg-3',
          customerName: 'Legacy Unpaid Client',
          phone: '081255556666',
          phoneNormalized: '+6281255556666',
          studioId: 'room-a',
          date: '2026-10-12',
          startMinute: 600,
          durationMinutes: 60,
          unitRate: 100000,
          subtotal: 100000,
          discountAmount: 0,
          totalAmount: 100000,
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          initialPaidAmount: 0,
          paymentMethod: '',
          sessionStatus: BOOKING_SESSION_STATUS.UPCOMING,
          version: 1,
        },
        {
          id: 'leg-p8-mismatch',
          customerId: 'cust-leg-4',
          customerName: 'Mismatch Client',
          phone: '081277778888',
          phoneNormalized: '+6281277778888',
          studioId: 'room-a',
          date: '2026-10-13',
          startMinute: 600,
          durationMinutes: 120,
          unitRate: 100000,
          subtotal: 200000,
          discountAmount: 0,
          totalAmount: 200000,
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
          initialPaidAmount: 100000, // inconsistent with Paid!
          paymentMethod: 'cash',
          sessionStatus: BOOKING_SESSION_STATUS.COMPLETED,
          version: 1,
        },
        {
          id: 'leg-p8-cancelled',
          customerId: 'cust-leg-5',
          customerName: 'Cancelled Legacy',
          phone: '081299990000',
          phoneNormalized: '+6281299990000',
          studioId: 'room-a',
          date: '2026-10-14',
          startMinute: 600,
          durationMinutes: 60,
          unitRate: 100000,
          subtotal: 100000,
          discountAmount: 0,
          totalAmount: 100000,
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          initialPaidAmount: 0,
          paymentMethod: '',
          sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
          version: 1,
        },
      ]);
      const legacyPayAdapter = createInMemoryPaymentRepositoryAdapter(legacyBookingAdapter);

      // 1. Preview makes ZERO writes
      const preview1 = await scanLegacyBookingsForInvoicesPreview({ adapter: legacyPayAdapter });
      expect(preview1.totalWithoutInvoice).toBe(5);
      expect(preview1.importableCount).toBe(3);
      expect(preview1.needsReviewCount).toBe(2);
      expect(preview1.cancelledOrNoShowCount).toBe(1);
      expect(legacyPayAdapter._inspectState().invoices.size).toBe(0);

      // 2. Import in small resumable batches (`maxBatchWrites: 2`)
      const run1 = await importLegacyBookingInvoices({
        actorUid: 'owner-uid-1',
        preview: preview1,
        maxBatchWrites: 2,
        adapter: legacyPayAdapter,
      });
      expect(run1.createdInvoicesCount).toBe(3);
      expect(run1.createdInitialPaymentsCount).toBe(2); // paid + partial only (unpaid has 0)
      expect(run1.batchesCommitted).toBeGreaterThanOrEqual(2);

      // Verify legacy booking untouched & legacy payment has source='legacy_initial_snapshot'
      const invPartial = await legacyPayAdapter.getInvoiceById(buildInvoiceId('leg-p8-partial'));
      expect(invPartial.amountPaid).toBe(50000);
      expect(invPartial.balanceDue).toBe(150000);
      const txPartial = await legacyPayAdapter.getPaymentTransactionById(
        buildInitialPaymentId('leg-p8-partial'),
      );
      expect(txPartial.source).toBe(PAYMENT_SOURCE.LEGACY_INITIAL_SNAPSHOT);
      expect(legacyBookingAdapter._inspectState().bookings.get('leg-p8-partial').version).toBe(1);

      // 3. Re-running import is 100% idempotent (zero double counting!)
      const run2 = await importLegacyBookingInvoices({
        actorUid: 'owner-uid-1',
        preview: preview1,
        adapter: legacyPayAdapter,
      });
      expect(run2.createdInvoicesCount).toBe(0);
      expect(run2.skippedAlreadyExistsCount).toBe(3);
      expect(legacyPayAdapter._inspectState().paymentTransactions.size).toBe(2);

      // A pre-existing Client-safe projection must be synchronized when Owner
      // explicitly reconciles a Needs Review legacy payment amount.
      legacyBookingAdapter._seedClientReservation('leg-p8-mismatch', {
        schemaVersion: 2,
        bookingId: 'leg-p8-mismatch',
        bookingReference: 'BKG-LEG-MISMATCH',
        customerId: 'cust-leg-4',
        clientUid: '',
        sourceRequestId: '',
        acceptedOfferId: '',
        invoiceId: 'inv_leg-p8-mismatch',
        studioId: 'room-a',
        studioName: 'Room A — Live Room',
        serviceTypeName: 'Rehearsal',
        serviceOptionName: 'Reguler',
        date: '2026-10-13',
        startMinute: 600,
        endMinute: 720,
        durationMinutes: 120,
        timeZone: 'Asia/Jakarta',
        reservationStatus: 'confirmed',
        sessionStatus: 'completed',
        holdExpiresAt: null,
        effectiveTotalAmount: 200000,
        minimumDepositAmount: null,
        depositStatus: null,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        createdAt: { seconds: 1791850000 },
        updatedAt: { seconds: 1791850000 },
        version: 1,
      });

      // 4. Explicit review reconciliation for inconsistent record
      const reconciled = await reconcileNeedsReviewLegacyBooking({
        bookingId: 'leg-p8-mismatch',
        verifiedPaidAmount: 100000,
        paymentMethod: 'transfer',
        actorUid: 'owner-uid-1',
        adapter: legacyPayAdapter,
      });
      expect(reconciled.amountPaid).toBe(100000);
      expect(reconciled.balanceDue).toBe(100000);
      expect(reconciled.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);
      expect(
        legacyBookingAdapter._inspectState().clientReservations.get('leg-p8-mismatch')?.paymentStatus,
      ).toBe(PAYMENT_STATUS.PARTIAL);
    });
  });

  describe('F. End-to-End UI Integration (/admin/payment-and-bill, Calendar & Customer)', () => {
    it('operates /admin/payment-and-bill (record payment, print preview, receipt, transactions tab), updates Calendar BookingDetailDrawer live, and lists merged customer invoices', async () => {
      // Seed 2 bookings on shared phone (then merge customers to test virtual merged invoice lookup!)
      const bkg1 = await createBooking({
        bookingId: 'bkg-ui-1',
        eventId: 'evt-ui-1',
        actorUid: 'owner-uid-1',
        formValues: buildBookingForm({
          customerName: 'Arief Music',
          phone: '081234567890',
          bandName: 'Velvet Band',
          date: todayIso,
          startMinute: 600,
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
          dpAmount: '100000',
          paymentMethod: 'transfer',
        }),
        adapter: bookingAdapter,
      });
      const bkg2 = await createBooking({
        bookingId: 'bkg-ui-2',
        eventId: 'evt-ui-2',
        actorUid: 'owner-uid-1',
        formValues: buildBookingForm({
          customerName: 'Arief Acoustic',
          phone: '081234567890',
          bandName: 'Acoustic Project',
          date: todayIso,
          startMinute: 840,
          durationPreset: '60',
          customDurationMinutes: '60',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '0',
          paymentMethod: '',
        }),
        customerResolution: {
          mode: CUSTOMER_RESOLUTION_MODE.CREATE_SEPARATE,
          customerId: 'cust-arief-alt',
        },
        adapter: bookingAdapter,
      });

      // Merge customer 2 into customer 1 virtually (bookings/invoices keep their original customerIds!)
      await mergeCustomerProfiles({
        targetCustomerId: bkg1.customerId,
        sourceCustomerId: bkg2.customerId,
        actorUid: 'owner-uid-1',
        adapter: customerAdapter,
      });

      const inv1Id = buildInvoiceId(bkg1.id);
      const inv1 = await paymentAdapter.getInvoiceById(inv1Id);
      const inv2 = await paymentAdapter.getInvoiceById(buildInvoiceId(bkg2.id));

      const user = userEvent.setup();
      mockAuthenticatedStaff('owner');
      renderAppAt('/admin/payment-and-bill');

      // 1. Verify /admin/payment-and-bill renders invoices & accurate overview metrics
      expect(await screen.findByText(inv1.invoiceNumber, {}, { timeout: 5000 })).toBeTruthy();
      expect(screen.getByText(inv2.invoiceNumber)).toBeTruthy();

      // Open Invoice 1 detail drawer and record final payment (Rp 170.000) via UI
      await user.click(
        screen.getByRole('button', {
          name: new RegExp(`buka detail invoice ${inv1.invoiceNumber}`, 'i'),
        }),
      );
      const drawer = await screen.findByRole('dialog', {
        name: new RegExp(inv1.invoiceNumber, 'i'),
      });
      await user.click(within(drawer).getByRole('button', { name: /catat pembayaran/i }));

      const payDialog = await screen.findByRole('dialog', { name: /catat pembayaran/i });
      // Default prefilled amount is full remaining balance (170000); add reference and save
      await user.type(within(payDialog).getByLabelText(/no\. referensi/i), 'TRF-FINAL-88');
      await user.click(within(payDialog).getByRole('button', { name: /simpan pembayaran/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /catat pembayaran/i })).toBeNull();
      });

      // Invoice 1 is now PAID (Rp 0 remaining) and displays the new transaction reference
      expect(await within(drawer).findByText(/TRF-FINAL-88/i)).toBeTruthy();

      // Open Print Preview & verify editorial A4 sheet renders cleanly
      await user.click(within(drawer).getByRole('button', { name: /cetak \/ pdf/i }));
      const printDlg = await screen.findByRole('dialog', { name: /preview cetak & pdf/i });
      expect(within(printDlg).getAllByText(/37 MUSIC STUDIO/i).length).toBeGreaterThanOrEqual(2);
      await user.click(
        within(printDlg).getByRole('button', { name: /tutup preview cetak invoice/i }),
      );
      await user.click(within(drawer).getByRole('button', { name: /tutup detail invoice/i }));

      // Switch to Transactions tab and verify reference appears
      await user.click(screen.getByRole('tab', { name: /riwayat bayar/i }));
      expect(await screen.findByText(/TRF-FINAL-88/i)).toBeTruthy();

      // 2. Navigate to Calendar -> Booking 1 Detail Drawer MUST show authoritative Lunas status (NOT stale initial DP!)
      const sidebar = screen.getByRole('navigation', { name: /admin workspace navigation/i });
      await user.click(within(sidebar).getByRole('link', { name: 'Calendar' }));
      expect(await screen.findByText(/jadwal studio/i)).toBeTruthy();

      const bookingButtons = await screen.findAllByRole('button', { name: /arief music/i });
      await user.click(bookingButtons[0]);
      const bookingDrawer = await screen.findByRole('dialog', { name: /arief music/i });
      expect(within(bookingDrawer).getByText(inv1.invoiceNumber)).toBeTruthy();
      expect(within(bookingDrawer).getByRole('link', { name: /lihat invoice/i })).toBeTruthy();
      expect(within(bookingDrawer).getAllByText(/lunas/i).length).toBeGreaterThanOrEqual(2);
      await user.click(
        within(bookingDrawer).getByRole('button', { name: /tutup detail booking/i }),
      );

      // 3. Navigate to Customer -> Detail Drawer MUST list BOTH invoices across merged virtual history!
      await user.click(within(sidebar).getByRole('link', { name: 'Customer' }));
      await user.click(
        await screen.findByRole('button', { name: /buka detail profil arief music/i }),
      );
      const custDrawer = await screen.findByRole('dialog', { name: /arief music/i });
      expect(await within(custDrawer).findByText(inv1.invoiceNumber)).toBeTruthy();
      expect(await within(custDrawer).findByText(inv2.invoiceNumber)).toBeTruthy();
    });
  });

  describe('G. Firestore Security Rules Contract Verification (Phase 8)', () => {
    it('enforces invoices, paymentTransactions, snapshot immutability, aggregate math, void guards, and append-only reversals in firestore.rules', () => {
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');

      expect(rulesContent).toContain('match /invoices/{invoiceId}');
      expect(rulesContent).toContain('match /paymentTransactions/{transactionId}');
      expect(rulesContent).toContain('function isValidInvoiceBase(data, invoiceId)');
      expect(rulesContent).toContain(
        'function isInvoiceImmutableFieldsUnchanged(reqData, resData)',
      );
      expect(rulesContent).toContain(
        'function isValidInvoicePaymentAggregateUpdate(reqData, resData, invoiceId)',
      );
      expect(rulesContent).toContain('function isValidInvoiceVoidUpdate(reqData, resData)');
      expect(rulesContent).toContain(
        'function isValidPaymentTransactionCreate(data, transactionId)',
      );
      expect(rulesContent).toContain('allow update: if false;');
      expect(rulesContent).toContain('allow delete: if canFactoryResetDelete();');
    });
  });
});
