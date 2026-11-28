import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

import { calculateBookkeepingMetrics } from '@/features/admin/bookkeeping/utils/bookkeeping-calculation';
import { BookingFormDialog } from '@/features/admin/calendar/components/BookingFormDialog';
import { INITIAL_PAYMENT_STATUS } from '@/features/admin/calendar/config/calendar-config';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  createBooking,
  createInMemoryBookingRepositoryAdapter,
  updateOrRescheduleBooking,
} from '@/features/admin/calendar/services/calendar-booking-service';
import {
  createInMemoryCustomerRepositoryAdapter,
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
} from '@/features/admin/customer/repositories/customer-repository';
import {
  createInMemoryPaymentEvidenceRepositoryAdapter,
  resetPaymentEvidenceRepositoryAdapter,
  setPaymentEvidenceRepositoryAdapter,
} from '@/features/payment-evidence/repositories/payment-evidence-repository';
import { AuthContext } from '@/features/auth/AuthContext';
import { ClientInvoiceDetailDrawer } from '@/features/client-portal/billing/components/ClientInvoiceDetailDrawer';
import {
  createInMemoryClientBillingRepositoryAdapter,
  resetClientBillingRepositoryAdapter,
  setClientBillingRepositoryAdapter,
} from '@/features/client-portal/billing/repositories/client-billing-repository';

import { InvoiceAdjustmentDialog } from './components/InvoiceAdjustmentDialog';
import { InvoiceDetailDrawer } from './components/InvoiceDetailDrawer';
import { RecordPaymentDialog } from './components/RecordPaymentDialog';
import {
  createInMemoryPaymentRepositoryAdapter,
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from './repositories/payment-repository';
import { createInvoiceAdjustment } from './services/adjustment-service';
import { issueDraftInvoice } from './services/invoice-service';
import {
  recordInvoicePayment,
  recordStaffCashPayment,
  reversePaymentTransaction,
} from './services/payment-service';
import { buildWhatsAppInvoiceSummary } from './utils/invoice-format';
import { buildInvoiceId, buildInvoiceNumber } from './utils/invoice-number';
import {
  INVOICE_STATUS,
  PAYMENT_SOURCE,
  PAYMENT_STATUS,
} from './utils/invoice-status';

function makeBookingFormValues(overrides = {}) {
  return {
    customerName: 'Nadia Pratama',
    phone: '081234567890',
    bandName: 'Velvet Echo',
    studioId: 'room-a',
    serviceTypeId: 'rehearsal',
    serviceOptionId: 'rehearsal-regular',
    serviceId: 'rehearsal',
    date: '2026-12-05',
    startMinute: 600,
    durationPreset: '120',
    customDurationMinutes: '120',
    initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
    dpAmount: '',
    paymentMethod: 'cash',
    notes: '',
    ...overrides,
  };
}

function seedPortalInvoice(bookingAdapter, { bookingId = 'bkg_p3_1', totalAmount = 400000 } = {}) {
  const invoiceId = buildInvoiceId(bookingId);
  const bookingDate = '2026-12-05';
  const invoiceNumber = buildInvoiceNumber({ bookingId, bookingDate });
  const invDoc = {
    id: invoiceId,
    invoiceNumber,
    bookingId,
    customerId: 'cust_client_a',
    clientUid: 'client-uid-a',
    invoiceStatus: INVOICE_STATUS.ISSUED,
    currency: 'IDR',
    clientPaymentEvidenceRequired: true,
    customerSnapshot: {
      name: 'Nadia Pratama',
      phone: '+6281234567890',
      bandName: 'Velvet Echo',
    },
    bookingSnapshot: {
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Reguler',
      studioId: 'room-a',
      bookingDate,
      startMinute: 600,
      endMinute: 720,
      durationMinutes: 120,
    },
    financialSnapshot: {
      subtotal: totalAmount,
      discountAmount: 0,
      totalAmount,
    },
    amountPaid: 0,
    balanceDue: totalAmount,
    paymentStatus: PAYMENT_STATUS.UNPAID,
    minimumDepositAmount: 100000,
    depositStatus: 'awaiting_deposit',
    invoiceDate: '2026-12-01T08:00:00.000Z',
    dueDate: '2026-12-05',
    lastPaymentTransactionId: null,
    voidReason: '',
    createdAt: '2026-12-01T08:00:00.000Z',
    createdByUid: 'staff-1',
    updatedAt: '2026-12-01T08:00:00.000Z',
    updatedByUid: 'staff-1',
    version: 1,
  };
  bookingAdapter._sharedStore.invoices.set(invoiceId, invDoc);
  bookingAdapter._seedClientReservation(bookingId, {
    schemaVersion: 2,
    bookingId,
    bookingReference: bookingId.toUpperCase(),
    customerId: 'cust_client_a',
    clientUid: 'client-uid-a',
    sourceRequestId: '',
    acceptedOfferId: '',
    invoiceId,
    studioId: 'room-a',
    studioName: 'Room A — Live Room',
    serviceTypeName: 'Rehearsal',
    serviceOptionName: 'Reguler',
    date: bookingDate,
    startMinute: 600,
    endMinute: 720,
    durationMinutes: 120,
    timeZone: 'Asia/Jakarta',
    reservationStatus: 'deposit_hold',
    sessionStatus: 'pending_confirmation',
    holdExpiresAt: '2026-12-02T08:00:00.000Z',
    effectiveTotalAmount: totalAmount,
    minimumDepositAmount: 100000,
    depositStatus: 'awaiting_deposit',
    paymentStatus: PAYMENT_STATUS.UNPAID,
    createdAt: '2026-12-01T08:00:00.000Z',
    updatedAt: '2026-12-01T08:00:00.000Z',
    version: 1,
  });
  bookingAdapter._sharedStore.notifyInvoices();
  bookingAdapter._sharedStore.notifyClientReservations?.();
  return invDoc;
}

describe('Phase 3 — Multi-Method Payments, Staff Cash Desk, Adjustments & Calendar Pricing Closure', () => {
  let bookingAdapter;
  let customerAdapter;
  let paymentAdapter;
  let evidenceAdapter;
  let clientBillingAdapter;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    bookingAdapter = createInMemoryBookingRepositoryAdapter();
    customerAdapter = createInMemoryCustomerRepositoryAdapter(bookingAdapter);
    paymentAdapter = createInMemoryPaymentRepositoryAdapter(bookingAdapter);
    evidenceAdapter = createInMemoryPaymentEvidenceRepositoryAdapter({ bookingAdapter });
    clientBillingAdapter = createInMemoryClientBillingRepositoryAdapter({ bookingAdapter });

    setBookingRepositoryAdapter(bookingAdapter);
    setCustomerRepositoryAdapter(customerAdapter);
    setPaymentRepositoryAdapter(paymentAdapter);
    setPaymentEvidenceRepositoryAdapter(evidenceAdapter);
    setClientBillingRepositoryAdapter(clientBillingAdapter);
  });

  afterEach(() => {
    cleanup();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPaymentRepositoryAdapter();
    resetPaymentEvidenceRepositoryAdapter();
    resetClientBillingRepositoryAdapter();
  });

  it('A. Records multi-method installments & allows Staff Desk Cash on Client Portal invoices while blocking manual non-cash bypass', async () => {
    const portalInvoice = seedPortalInvoice(bookingAdapter, {
      bookingId: 'bkg_p3_cash',
      totalAmount: 450000,
    });

    // Non-cash manual transfer fails closed on Client Portal invoice
    await expect(
      recordInvoicePayment({
        invoiceId: portalInvoice.id,
        expectedVersion: 1,
        amount: 100000,
        paymentMethod: 'transfer',
        actorUid: 'staff-1',
        adapter: paymentAdapter,
      }),
    ).rejects.toMatchObject({ code: 'payment/client-evidence-required' });

    // Non-cash via recordStaffCashPayment also rejected
    await expect(
      recordStaffCashPayment({
        invoiceId: portalInvoice.id,
        expectedVersion: 1,
        amount: 100000,
        paymentMethod: 'qris',
        actorUid: 'staff-1',
        adapter: paymentAdapter,
      }),
    ).rejects.toMatchObject({ code: 'payment/invalid-cash-source' });

    // Staff Desk Cash succeeds atomically on Client Portal invoice!
    const cashPay1 = await recordStaffCashPayment({
      transactionId: 'pay_cash_desk_1',
      invoiceId: portalInvoice.id,
      expectedVersion: 1,
      amount: 150000,
      notes: 'DP Tunai langsung di kasir studio',
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });
    expect(cashPay1.transaction.paymentMethod).toBe('cash');
    expect(cashPay1.transaction.source).toBe(PAYMENT_SOURCE.STAFF_CASH_DESK);
    expect(cashPay1.invoice.amountPaid).toBe(150000);
    expect(cashPay1.invoice.balanceDue).toBe(300000);
    expect(cashPay1.invoice.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);

    // Subsequent walk-in / admin invoice supports multi-method installments (cash + transfer + qris)
    const walkin = await createBooking({
      bookingId: 'bkg_p3_multi',
      eventId: 'evt_p3_multi',
      actorUid: 'staff-1',
      formValues: makeBookingFormValues({
        studioId: 'room-b',
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
        dpAmount: '100000',
        paymentMethod: 'cash',
      }),
      adapter: bookingAdapter,
    });
    const walkinInvId = buildInvoiceId(walkin.id);
    const invBefore = bookingAdapter._sharedStore.invoices.get(walkinInvId);

    const p2 = await recordInvoicePayment({
      transactionId: 'pay_multi_2',
      invoiceId: walkinInvId,
      expectedVersion: invBefore.version,
      amount: 60000,
      paymentMethod: 'transfer',
      referenceNumber: 'BCA-7712',
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });
    const p3 = await recordInvoicePayment({
      transactionId: 'pay_multi_3',
      invoiceId: walkinInvId,
      expectedVersion: p2.invoice.version,
      amount: 40000,
      paymentMethod: 'qris',
      referenceNumber: 'QRIS-8823',
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });

    const txs = Array.from(bookingAdapter._sharedStore.paymentTransactions.values()).filter(
      (t) => t.invoiceId === walkinInvId,
    );
    expect(txs.map((t) => t.paymentMethod).sort()).toEqual(['cash', 'qris', 'transfer']);
    expect(p3.invoice.paymentStatus).toBe(PAYMENT_STATUS.PAID);
    expect(p3.invoice.balanceDue).toBe(0);
  });

  it('B. RecordPaymentDialog restricts Portal invoices to Studio Desk Cash and submits staff_cash_desk', async () => {
    const portalInvoice = seedPortalInvoice(bookingAdapter, {
      bookingId: 'bkg_p3_dlg_cash',
      totalAmount: 300000,
    });
    const onSubmitSpy = vi.fn(async (payload) =>
      recordStaffCashPayment({ ...payload, actorUid: 'staff-1', adapter: paymentAdapter }),
    );
    const user = userEvent.setup();

    render(
      <RecordPaymentDialog
        open
        invoice={portalInvoice}
        onOpenChange={() => {}}
        onSubmitPayment={onSubmitSpy}
      />,
    );

    expect(screen.getByTestId('record-payment-staff-cash-notice')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^cash$/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^transfer$/i }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /^qris$/i }).disabled).toBe(true);

    const amountInput = screen.getByLabelText(/nominal pembayaran/i);
    await user.clear(amountInput);
    await user.type(amountInput, '120000');
    await user.click(screen.getByRole('button', { name: /simpan pembayaran/i }));

    await waitFor(() => expect(onSubmitSpy).toHaveBeenCalledTimes(1));
    expect(onSubmitSpy.mock.calls[0][0]).toMatchObject({
      invoiceId: portalInvoice.id,
      amount: 120000,
      paymentMethod: 'cash',
      source: PAYMENT_SOURCE.STAFF_CASH_DESK,
    });
  });

  it('C. Adjustments engine handles addendum, reduction into overpaid_credit_pending, reversal recovery, idempotency, draft->issued & Bookkeeping/WA projection', async () => {
    const portalInv = seedPortalInvoice(bookingAdapter, {
      bookingId: 'bkg_p3_adj',
      totalAmount: 400000,
    });

    // Pay full 400,000 via Staff Cash Desk first
    const paidRes = await recordStaffCashPayment({
      transactionId: 'pay_adj_full',
      invoiceId: portalInv.id,
      expectedVersion: 1,
      amount: 400000,
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });

    // Validation & fail-closed checks
    await expect(
      createInvoiceAdjustment({
        invoiceId: portalInv.id,
        expectedVersion: paidRes.invoice.version,
        category: 'manual_correction',
        deltaAmount: 0,
        reason: 'Nol tidak valid',
        actorUid: 'staff-1',
        adapter: paymentAdapter,
      }),
    ).rejects.toMatchObject({ code: 'adjustment/validation-error' });

    await expect(
      createInvoiceAdjustment({
        invoiceId: portalInv.id,
        expectedVersion: paidRes.invoice.version,
        category: 'discount_credit',
        deltaAmount: -450000,
        reason: 'Diskon melebihi total tagihan',
        actorUid: 'staff-1',
        adapter: paymentAdapter,
      }),
    ).rejects.toMatchObject({ code: 'adjustment/negative-total-not-allowed' });

    await expect(
      createInvoiceAdjustment({
        invoiceId: portalInv.id,
        expectedVersion: 99,
        category: 'service_change',
        deltaAmount: 50000,
        reason: 'Versi usang',
        actorUid: 'staff-1',
        adapter: paymentAdapter,
      }),
    ).rejects.toMatchObject({ code: 'adjustment/stale-invoice' });

    // 1. Upward addendum (+100,000) keeps financialSnapshot & minimumDepositAmount immutable!
    const upAdj = await createInvoiceAdjustment({
      adjustmentId: 'adj_000000000000000000000101',
      invoiceId: portalInv.id,
      expectedVersion: paidRes.invoice.version,
      category: 'duration_change',
      deltaAmount: 100000,
      reason: 'Perpanjangan sesi 1 jam tambahan atas permintaan band',
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });
    expect(upAdj.invoice.financialSnapshot.totalAmount).toBe(400000);
    expect(upAdj.invoice.minimumDepositAmount).toBe(100000);
    expect(upAdj.invoice.adjustmentTotal).toBe(100000);
    expect(upAdj.invoice.effectiveTotalAmount).toBe(500000);
    expect(upAdj.invoice.balanceDue).toBe(100000);
    expect(upAdj.invoice.paymentStatus).toBe(PAYMENT_STATUS.PARTIAL);
    expect(upAdj.invoice.adjustmentCount).toBe(1);

    // Idempotent replay with same adjustmentId does NOT double-apply
    const replayUp = await createInvoiceAdjustment({
      adjustmentId: 'adj_000000000000000000000101',
      invoiceId: portalInv.id,
      expectedVersion: upAdj.invoice.version,
      category: 'duration_change',
      deltaAmount: 100000,
      reason: 'Perpanjangan sesi 1 jam tambahan atas permintaan band',
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });
    expect(replayUp.idempotentReplay).toBe(true);
    expect(replayUp.invoice.effectiveTotalAmount).toBe(500000);

    // 2. Downward reduction (-250,000) brings effectiveTotalAmount to 250,000 (< amountPaid 400,000) -> overpaid_credit_pending!
    const downAdj = await createInvoiceAdjustment({
      adjustmentId: 'adj_000000000000000000000102',
      invoiceId: portalInv.id,
      expectedVersion: upAdj.invoice.version,
      category: 'discount_credit',
      deltaAmount: -250000,
      reason: 'Pengurangan durasi + koreksi gangguan teknis alat',
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });
    expect(downAdj.invoice.effectiveTotalAmount).toBe(250000);
    expect(downAdj.invoice.balanceDue).toBe(0);
    expect(downAdj.invoice.overpaidCreditBalance).toBe(150000);
    expect(downAdj.invoice.paymentStatus).toBe(PAYMENT_STATUS.OVERPAID_CREDIT_PENDING);
    expect(bookingAdapter._inspectState().clientReservations.get('bkg_p3_adj')).toMatchObject({
      effectiveTotalAmount: 250000,
      paymentStatus: PAYMENT_STATUS.OVERPAID_CREDIT_PENDING,
    });

    // Bookkeeping metrics & WhatsApp summary use effectiveTotalAmount (250,000), not stale snapshot (400,000)
    const bkOverview = calculateBookkeepingMetrics({
      invoices: [downAdj.invoice],
      paymentTransactions: [paidRes.transaction],
    });
    expect(bkOverview.totalBilled).toBe(250000);
    const waText = buildWhatsAppInvoiceSummary(downAdj.invoice);
    expect(waText).toContain('Total Akhir');
    expect(waText).toContain('250.000');
    expect(waText).toContain('Lebih Bayar');

    // 3. Reverse original 400,000 payment -> balanceDue recovers to 250,000 & overpaid resets to 0
    const reversedRes = await reversePaymentTransaction({
      invoiceId: portalInv.id,
      originalTransactionId: paidRes.transaction.id,
      expectedVersion: downAdj.invoice.version,
      reason: 'Koreksi pembayaran tunai yang dibatalkan sebelum pengembalian',
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });
    expect(reversedRes.invoice.amountPaid).toBe(0);
    expect(reversedRes.invoice.overpaidCreditBalance).toBe(0);
    expect(reversedRes.invoice.balanceDue).toBe(250000);
    expect(reversedRes.invoice.paymentStatus).toBe(PAYMENT_STATUS.UNPAID);

    // 4. draft -> issued helper works atomically
    const draftInv = seedPortalInvoice(bookingAdapter, {
      bookingId: 'bkg_p3_draft',
      totalAmount: 200000,
    });
    bookingAdapter._sharedStore.invoices.set(draftInv.id, {
      ...draftInv,
      invoiceStatus: INVOICE_STATUS.DRAFT,
    });
    const issued = await issueDraftInvoice({
      invoiceId: draftInv.id,
      expectedVersion: 1,
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });
    expect(issued.invoiceStatus).toBe(INVOICE_STATUS.ISSUED);
  });

  it('D. Calendar updateOrRescheduleBooking closes applyUpdatedPricing through /adjustments & requires mandatory reason', async () => {
    const created = await createBooking({
      bookingId: 'bkg_p3_cal',
      eventId: 'evt_p3_cal_1',
      actorUid: 'staff-1',
      formValues: makeBookingFormValues({
        studioId: 'room-a',
        durationPreset: '60',
        customDurationMinutes: '60',
      }),
      adapter: bookingAdapter,
    });
    const invId = buildInvoiceId(created.id);
    const invBefore = bookingAdapter._sharedStore.invoices.get(invId);
    expect(invBefore.financialSnapshot.totalAmount).toBe(100000);

    // Changing duration with applyUpdatedPricing: true WITHOUT reason fails closed!
    await expect(
      updateOrRescheduleBooking({
        bookingId: created.id,
        expectedVersion: created.version,
        eventId: 'evt_p3_cal_fail',
        actorUid: 'staff-1',
        formValues: makeBookingFormValues({
          studioId: 'room-a',
          durationPreset: '120',
          customDurationMinutes: '120',
          applyUpdatedPricing: true,
          pricingAdjustmentReason: '',
        }),
        adapter: bookingAdapter,
      }),
    ).rejects.toMatchObject({ code: 'booking/adjustment-reason-required' });

    // Providing reason creates an atomic /adjustments record & keeps financialSnapshot immutable!
    const updated = await updateOrRescheduleBooking({
      bookingId: created.id,
      expectedVersion: created.version,
      eventId: 'evt_p3_cal_ok',
      adjustmentId: 'adj_000000000000000000000201',
      actorUid: 'staff-1',
      formValues: makeBookingFormValues({
        studioId: 'room-a',
        durationPreset: '120',
        customDurationMinutes: '120',
        applyUpdatedPricing: true,
        pricingAdjustmentReason: 'Pelanggan menambah 1 jam sesi latihan menjadi 2 jam',
      }),
      adapter: bookingAdapter,
    });

    expect(updated.totalAmount).toBe(200000);
    const invAfter = bookingAdapter._sharedStore.invoices.get(invId);
    expect(invAfter.financialSnapshot.totalAmount).toBe(100000); // IMMUTABLE!
    expect(invAfter.adjustmentTotal).toBe(100000);
    expect(invAfter.effectiveTotalAmount).toBe(200000);
    expect(invAfter.balanceDue).toBe(200000);
    const savedAdj = bookingAdapter._sharedStore.invoiceAdjustments.get(
      `${invId}__adj_000000000000000000000201`,
    );
    expect(savedAdj).toMatchObject({
      category: 'duration_change',
      deltaAmount: 100000,
      reason: 'Pelanggan menambah 1 jam sesi latihan menjadi 2 jam',
    });

    // BookingFormDialog UI enforces pricingAdjustmentReason when duration + applyUpdatedPricing checked
    const submitSpy = vi.fn();
    const user = userEvent.setup();
    render(
      <BookingFormDialog
        open
        mode="edit"
        editingBooking={updated}
        existingBookings={[updated]}
        onOpenChange={() => {}}
        onSubmitBooking={submitSpy}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^3 Jam$/i }));
    await user.click(screen.getByRole('checkbox', { name: /pakai harga & komisi terbaru/i }));
    expect(await screen.findByTestId('booking-pricing-adjustment-reason-input')).toBeTruthy();
  });

  it('E. InvoiceAdjustmentDialog, InvoiceDetailDrawer & ClientInvoiceDetailDrawer render adjustments transparently without Staff UID leakage', async () => {
    const portalInv = seedPortalInvoice(bookingAdapter, {
      bookingId: 'bkg_p3_ui',
      totalAmount: 300000,
    });

    // Pay 300,000 first so downward adjustment produces overpaid_credit_pending UI banner!
    await recordStaffCashPayment({
      transactionId: 'pay_p3_ui_1',
      invoiceId: portalInv.id,
      expectedVersion: 1,
      amount: 300000,
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });

    const user = userEvent.setup();
    const liveInvAfterPay = bookingAdapter._sharedStore.invoices.get(portalInv.id);

    // 1. Admin creates downward adjustment via InvoiceAdjustmentDialog UI
    const onSubmitAdj = vi.fn(async (payload) =>
      createInvoiceAdjustment({ ...payload, actorUid: 'staff-secret-uid', adapter: paymentAdapter }),
    );
    const { unmount: unmountAdjDlg } = render(
      <InvoiceAdjustmentDialog
        open
        invoice={liveInvAfterPay}
        onOpenChange={() => {}}
        onSubmitAdjustment={onSubmitAdj}
      />,
    );

    await user.click(screen.getByTestId('invoice-adjustment-direction-decrease'));
    await user.type(screen.getByTestId('invoice-adjustment-amount-input'), '100000');
    expect(await screen.findByTestId('invoice-adjustment-overpaid-warning')).toBeTruthy();
    await user.type(
      screen.getByTestId('invoice-adjustment-reason-input'),
      'Potongan kompensasi keterlambatan setup ruang',
    );
    await user.click(screen.getByRole('button', { name: /simpan penyesuaian/i }));
    await waitFor(() => expect(onSubmitAdj).toHaveBeenCalledTimes(1));
    unmountAdjDlg();

    // 2. Admin InvoiceDetailDrawer displays Adjustment History + Desk Cash / Overpaid banner
    const { unmount: unmountAdminDrawer } = render(
      <MemoryRouter>
        <InvoiceDetailDrawer
          invoiceId={portalInv.id}
          open
          onOpenChange={() => {}}
          onOpenAdjustment={() => {}}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('invoice-adjustments-section')).toBeTruthy();
    expect(screen.getByTestId('admin-invoice-overpaid-notice')).toBeTruthy();
    expect(screen.getByText(/potongan kompensasi keterlambatan setup ruang/i)).toBeTruthy();
    unmountAdminDrawer();

    // 3. ClientInvoiceDetailDrawer displays adjustment history & Overpaid warning WITHOUT exposing Staff UID!
    render(
      <AuthContext.Provider
        value={{
          status: 'authenticated',
          accountType: 'client',
          role: 'client',
          user: { uid: 'client-uid-a', email: 'nadia@gmail.com' },
          clientAccount: { uid: 'client-uid-a', role: 'client', status: 'active', customerId: 'cust_client_a' },
          clientProfile: { customerId: 'cust_client_a', displayName: 'Nadia Pratama' },
        }}
      >
        <ClientInvoiceDetailDrawer
          open
          onOpenChange={() => {}}
          invoiceId={portalInv.id}
          referenceDateIso="2026-12-05"
          customAdapter={clientBillingAdapter}
          customEvidenceAdapter={evidenceAdapter}
        />
      </AuthContext.Provider>,
    );

    const clientDrawer = await screen.findByTestId('client-invoice-detail-drawer');
    expect(await within(clientDrawer).findByTestId('client-invoice-overpaid-banner')).toBeTruthy();
    expect(await within(clientDrawer).findByTestId('client-invoice-adjustments-section')).toBeTruthy();
    expect(
      within(clientDrawer).getByText(/potongan kompensasi keterlambatan setup ruang/i),
    ).toBeTruthy();
    expect(clientDrawer.textContent).not.toContain('staff-secret-uid');
    expect(clientDrawer.textContent).not.toContain('staff-1');
  });
});
