import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const billingTestMocks = vi.hoisted(() => ({
  collectionCalls: [],
  docCalls: [],
  queryCalls: [],
  whereCalls: [],
  limitCalls: [],
  onSnapshotImpl: null,
}));

vi.mock('@/lib/firebase/firestore', () => ({
  getFirebaseDb: () => ({ _mockDb: true }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => {
    billingTestMocks.collectionCalls.push(name);
    return { _type: 'collection', name };
  },
  doc: (_db, col, id) => {
    billingTestMocks.docCalls.push({ col, id });
    return { _type: 'doc', col, id };
  },
  where: (field, op, value) => {
    const clause = { _constraint: 'where', field, op, value };
    billingTestMocks.whereCalls.push(clause);
    return clause;
  },
  limit: (n) => {
    const clause = { _constraint: 'limit', n };
    billingTestMocks.limitCalls.push(clause);
    return clause;
  },
  query: (target, ...constraints) => {
    const q = { _type: 'query', target, constraints };
    billingTestMocks.queryCalls.push(q);
    return q;
  },
  onSnapshot: (target, onNext, onError) => {
    if (typeof billingTestMocks.onSnapshotImpl === 'function') {
      return billingTestMocks.onSnapshotImpl(target, onNext, onError);
    }
    queueMicrotask(() => onNext({ docs: [], exists: () => false, data: () => null }));
    return () => {};
  },
}));

vi.mock('@/features/public-site-settings/hooks/usePublicSiteSettings', () => ({
  usePublicSiteSettings: () => ({
    settings: {
      studioName: '37 Music Studio',
      publicWhatsappNumber: '+62 812-8888-3737',
    },
    isLoading: false,
  }),
}));

import { createInMemoryBookingRepositoryAdapter } from '@/features/admin/calendar/services/calendar-booking-service';
import { createInMemoryPaymentRepositoryAdapter } from '@/features/admin/payment/repositories/payment-repository';
import { voidInvoice } from '@/features/admin/payment/services/invoice-service';
import {
  recordInvoicePayment,
  reversePaymentTransaction,
} from '@/features/admin/payment/services/payment-service';
import { buildInvoiceNumber } from '@/features/admin/payment/utils/invoice-number';
import { AuthContext } from '@/features/auth/AuthContext';

import { ClientInvoicesPage } from '../pages/ClientInvoicesPage';
import {
  createFirestoreClientBillingRepositoryAdapter,
  createInMemoryClientBillingRepositoryAdapter,
  resetClientBillingRepositoryAdapter,
  setClientBillingRepositoryAdapter,
} from './repositories/client-billing-repository';
import {
  buildClientInvoiceWhatsAppUrl,
  computeClientBillingMetrics,
  filterClientInvoices,
  formatClientRupiah,
  getClientInvoiceStatusDisplay,
  projectClientInvoiceRecord,
  projectClientPaymentTransactions,
  sortClientInvoices,
} from './utils/client-billing-utils';

function makeRawInvoice({
  bookingId = 'bkg_101',
  customerId = 'cust_client_a',
  invoiceStatus = 'issued',
  subtotal = 1400000,
  discountAmount = 150000,
  totalAmount = 1250000,
  amountPaid = 0,
  balanceDue = 1250000,
  paymentStatus = 'unpaid',
  bookingDate = '2026-11-24',
  dueDate = null,
  invoiceDate = '2026-11-24T09:00:00.000Z',
  serviceTypeName = 'Recording',
  serviceOptionName = 'Live Multitrack Package',
  studioId = 'room-a',
  customerName = 'Alya Pratama',
  bandName = 'Midnight Echo',
  phone = '+62 812-1111-2222',
  voidReason = '',
  version = 1,
} = {}) {
  const id = `inv_${bookingId}`;
  return {
    id,
    invoiceNumber: buildInvoiceNumber({ bookingId, bookingDate }),
    bookingId,
    customerId,
    invoiceStatus,
    currency: 'IDR',
    customerSnapshot: {
      name: customerName,
      phone,
      bandName,
    },
    bookingSnapshot: {
      serviceTypeName,
      serviceOptionName,
      studioId,
      bookingDate,
      startMinute: 600,
      endMinute: 780,
      durationMinutes: 180,
    },
    financialSnapshot: {
      subtotal,
      discountAmount,
      totalAmount,
    },
    amountPaid,
    balanceDue,
    paymentStatus,
    invoiceDate,
    dueDate,
    lastPaymentTransactionId: null,
    voidReason,
    createdAt: invoiceDate,
    createdByUid: 'staff-secret-uid-1',
    updatedAt: invoiceDate,
    updatedByUid: 'owner-secret-uid-1',
    version,
  };
}

function makeAuthContextValue({
  uid = 'uid_client_a',
  customerId = 'cust_client_a',
  status = 'active',
  accountType = 'client',
} = {}) {
  return {
    status: uid ? 'authenticated' : 'unauthenticated',
    accountType,
    role: accountType === 'client' ? 'client' : null,
    user: uid ? { uid, email: 'alya@gmail.com', displayName: 'Alya Pratama' } : null,
    clientAccount: uid
      ? {
          uid,
          role: 'client',
          status,
          customerId,
          displayName: 'Alya Pratama',
          emailNormalized: 'alya@gmail.com',
        }
      : null,
    clientProfile: uid
      ? {
          customerId,
          displayName: 'Alya Pratama',
          phoneDisplay: '+62 812-1111-2222',
        }
      : null,
  };
}

function renderInvoicesWorkspace({
  authValue = makeAuthContextValue(),
  now = new Date('2026-11-24T10:00:00+07:00'),
  customAdapter = null,
} = {}) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/portal/invoices']}>
        <ClientInvoicesPage now={now} customAdapter={customAdapter} />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Client Portal Phase 4 — Customer Billing & Payments', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    billingTestMocks.collectionCalls = [];
    billingTestMocks.docCalls = [];
    billingTestMocks.queryCalls = [];
    billingTestMocks.whereCalls = [];
    billingTestMocks.limitCalls = [];
    billingTestMocks.onSnapshotImpl = null;
  });

  afterEach(() => {
    cleanup();
    resetClientBillingRepositoryAdapter();
    document.body.removeAttribute('data-studio-print-mode');
    const portal = document.getElementById('studio-print-portal');
    if (portal) portal.remove();
  });

  describe('A. Unit Tests — Normalization, Privacy Allow-List, Status, Metrics, Search & Sorting', () => {
    it('normalizes customer-visible invoices, strips internal UIDs/voidReason, rejects draft invoices, and enforces IDR integer Rupiah formatting', () => {
      const issuedRaw = makeRawInvoice({
        bookingId: 'bkg_norm_1',
        subtotal: 1400000,
        discountAmount: 150000,
        totalAmount: 1250000,
        amountPaid: 250000,
        balanceDue: 1000000,
        paymentStatus: 'partial',
      });
      const projected = projectClientInvoiceRecord(issuedRaw.id, issuedRaw);

      expect(projected).toBeTruthy();
      expect(projected.currency).toBe('IDR');
      expect(projected.financialSnapshot.totalAmount).toBe(1250000);
      expect(projected.amountPaid).toBe(250000);
      expect(projected.balanceDue).toBe(1000000);
      expect(formatClientRupiah(projected.financialSnapshot.totalAmount)).toBe('Rp 1.250.000');
      expect(formatClientRupiah(projected.financialSnapshot.totalAmount)).not.toContain(',00');

      // Internal identifiers MUST be stripped from projected client object
      expect('customerId' in projected).toBe(false);
      expect('createdByUid' in projected).toBe(false);
      expect('updatedByUid' in projected).toBe(false);
      expect('lastPaymentTransactionId' in projected).toBe(false);
      expect('voidReason' in projected).toBe(false);

      // Draft invoices are strictly excluded
      const draftRaw = makeRawInvoice({ bookingId: 'bkg_draft_1', invoiceStatus: 'draft' });
      expect(projectClientInvoiceRecord(draftRaw.id, draftRaw)).toBeNull();

      // Void invoices remain readable as historical Cancelled statements
      const voidRaw = makeRawInvoice({
        bookingId: 'bkg_void_1',
        invoiceStatus: 'void',
        voidReason: 'Internal admin cancellation reason',
      });
      const projectedVoid = projectClientInvoiceRecord(voidRaw.id, voidRaw);
      expect(projectedVoid).toBeTruthy();
      expect(projectedVoid.invoiceStatus).toBe('void');
      expect('voidReason' in projectedVoid).toBe(false);
    });

    it('maps invoice statuses accurately and evaluates overdue strictly in Asia/Jakarta without marking null dueDate as overdue', () => {
      const refDateIso = '2026-11-24';

      const unpaidNoDue = projectClientInvoiceRecord(
        'inv_u1',
        makeRawInvoice({ bookingId: 'u1', dueDate: null, amountPaid: 0, balanceDue: 500000, subtotal: 500000, discountAmount: 0, totalAmount: 500000 }),
      );
      expect(getClientInvoiceStatusDisplay(unpaidNoDue, refDateIso).label).toBe('Unpaid');
      expect(getClientInvoiceStatusDisplay(unpaidNoDue, refDateIso).isOverdue).toBe(false);

      const dueTodayNotOverdue = projectClientInvoiceRecord(
        'inv_u2',
        makeRawInvoice({ bookingId: 'u2', dueDate: '2026-11-24', amountPaid: 0, balanceDue: 500000, subtotal: 500000, discountAmount: 0, totalAmount: 500000 }),
      );
      expect(getClientInvoiceStatusDisplay(dueTodayNotOverdue, refDateIso).label).toBe('Unpaid');

      const overdueInvoice = projectClientInvoiceRecord(
        'inv_ov1',
        makeRawInvoice({ bookingId: 'ov1', dueDate: '2026-11-23', amountPaid: 100000, balanceDue: 400000, paymentStatus: 'partial', subtotal: 500000, discountAmount: 0, totalAmount: 500000 }),
      );
      expect(getClientInvoiceStatusDisplay(overdueInvoice, refDateIso)).toMatchObject({
        filterKey: 'overdue',
        label: 'Overdue',
        isOverdue: true,
      });

      const partialInvoice = projectClientInvoiceRecord(
        'inv_p1',
        makeRawInvoice({ bookingId: 'p1', dueDate: '2026-11-30', amountPaid: 200000, balanceDue: 300000, paymentStatus: 'partial', subtotal: 500000, discountAmount: 0, totalAmount: 500000 }),
      );
      expect(getClientInvoiceStatusDisplay(partialInvoice, refDateIso).label).toBe(
        'Partial Payment',
      );

      const paidPastDue = projectClientInvoiceRecord(
        'inv_pd1',
        makeRawInvoice({ bookingId: 'pd1', dueDate: '2026-11-01', amountPaid: 500000, balanceDue: 0, paymentStatus: 'paid', subtotal: 500000, discountAmount: 0, totalAmount: 500000 }),
      );
      expect(getClientInvoiceStatusDisplay(paidPastDue, refDateIso).label).toBe('Paid');
      expect(getClientInvoiceStatusDisplay(paidPastDue, refDateIso).isOverdue).toBe(false);

      const voidPastDue = projectClientInvoiceRecord(
        'inv_v1',
        makeRawInvoice({ bookingId: 'v1', invoiceStatus: 'void', dueDate: '2026-11-01', amountPaid: 0, balanceDue: 500000, subtotal: 500000, discountAmount: 0, totalAmount: 500000 }),
      );
      expect(getClientInvoiceStatusDisplay(voidPastDue, refDateIso)).toMatchObject({
        filterKey: 'cancelled',
        label: 'Cancelled',
        isCancelled: true,
        isOverdue: false,
      });
    });

    it('aggregates Total Outstanding, Total Paid, Unpaid count, and Overdue count strictly from issued invoices (excluding void & draft)', () => {
      const refDateIso = '2026-11-24';
      const invoices = [
        // 1. Issued unpaid (no due date): balance 600k, paid 0
        projectClientInvoiceRecord(
          'inv_m1',
          makeRawInvoice({ bookingId: 'm1', subtotal: 600000, discountAmount: 0, totalAmount: 600000, amountPaid: 0, balanceDue: 600000, paymentStatus: 'unpaid', dueDate: null }),
        ),
        // 2. Issued partial & overdue: balance 450k, paid 300k
        projectClientInvoiceRecord(
          'inv_m2',
          makeRawInvoice({ bookingId: 'm2', subtotal: 750000, discountAmount: 0, totalAmount: 750000, amountPaid: 300000, balanceDue: 450000, paymentStatus: 'partial', dueDate: '2026-11-20' }),
        ),
        // 3. Issued paid: balance 0, paid 900k
        projectClientInvoiceRecord(
          'inv_m3',
          makeRawInvoice({ bookingId: 'm3', subtotal: 900000, discountAmount: 0, totalAmount: 900000, amountPaid: 900000, balanceDue: 0, paymentStatus: 'paid', dueDate: '2026-11-10' }),
        ),
        // 4. Void invoice: balance 500k on snapshot — MUST NOT count toward outstanding, paid, unpaid, or overdue
        projectClientInvoiceRecord(
          'inv_m4',
          makeRawInvoice({ bookingId: 'm4', invoiceStatus: 'void', subtotal: 500000, discountAmount: 0, totalAmount: 500000, amountPaid: 0, balanceDue: 500000, dueDate: '2026-11-01' }),
        ),
      ];

      const metrics = computeClientBillingMetrics(invoices, refDateIso);
      expect(metrics.totalOutstanding).toBe(1050000);
      expect(metrics.totalPaid).toBe(1200000);
      expect(metrics.unpaidCount).toBe(2);
      expect(metrics.overdueCount).toBe(1);
      expect(metrics.filterCounts).toEqual({
        all: 4,
        unpaid: 1,
        partial: 0, // m2 is classified as overdue in Asia/Jakarta
        paid: 1,
        overdue: 1,
        cancelled: 1,
      });
    });

    it('projects payment & reversal transactions with strict privacy allow-list and marks reversed entries without leaking staff notes or UIDs', () => {
      const { transactions, reversedTransactionIds } = projectClientPaymentTransactions([
        {
          id: 'pay_1',
          invoiceId: 'inv_1',
          invoiceNumber: '37MS-20261124-AAAAAAAAAAAA',
          bookingId: 'bkg_1',
          customerId: 'cust_client_a',
          transactionType: 'payment',
          amount: 500000,
          currency: 'IDR',
          paymentMethod: 'transfer',
          receivedAt: '2026-11-24T08:00:00.000Z',
          referenceNumber: 'TRF-001',
          notes: 'INTERNAL STAFF NOTE: verified manually by Budi',
          source: 'manual',
          reversalOfTransactionId: null,
          recordedByUid: 'staff-uid-secret',
          createdAt: '2026-11-24T08:00:00.000Z',
        },
        {
          id: 'pay_rev_pay_1',
          invoiceId: 'inv_1',
          invoiceNumber: '37MS-20261124-AAAAAAAAAAAA',
          bookingId: 'bkg_1',
          customerId: 'cust_client_a',
          transactionType: 'reversal',
          amount: 500000,
          currency: 'IDR',
          paymentMethod: 'transfer',
          receivedAt: '2026-11-24T09:00:00.000Z',
          referenceNumber: '',
          notes: 'INTERNAL REVERSAL AUDIT: wrong bank transfer matched',
          source: 'reversal',
          reversalOfTransactionId: 'pay_1',
          recordedByUid: 'owner-uid-secret',
          createdAt: '2026-11-24T09:00:00.000Z',
        },
      ]);

      expect(reversedTransactionIds.has('pay_1')).toBe(true);
      expect(transactions).toHaveLength(2);
      // Sorted newest first: reversal at 09:00 before original payment at 08:00
      expect(transactions[0]).toMatchObject({
        transactionType: 'reversal',
        transactionTypeLabel: 'Payment Correction',
        paymentMethodLabel: 'Bank Transfer',
        amount: 500000,
        currency: 'IDR',
      });
      expect(transactions[1]).toMatchObject({
        transactionType: 'payment',
        transactionTypeLabel: 'Payment Received',
        paymentMethodLabel: 'Bank Transfer',
        referenceNumber: 'TRF-001',
        isReversed: true,
      });

      for (const tx of transactions) {
        expect('notes' in tx).toBe(false);
        expect('recordedByUid' in tx).toBe(false);
        expect('customerId' in tx).toBe(false);
        expect('source' in tx).toBe(false);
        expect('reversalOfTransactionId' in tx).toBe(false);
      }
    });

    it('sorts heterogeneous timestamp types newest-first, filters locally by status & search, and builds dynamic WhatsApp URLs', () => {
      const olderDateObj = projectClientInvoiceRecord(
        'inv_old',
        makeRawInvoice({
          bookingId: 'BKG-OLD-01',
          serviceTypeName: 'Rehearsal',
          serviceOptionName: 'Paket 2 Jam',
          invoiceDate: new Date('2026-11-10T10:00:00Z'),
        }),
      );
      const middleSecondsObj = projectClientInvoiceRecord(
        'inv_mid',
        makeRawInvoice({
          bookingId: 'BKG-MID-02',
          serviceTypeName: 'Recording',
          serviceOptionName: 'Vocal Tracking',
          invoiceDate: { seconds: Math.floor(new Date('2026-11-18T10:00:00Z').getTime() / 1000) },
          amountPaid: 1250000,
          balanceDue: 0,
          paymentStatus: 'paid',
        }),
      );
      const newestFirestoreTs = projectClientInvoiceRecord(
        'inv_new',
        makeRawInvoice({
          bookingId: 'BKG-NEW-03',
          serviceTypeName: 'Mix & Master',
          serviceOptionName: 'Single Track Mix',
          invoiceDate: { toMillis: () => new Date('2026-11-24T11:00:00Z').getTime() },
        }),
      );

      const sorted = sortClientInvoices([olderDateObj, newestFirestoreTs, middleSecondsObj]);
      expect(sorted.map((i) => i.id)).toEqual(['inv_new', 'inv_mid', 'inv_old']);

      expect(
        filterClientInvoices({ invoices: sorted, statusFilter: 'paid', referenceDateIso: '2026-11-24' }).map(
          (i) => i.id,
        ),
      ).toEqual(['inv_mid']);

      expect(
        filterClientInvoices({
          invoices: sorted,
          statusFilter: 'all',
          searchQuery: 'vocal tracking',
          referenceDateIso: '2026-11-24',
        }).map((i) => i.id),
      ).toEqual(['inv_mid']);

      expect(
        filterClientInvoices({
          invoices: sorted,
          statusFilter: 'all',
          searchQuery: 'bkg-old-01',
          referenceDateIso: '2026-11-24',
        }).map((i) => i.id),
      ).toEqual(['inv_old']);

      const waUrl = buildClientInvoiceWhatsAppUrl({
        publicWhatsappNumber: '+62 812-8888-3737',
        studioName: '37 Music Studio',
        invoiceNumber: '37MS-20261124-ABC123DEF456',
      });
      expect(waUrl).toContain('https://wa.me/6281288883737?text=');
      expect(decodeURIComponent(waUrl.split('text=')[1])).toBe(
        'Halo 37 Music Studio, saya ingin konfirmasi pembayaran untuk invoice 37MS-20261124-ABC123DEF456.',
      );
    });
  });

  describe('B. Repository, Realtime Hooks, Session Isolation & Workspace UI Integration', () => {
    it('never issues global/unscoped Firestore queries and enforces customerId + visible status constraints', async () => {
      const unsubSpy = vi.fn();
      billingTestMocks.onSnapshotImpl = (_target, onNext) => {
        queueMicrotask(() => onNext({ docs: [] }));
        return unsubSpy;
      };

      const fsAdapter = createFirestoreClientBillingRepositoryAdapter();

      // Missing customerId must NOT call Firestore collection/query
      const missingCustomerErr = vi.fn();
      fsAdapter.subscribeClientInvoices({ customerId: '', onData: vi.fn(), onError: missingCustomerErr });
      await waitFor(() => expect(missingCustomerErr).toHaveBeenCalledTimes(1));
      expect(billingTestMocks.collectionCalls).toHaveLength(0);

      // Valid invoice subscription must bind customerId == X AND invoiceStatus in ['issued', 'void']
      const unsubInv = fsAdapter.subscribeClientInvoices({
        customerId: 'cust_client_a',
        maxLimit: 100,
        onData: vi.fn(),
        onError: vi.fn(),
      });
      await waitFor(() => expect(billingTestMocks.queryCalls).toHaveLength(1));
      expect(billingTestMocks.whereCalls).toEqual([
        { _constraint: 'where', field: 'customerId', op: '==', value: 'cust_client_a' },
        { _constraint: 'where', field: 'invoiceStatus', op: 'in', value: ['issued', 'void'] },
      ]);
      unsubInv();
      expect(unsubSpy).toHaveBeenCalledTimes(1);

      // Valid transaction subscription must bind customerId == X AND invoiceId == Y
      billingTestMocks.whereCalls = [];
      const unsubTx = fsAdapter.subscribeClientPaymentTransactions({
        customerId: 'cust_client_a',
        invoiceId: 'inv_bkg_101',
        maxLimit: 200,
        onData: vi.fn(),
        onError: vi.fn(),
      });
      await waitFor(() => expect(billingTestMocks.whereCalls).toHaveLength(2));
      expect(billingTestMocks.whereCalls).toEqual([
        { _constraint: 'where', field: 'customerId', op: '==', value: 'cust_client_a' },
        { _constraint: 'where', field: 'invoiceId', op: '==', value: 'inv_bkg_101' },
      ]);
      unsubTx();
    });

    it('blocks subscriptions when customerId is missing or client is suspended, and isolates state immediately on auth UID switch', async () => {
      const invClientA = makeRawInvoice({
        bookingId: 'bkg_iso_a',
        customerId: 'cust_client_a',
        serviceTypeName: 'Recording Alpha',
        subtotal: 800000,
        discountAmount: 0,
        totalAmount: 800000,
        balanceDue: 800000,
      });
      const invClientB = makeRawInvoice({
        bookingId: 'bkg_iso_b',
        customerId: 'cust_client_b',
        serviceTypeName: 'Rehearsal Bravo',
        subtotal: 450000,
        discountAmount: 0,
        totalAmount: 450000,
        balanceDue: 450000,
      });

      const clientBillingAdapter = createInMemoryClientBillingRepositoryAdapter({
        initialInvoices: [invClientA, invClientB],
      });
      setClientBillingRepositoryAdapter(clientBillingAdapter);

      // 1. Suspended client sees zero data
      const { rerender } = render(
        <AuthContext.Provider
          value={makeAuthContextValue({
            uid: 'uid_client_a',
            customerId: 'cust_client_a',
            status: 'suspended',
          })}
        >
          <MemoryRouter initialEntries={['/portal/invoices']}>
            <ClientInvoicesPage now={new Date('2026-11-24T10:00:00+07:00')} />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      expect(screen.queryByText(invClientA.invoiceNumber)).toBeNull();
      expect(screen.queryByText(invClientB.invoiceNumber)).toBeNull();

      // 2. Active Client A sees ONLY Client A's invoice
      rerender(
        <AuthContext.Provider
          value={makeAuthContextValue({
            uid: 'uid_client_a',
            customerId: 'cust_client_a',
            status: 'active',
          })}
        >
          <MemoryRouter initialEntries={['/portal/invoices']}>
            <ClientInvoicesPage now={new Date('2026-11-24T10:00:00+07:00')} />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      expect((await screen.findAllByText(invClientA.invoiceNumber)).length).toBeGreaterThan(0);
      expect(screen.queryByText(invClientB.invoiceNumber)).toBeNull();

      // 3. Switching authenticated session to Client B immediately clears Client A and renders Client B
      rerender(
        <AuthContext.Provider
          value={makeAuthContextValue({
            uid: 'uid_client_b',
            customerId: 'cust_client_b',
            status: 'active',
          })}
        >
          <MemoryRouter initialEntries={['/portal/invoices']}>
            <ClientInvoicesPage now={new Date('2026-11-24T10:00:00+07:00')} />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      expect((await screen.findAllByText(invClientB.invoiceNumber)).length).toBeGreaterThan(0);
      expect(screen.queryByText(invClientA.invoiceNumber)).toBeNull();
    });

    it('handles error state, retry recovery, empty state, and live realtime updates when Admin records payments, reversals, or voids invoices', async () => {
      const user = userEvent.setup();
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

      const bookingAdapter = createInMemoryBookingRepositoryAdapter();
      const adminPaymentAdapter = createInMemoryPaymentRepositoryAdapter(bookingAdapter);
      const clientBillingAdapter = createInMemoryClientBillingRepositoryAdapter({
        bookingAdapter,
      });
      setClientBillingRepositoryAdapter(clientBillingAdapter);

      // Simulate transient Firestore error -> Retry recovers to clean empty state
      clientBillingAdapter._setSimulatedError({ code: 'unavailable', message: 'Network down' });
      renderInvoicesWorkspace();

      expect(await screen.findByTestId('client-billing-overview-error')).toBeTruthy();
      expect(screen.getByTestId('client-billing-error-state')).toBeTruthy();

      clientBillingAdapter._setSimulatedError(null);
      await user.click(
        within(screen.getByTestId('client-billing-error-state')).getByRole('button', {
          name: /try again/i,
        }),
      );
      expect(await screen.findByTestId('client-billing-empty-state')).toBeTruthy();
      expect(screen.getByText('No studio invoices yet')).toBeTruthy();

      // Seed active issued invoice + void invoice + draft invoice (draft must stay invisible!)
      const activeInvoice = makeRawInvoice({
        bookingId: 'bkg_live_1',
        customerId: 'cust_client_a',
        subtotal: 1400000,
        discountAmount: 150000,
        totalAmount: 1250000,
        amountPaid: 0,
        balanceDue: 1250000,
        paymentStatus: 'unpaid',
        dueDate: '2026-11-20', // Overdue relative to 2026-11-24
      });
      const voidedTarget = makeRawInvoice({
        bookingId: 'bkg_live_void',
        customerId: 'cust_client_a',
        subtotal: 400000,
        discountAmount: 0,
        totalAmount: 400000,
        amountPaid: 0,
        balanceDue: 400000,
        paymentStatus: 'unpaid',
      });
      const hiddenDraft = makeRawInvoice({
        bookingId: 'bkg_live_draft',
        customerId: 'cust_client_a',
        invoiceStatus: 'draft',
        subtotal: 999000,
        discountAmount: 0,
        totalAmount: 999000,
        balanceDue: 999000,
      });

      await act(async () => {
        clientBillingAdapter._seedInvoice(activeInvoice);
        clientBillingAdapter._seedInvoice(voidedTarget);
        clientBillingAdapter._seedInvoice(hiddenDraft);
        await voidInvoice({
          invoiceId: voidedTarget.id,
          expectedVersion: 1,
          reason: 'Cancelled before session',
          actorUid: 'staff-secret-uid-1',
          adapter: adminPaymentAdapter,
        });
      });

      // Draft invoice MUST NEVER appear
      expect((await screen.findAllByText(activeInvoice.invoiceNumber)).length).toBeGreaterThan(0);
      expect(screen.getAllByText(voidedTarget.invoiceNumber).length).toBeGreaterThan(0);
      expect(screen.queryByText(hiddenDraft.invoiceNumber)).toBeNull();

      // Interactive status filter tabs & local search + Clear Search & Filters
      await user.click(screen.getByRole('tab', { name: /cancelled/i }));
      expect(screen.getAllByText(voidedTarget.invoiceNumber).length).toBeGreaterThan(0);
      expect(screen.queryByText(activeInvoice.invoiceNumber)).toBeNull();

      await user.click(screen.getByRole('tab', { name: /^all/i }));
      const searchInput = screen.getByRole('searchbox', {
        name: /search invoices by invoice number, booking reference, or service/i,
      });
      await user.type(searchInput, 'NON-EXISTENT-QUERY-XYZ');
      expect(await screen.findByText('No matching invoices found')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /clear search & filters/i }));
      expect((await screen.findAllByText(activeInvoice.invoiceNumber)).length).toBeGreaterThan(0);

      // Overview reflects only issued invoice (Rp 1.250.000 outstanding, 1 unpaid, 1 overdue)
      const overview = screen.getByTestId('client-billing-overview');
      expect(within(overview).getByText('Rp 1.250.000')).toBeTruthy();
      expect(within(overview).getByText('Rp 0')).toBeTruthy();

      // Strictly NO online payment gateway / Pay Now buttons anywhere
      expect(screen.queryByRole('button', { name: /pay now/i })).toBeNull();

      // Open Invoice Detail Drawer
      await user.click(
        screen.getAllByRole('button', {
          name: new RegExp(`view details for invoice ${activeInvoice.invoiceNumber}`, 'i'),
        })[0],
      );

      const drawer = await screen.findByTestId('client-invoice-detail-drawer');
      expect(within(drawer).getByText('Midnight Echo')).toBeTruthy();
      expect(within(drawer).getByText('Live Multitrack Package')).toBeTruthy();
      expect(within(drawer).getByText('Rp 1.400.000')).toBeTruthy();
      expect(within(drawer).getByText('- Rp 150.000')).toBeTruthy();
      expect(within(drawer).getByText('No payment records yet')).toBeTruthy();
      expect(
        within(drawer).getByText('Payment is recorded and verified by the studio team.'),
      ).toBeTruthy();

      const contactCta = within(drawer).getByTestId('client-invoice-contact-studio-cta');
      expect(decodeURIComponent(contactCta.getAttribute('href'))).toContain(
        `Halo 37 Music Studio, saya ingin konfirmasi pembayaran untuk invoice ${activeInvoice.invoiceNumber}.`,
      );

      // REALTIME UPDATE 1: Staff records Rp 500.000 partial payment in Admin Billing
      await act(async () => {
        await recordInvoicePayment({
          transactionId: 'pay_live_500k',
          invoiceId: activeInvoice.id,
          expectedVersion: 1,
          amount: 500000,
          paymentMethod: 'qris',
          receivedDate: '2026-11-24',
          referenceNumber: 'QRIS-998877',
          notes: 'CONFIDENTIAL STAFF NOTE DO NOT LEAK',
          actorUid: 'staff-secret-uid-99',
          adapter: adminPaymentAdapter,
        });
      });

      // Without reload, Overview + Detail Drawer + Payment Timeline update live!
      await waitFor(() => {
        expect(within(overview).getByText('Rp 750.000')).toBeTruthy();
        expect(within(overview).getByText('Rp 500.000')).toBeTruthy();
      });
      expect(await within(drawer).findByText('Payment Received')).toBeTruthy();
      expect(within(drawer).getByText('QRIS')).toBeTruthy();
      expect(within(drawer).getByText(/QRIS-998877/)).toBeTruthy();

      // Verify zero internal fields or staff notes leaked in DOM
      expect(document.body.textContent).not.toContain('CONFIDENTIAL STAFF NOTE DO NOT LEAK');
      expect(document.body.textContent).not.toContain('staff-secret-uid-99');
      expect(document.body.textContent).not.toContain('cust_client_a');
      expect(document.body.textContent).not.toContain('uid_client_a');
      expect(document.body.textContent).not.toContain('Cancelled before session');

      // REALTIME UPDATE 2: Staff reverses payment -> balance & timeline update without double-counting
      await act(async () => {
        await reversePaymentTransaction({
          invoiceId: activeInvoice.id,
          originalTransactionId: 'pay_live_500k',
          expectedVersion: 2,
          reason: 'SECRET REVERSAL REASON INTERNAL',
          actorUid: 'owner-secret-uid-1',
          adapter: adminPaymentAdapter,
        });
      });

      await waitFor(() => {
        expect(within(overview).getByText('Rp 1.250.000')).toBeTruthy();
        expect(within(overview).getByText('Rp 0')).toBeTruthy();
      });
      expect(await within(drawer).findByText('Payment Correction')).toBeTruthy();
      expect(within(drawer).getByText('Corrected')).toBeTruthy();
      expect(document.body.textContent).not.toContain('SECRET REVERSAL REASON INTERNAL');

      // Print Invoice triggers window.print() with clean customer-safe #studio-print-portal
      await user.click(
        within(drawer).getByRole('button', { name: /download \/ print invoice/i }),
      );
      await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

      const printPortal = document.getElementById('studio-print-portal');
      expect(printPortal).toBeTruthy();
      expect(printPortal.textContent).toContain('37 Music Studio');
      expect(printPortal.textContent).toContain(activeInvoice.invoiceNumber);
      expect(printPortal.textContent).not.toContain('NPWP');
      expect(printPortal.textContent).not.toContain('CONFIDENTIAL STAFF NOTE');

      printSpy.mockRestore();
    });
  });
});
