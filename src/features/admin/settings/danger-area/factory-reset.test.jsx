import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '@/App';
import {
  createInMemoryBookingRequestRepositoryAdapter,
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from '@/features/admin/booking-requests/repositories/booking-request-repository';
import { AuthContext } from '@/features/auth/AuthContext';
import {
  createInMemoryPublicSiteSettingsAdapter,
  resetPublicSiteSettingsRepositoryAdapter,
  setPublicSiteSettingsRepositoryAdapter,
} from '@/features/public-site-settings/repositories/public-site-settings-repository';

import {
  FACTORY_RESET_BATCH_SIZE,
  FACTORY_RESET_CONFIRMATION_PHRASE,
  FACTORY_RESET_DELETION_MANIFEST,
  FACTORY_RESET_REAUTH_WINDOW_MS,
  FACTORY_RESET_STATUS,
} from './config/factory-reset-config';
import {
  createInMemoryFactoryResetRepositoryAdapter,
  resetFactoryResetRepositoryAdapter,
  setFactoryResetRepositoryAdapter,
} from './repositories/factory-reset-repository';
import { reauthenticateOwnerForFactoryReset } from './services/factory-reset-auth-service';
import {
  cancelFactoryResetBeforeDeletion,
  previewFactoryReset,
  resumeFactoryReset,
  startFactoryReset,
} from './services/factory-reset-service';
import { validateStartFactoryResetInput } from './utils/factory-reset-validation';

function buildActor({
  uid = 'owner-1',
  role = 'owner',
  active = true,
  email = 'owner@37music.id',
} = {}) {
  return {
    uid,
    role,
    active,
    user: uid ? { uid, email, displayName: 'Studio Owner' } : null,
    profile: uid
      ? {
          uid,
          email,
          displayName: role === 'owner' ? 'Studio Owner' : 'Studio Staff',
          role,
          active,
        }
      : null,
  };
}

function buildAuthContextValue({
  uid = 'owner-1',
  role = 'owner',
  active = true,
  email = 'owner@37music.id',
  lastReauthenticatedAt = null,
  reauthenticate = vi.fn(async () => ({
    user: { uid, email },
    profile: { uid, email, role, active },
    reauthenticatedAt: Date.now(),
  })),
} = {}) {
  return {
    user: uid ? { uid, email, displayName: 'Studio User' } : null,
    profile: uid ? { uid, email, displayName: 'Studio User', role, active } : null,
    status: 'authenticated',
    role,
    authError: '',
    lastReauthenticatedAt,
    login: vi.fn(),
    logout: vi.fn(),
    reauthenticate,
    resetPassword: vi.fn(),
    clearAuthError: vi.fn(),
  };
}

function createFullOperationalSeed({ bookingsCount = 14, withInvoiceAdjustment = true } = {}) {
  const bookings = Array.from({ length: bookingsCount }, (_, idx) => ({
    id: `bkg_${String(idx + 1).padStart(3, '0')}`,
    customerName: `Band ${idx + 1}`,
  }));

  return {
    initialCollections: {
      publicBookingRequests: [
        { id: 'req_001', customerName: 'Req One' },
        { id: 'req_002', customerName: 'Req Two' },
      ],
      bookingEvents: [{ id: 'evt_001' }],
      bookingSlots: [{ id: '2026-11-22__room-a__600' }, { id: '2026-11-22__room-a__660' }],
      publicAvailability: [{ id: 'bkg_001' }],
      clientReservations: [],
      paymentEvidenceLocks: [{ id: 'inv_001' }],
      paymentEvidence: [{ id: 'ev_001' }],
      paymentTransactions: [{ id: 'pay_001' }],
      invoices: [{ id: 'inv_001' }],
      refundCases: [{ id: 'ref_001' }],
      commissionReviewResolutions: [{ id: 'res_001' }],
      commissionPostingItems: [{ id: 'cpi_001' }],
      commissionBatches: [{ id: 'cb_001' }],
      bookkeepingSettlements: [{ id: 'set_001' }],
      bookkeepingEntries: [{ id: 'bke_001' }],
      inventoryMovements: [{ id: 'mov_001' }],
      inventoryItems: [{ id: 'inv_item_001' }],
      customerPhoneIndex: [{ id: 'hash_001' }],
      customerEmailIndex: [],
      clientCustomerLinks: [],
      clientProfiles: [],
      customers: [{ id: 'cust_001' }],
      bookings,
    },
    initialRequestSubcollections: {
      req_001: {
        communications: [{ id: 'comm_001' }, { id: 'comm_002' }],
        activities: [{ id: 'act_001' }],
        offers: [{ id: 'off_001' }],
      },
      req_002: {
        communications: [{ id: 'comm_003' }],
        activities: [{ id: 'act_002' }, { id: 'act_003' }],
        offers: [],
      },
    },
    initialInvoiceSubcollections: withInvoiceAdjustment
      ? {
          inv_001: {
            adjustments: [{ id: 'adj_000000000000000000000001' }],
          },
        }
      : {},
    initialPreserved: {
      staffProfiles: [
        { id: 'owner-1', role: 'owner', active: true },
        { id: 'staff-1', role: 'staff', active: true },
      ],
      settings: [
        { id: 'studioProfile', studioName: '37 Music Studio' },
        { id: 'pricing', version: 2 },
        { id: 'bookingPolicies', version: 1 },
      ],
      bookkeepingSettings: [{ id: 'default', initialBalance: 5000000 }],
      publicSiteSettings: [{ id: 'site', heroTitle: '37 Music Studio' }],
      bookingRequestMessageTemplates: [{ id: 'tpl_confirm', title: 'Confirm' }],
      galleryItems: [{ id: 'gal_001', url: 'https://res.cloudinary.com/demo/image/upload/a.jpg' }],
      landingPagePlacements: [{ id: 'room-a', galleryItemId: 'gal_001' }],
    },
  };
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  setPublicSiteSettingsRepositoryAdapter(createInMemoryPublicSiteSettingsAdapter(null));
  setBookingRequestRepositoryAdapter(createInMemoryBookingRequestRepositoryAdapter(null, []));
});

afterEach(() => {
  cleanup();
  resetFactoryResetRepositoryAdapter();
  resetPublicSiteSettingsRepositoryAdapter();
  resetBookingRequestRepositoryAdapter();
});

describe('Danger Area & Operational Factory Reset Engine', () => {
  it('1. Dry Run Preview accurately counts all 29 operational targets without mutating anything and blocks incomplete preflight', async () => {
    const adapter = createInMemoryFactoryResetRepositoryAdapter(
      createFullOperationalSeed({ bookingsCount: 14 }),
    );
    const owner = buildActor({ role: 'owner' });

    const preflight = await previewFactoryReset({ actor: owner, adapter });
    expect(preflight.isComplete).toBe(true);
    expect(preflight.items).toHaveLength(29);
    expect(preflight.topLevelDocumentCount).toBe(34);
    expect(preflight.subcollectionDocumentCount).toBe(8);
    expect(preflight.totalDeleteOperations).toBe(42);

    const byKey = Object.fromEntries(preflight.items.map((item) => [item.key, item.count]));
    expect(byKey.publicBookingRequests_communications).toBe(3);
    expect(byKey.publicBookingRequests_activities).toBe(3);
    expect(byKey.publicBookingRequests_offers).toBe(1);
    expect(byKey.invoices_adjustments).toBe(1);
    expect(byKey.paymentEvidenceLocks).toBe(1);
    expect(byKey.refundCases).toBe(1);
    expect(byKey.publicBookingRequests).toBe(2);
    expect(byKey.bookings).toBe(14);
    expect(adapter._inspectState().committedDeleteBatchesCount).toBe(0);
    expect(adapter._inspectState().operation).toBeNull();

    // Fail count on bookings -> preflight incomplete & blocks execution
    adapter._setFailCountForTarget('bookings');
    const brokenPreflight = await previewFactoryReset({ actor: owner, adapter });
    expect(brokenPreflight.isComplete).toBe(false);
    expect(brokenPreflight.failedTargets.map((t) => t.key)).toContain('bookings');

    await expect(
      startFactoryReset({
        actor: owner,
        preflight: brokenPreflight,
        confirmationPhrase: FACTORY_RESET_CONFIRMATION_PHRASE,
        acknowledged: true,
        reauthenticatedAt: Date.now(),
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'factory-reset/incomplete-preflight' });
  });

  it('2. Owner Authorization rejects Staff, inactive Owner, and unauthenticated sessions across all service actions', async () => {
    const adapter = createInMemoryFactoryResetRepositoryAdapter(
      createFullOperationalSeed({ bookingsCount: 2 }),
    );
    const owner = buildActor({ role: 'owner' });
    const validPreflight = await previewFactoryReset({ actor: owner, adapter });

    const unauthorizedActors = [
      buildActor({ uid: 'staff-1', role: 'staff', active: true }),
      buildActor({ uid: 'owner-inactive', role: 'owner', active: false }),
      buildActor({ uid: '', role: '', active: false }),
    ];

    for (const actor of unauthorizedActors) {
      await expect(previewFactoryReset({ actor, adapter })).rejects.toMatchObject({
        code: 'factory-reset/owner-required',
      });
      await expect(
        startFactoryReset({
          actor,
          preflight: validPreflight,
          confirmationPhrase: FACTORY_RESET_CONFIRMATION_PHRASE,
          acknowledged: true,
          reauthenticatedAt: Date.now(),
          adapter,
        }),
      ).rejects.toMatchObject({ code: 'factory-reset/owner-required' });
      await expect(
        resumeFactoryReset({
          actor,
          reauthenticatedAt: Date.now(),
          adapter,
        }),
      ).rejects.toMatchObject({ code: 'factory-reset/owner-required' });
      await expect(cancelFactoryResetBeforeDeletion({ actor, adapter })).rejects.toMatchObject({
        code: 'factory-reset/owner-required',
      });
    }

    expect(adapter._inspectState().committedDeleteBatchesCount).toBe(0);
    expect(adapter._inspectState().operationalCounts.bookings).toBe(2);
  });

  it('3. Password Re-Authentication rejects missing, wrong, and expired credentials and never persists raw passwords', async () => {
    const adapter = createInMemoryFactoryResetRepositoryAdapter(
      createFullOperationalSeed({ bookingsCount: 2 }),
    );
    const owner = buildActor({ role: 'owner' });
    const preflight = await previewFactoryReset({ actor: owner, adapter });

    const wrongErr = new Error('Password salah');
    wrongErr.code = 'auth/wrong-password';
    const reauthenticate = vi.fn().mockRejectedValueOnce(wrongErr).mockResolvedValueOnce({
      user: owner.user,
      profile: owner.profile,
      reauthenticatedAt: 1_700_000_000_000,
    });

    await expect(
      reauthenticateOwnerForFactoryReset({ actor: owner, password: '', reauthenticate }),
    ).rejects.toMatchObject({ code: 'auth/missing-password' });

    await expect(
      reauthenticateOwnerForFactoryReset({
        actor: owner,
        password: 'WrongPassword!123',
        reauthenticate,
      }),
    ).rejects.toMatchObject({ code: 'auth/wrong-password' });

    const reauthTs = await reauthenticateOwnerForFactoryReset({
      actor: owner,
      password: 'SecretOwnerPassword!37',
      reauthenticate,
    });
    expect(reauthTs).toBe(1_700_000_000_000);

    // Expired reauthentication window rejected strictly
    await expect(
      startFactoryReset({
        actor: owner,
        preflight,
        confirmationPhrase: FACTORY_RESET_CONFIRMATION_PHRASE,
        acknowledged: true,
        reauthenticatedAt: Date.now() - FACTORY_RESET_REAUTH_WINDOW_MS - 1000,
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'factory-reset/reauth-required' });

    await expect(
      resumeFactoryReset({
        actor: owner,
        reauthenticatedAt: null,
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'factory-reset/reauth-required' });

    const result = await startFactoryReset({
      actor: owner,
      preflight,
      confirmationPhrase: FACTORY_RESET_CONFIRMATION_PHRASE,
      acknowledged: true,
      reauthenticatedAt: reauthTs,
      adapter,
      now: new Date(reauthTs + 5000),
    });

    expect(result.status).toBe(FACTORY_RESET_STATUS.COMPLETED);
    expect(JSON.stringify(adapter._inspectState().operation)).not.toContain(
      'SecretOwnerPassword!37',
    );
  });

  it('4. Confirmation validation rejects bad phrase or missing checkbox', async () => {
    const adapter = createInMemoryFactoryResetRepositoryAdapter(
      createFullOperationalSeed({ bookingsCount: 1 }),
    );
    const owner = buildActor({ role: 'owner' });
    const preflight = await previewFactoryReset({ actor: owner, adapter });

    expect(
      validateStartFactoryResetInput({
        preflight,
        confirmationPhrase: 'reset 37 music studio',
        acknowledged: true,
      }),
    ).toMatchObject({
      isValid: false,
      code: 'factory-reset/invalid-confirmation-phrase',
    });

    expect(
      validateStartFactoryResetInput({
        preflight,
        confirmationPhrase: FACTORY_RESET_CONFIRMATION_PHRASE,
        acknowledged: false,
      }),
    ).toMatchObject({
      isValid: false,
      code: 'factory-reset/acknowledgment-required',
    });
  });

  it('5a. Deletion engine enforces <=10 batch limit, deletes subcollections before parent requests, empties all 21 targets, reinitializes availability, and preserves config/assets', async () => {
    const adapter = createInMemoryFactoryResetRepositoryAdapter(
      createFullOperationalSeed({ bookingsCount: 25 }),
    );
    const owner = buildActor({ role: 'owner' });
    const preflight = await previewFactoryReset({ actor: owner, adapter });

    const progressUpdates = [];
    const fixedNow = new Date('2026-11-22T05:00:00.000Z');
    const result = await startFactoryReset({
      actor: owner,
      preflight,
      confirmationPhrase: '  RESET   37   MUSIC  STUDIO  ',
      acknowledged: true,
      reauthenticatedAt: fixedNow.getTime(),
      adapter,
      onProgress: (op) => progressUpdates.push(op),
      now: fixedNow,
    });

    expect(result.status).toBe(FACTORY_RESET_STATUS.COMPLETED);
    expect(result.totalDeletedCount).toBe(53);
    expect(result.verificationSummary).toEqual({
      allZero: true,
      checkedCollectionsCount: 29,
      remainingTotal: 0,
    });

    const state = adapter._inspectState();
    expect(Math.max(...state.batchSizesLog)).toBeLessThanOrEqual(FACTORY_RESET_BATCH_SIZE);
    for (const step of FACTORY_RESET_DELETION_MANIFEST.filter((s) => s.kind === 'collection')) {
      expect(state.operationalCounts[step.collection]).toBe(0);
    }
    expect(state.communicationsCount).toBe(0);
    expect(state.activitiesCount).toBe(0);
    expect(state.offersCount).toBe(0);
    expect(state.adjustmentsCount).toBe(0);

    // Subcollections must complete before parent requests and parent invoices
    const commIdx = result.completedCollections.indexOf('publicBookingRequests_communications');
    const actIdx = result.completedCollections.indexOf('publicBookingRequests_activities');
    const offerIdx = result.completedCollections.indexOf('publicBookingRequests_offers');
    const parentIdx = result.completedCollections.indexOf('publicBookingRequests');
    const adjIdx = result.completedCollections.indexOf('invoices_adjustments');
    const invIdx = result.completedCollections.indexOf('invoices');
    expect(commIdx).toBeGreaterThanOrEqual(0);
    expect(actIdx).toBeGreaterThanOrEqual(0);
    expect(offerIdx).toBeGreaterThanOrEqual(0);
    expect(parentIdx).toBeGreaterThan(commIdx);
    expect(parentIdx).toBeGreaterThan(actIdx);
    expect(parentIdx).toBeGreaterThan(offerIdx);
    expect(adjIdx).toBeGreaterThanOrEqual(0);
    expect(invIdx).toBeGreaterThan(adjIdx);

    // Preserved collections untouched (including Customer Reviews & Public Review Stats)
    expect(state.preservedCounts).toEqual({
      staffProfiles: 2,
      settings: 3,
      bookkeepingSettings: 1,
      publicSiteSettings: 1,
      bookingRequestMessageTemplates: 1,
      galleryItems: 1,
      landingPagePlacements: 1,
      customerReviews: 0,
      publicReviewStats: 0,
    });

    // Public availability metadata reinitialized to empty ready state in Jakarta date
    expect(state.publicAvailabilityMetadataState).toMatchObject({
      isReady: true,
      backfilledFromDate: '2026-11-22',
    });
    expect(progressUpdates.length).toBeGreaterThan(5);
  });

  it('5b. Batch failure persists cursor & counts monotonically, blocks unsafe cancel after deletion, and resumes cleanly with immutable operationId', async () => {
    const adapter = createInMemoryFactoryResetRepositoryAdapter(
      createFullOperationalSeed({ bookingsCount: 15 }),
    );
    // Batches 0..23 clean up earlier collections & subcollections, batch 24 deletes bkg_001..bkg_010; fail on batch 25
    adapter._setFailDeleteAtBatch(25);

    const owner = buildActor({ role: 'owner' });
    const preflight = await previewFactoryReset({ actor: owner, adapter });

    await expect(
      startFactoryReset({
        actor: owner,
        preflight,
        confirmationPhrase: FACTORY_RESET_CONFIRMATION_PHRASE,
        acknowledged: true,
        reauthenticatedAt: Date.now(),
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });

    const failedOp = adapter._inspectState().operation;
    expect(failedOp.status).toBe(FACTORY_RESET_STATUS.FAILED);
    expect(failedOp.totalDeletedCount).toBeGreaterThan(0);
    expect(failedOp.currentCollection).toBe('bookings');
    expect(failedOp.lastProcessedDocumentId).toBe('bkg_010');

    // Cannot cancel once deletion has started
    await expect(cancelFactoryResetBeforeDeletion({ actor: owner, adapter })).rejects.toMatchObject(
      { code: 'factory-reset/cannot-cancel-after-deletion' },
    );

    // Resume from persisted cursor without changing operationId
    adapter._setFailDeleteAtBatch(-1);
    const resumed = await resumeFactoryReset({
      actor: owner,
      reauthenticatedAt: Date.now(),
      adapter,
    });

    expect(resumed.status).toBe(FACTORY_RESET_STATUS.COMPLETED);
    expect(resumed.operationId).toBe(failedOp.operationId);
    expect(adapter._inspectState().operationalCounts.bookings).toBe(0);
  });

  it('5c. Safe Pause, Safe Cancel before deletion, and Completion Verification straggler guard work reliably', async () => {
    const adapter = createInMemoryFactoryResetRepositoryAdapter(
      createFullOperationalSeed({ bookingsCount: 3 }),
    );
    const owner = buildActor({ role: 'owner' });

    // Simulate interrupted/paused operation BEFORE first deletion
    await adapter.startOrReplaceResetOperation({
      schemaVersion: 1,
      operationId: 'reset_before_del',
      status: FACTORY_RESET_STATUS.PAUSED,
      initiatedByUid: owner.uid,
      currentCollection: 'publicBookingRequests_communications',
      lastProcessedDocumentId: '',
      completedCollections: [],
      deletedDocumentCounts: {},
      totalDeletedCount: 0,
    });
    await adapter.setPublicAvailabilityMetadata({ isReady: false, backfilledFromDate: '' });

    const cancelled = await cancelFactoryResetBeforeDeletion({
      actor: owner,
      adapter,
      now: new Date('2026-11-22T05:00:00.000Z'),
    });
    expect(cancelled.status).toBe(FACTORY_RESET_STATUS.CANCELLED);
    expect(adapter._inspectState().publicAvailabilityMetadataState.isReady).toBe(true);

    // Verification catches a straggler document inserted mid-run before finalization
    const preflight = await previewFactoryReset({ actor: owner, adapter });
    let injected = false;
    await expect(
      startFactoryReset({
        actor: owner,
        preflight,
        confirmationPhrase: FACTORY_RESET_CONFIRMATION_PHRASE,
        acknowledged: true,
        reauthenticatedAt: Date.now(),
        adapter,
        onProgress: (op) => {
          if (
            !injected &&
            op.completedCollections.includes('bookings') &&
            op.status === FACTORY_RESET_STATUS.RUNNING
          ) {
            injected = true;
            adapter._seedStragglerDoc('bookings', { id: 'bkg_straggler', customerName: 'Late' });
          }
        },
      }),
    ).rejects.toMatchObject({ code: 'factory-reset/verification-failed' });

    expect(adapter._inspectState().operation.status).toBe(FACTORY_RESET_STATUS.FAILED);

    const finished = await resumeFactoryReset({
      actor: owner,
      reauthenticatedAt: Date.now(),
      adapter,
    });
    expect(finished.status).toBe(FACTORY_RESET_STATUS.COMPLETED);
    expect(adapter._inspectState().operationalCounts.bookings).toBe(0);
  });
});

describe('Danger Area UI & Routes (/admin/settings/danger-area)', () => {
  it('6a. Blocks non-Owner Staff from /admin/settings/danger-area via RequireOwner guard', async () => {
    setFactoryResetRepositoryAdapter(
      createInMemoryFactoryResetRepositoryAdapter(createFullOperationalSeed({ bookingsCount: 2 })),
    );

    render(
      <MemoryRouter initialEntries={['/admin/settings/danger-area']}>
        <AuthContext.Provider value={buildAuthContextValue({ uid: 'staff-1', role: 'staff' })}>
          <AppRoutes />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('require-owner-denied')).toBeTruthy();
    expect(
      screen.queryByRole('heading', { level: 2, name: /operational factory reset/i }),
    ).toBeNull();
  });

  it('6b. Executes full 3-stage confirmation UI flow (with paste guard & single-flight submit) and renders verified completion summary', async () => {
    const adapter = createInMemoryFactoryResetRepositoryAdapter(
      createFullOperationalSeed({ bookingsCount: 4 }),
    );
    setFactoryResetRepositoryAdapter(adapter);

    const reauthenticate = vi.fn(async (password) => {
      if (password !== 'OwnerPass!37') {
        const err = new Error('Wrong password');
        err.code = 'auth/wrong-password';
        throw err;
      }
      return {
        user: { uid: 'owner-1', email: 'owner@37music.id' },
        profile: { uid: 'owner-1', email: 'owner@37music.id', role: 'owner', active: true },
        reauthenticatedAt: Date.now(),
      };
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/settings/danger-area']}>
        <AuthContext.Provider value={buildAuthContextValue({ reauthenticate })}>
          <AppRoutes />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const openBtn = await screen.findByRole('button', { name: /mulai factory reset/i });
    await waitFor(() => {
      expect(openBtn.disabled).toBe(false);
    });
    await user.click(openBtn);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /lanjut: verifikasi password/i }));

    // Stage 2: wrong password fails cleanly, valid password advances to Stage 3
    const pwdInput = within(dialog).getByLabelText(/password akun owner saat ini/i);
    await user.type(pwdInput, 'BadPass');
    await user.click(within(dialog).getByRole('button', { name: /verifikasi password/i }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();

    await user.type(pwdInput, 'OwnerPass!37');
    await user.click(within(dialog).getByRole('button', { name: /verifikasi password/i }));

    const phraseInput = await within(dialog).findByLabelText(/frasa konfirmasi manual/i);
    const submitBtn = within(dialog).getByRole('button', { name: /delete all operational data/i });
    expect(submitBtn.disabled).toBe(true);

    // Paste event must be blocked via preventDefault
    const pasteEvent = createEvent.paste(phraseInput, {
      clipboardData: { getData: () => FACTORY_RESET_CONFIRMATION_PHRASE },
    });
    fireEvent(phraseInput, pasteEvent);
    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(phraseInput.value).toBe('');

    await user.type(phraseInput, FACTORY_RESET_CONFIRMATION_PHRASE);
    expect(submitBtn.disabled).toBe(true);

    const checkbox = within(dialog).getByRole('checkbox');
    await user.click(checkbox);
    expect(submitBtn.disabled).toBe(false);

    await user.click(submitBtn);

    const resultSection = await screen.findByTestId('factory-reset-result-section');
    expect(within(resultSection).getByText(/factory reset completed/i)).toBeTruthy();
    expect(within(resultSection).getByText(/isReady: true/i)).toBeTruthy();
    expect(adapter._inspectState().operationalCounts.bookings).toBe(0);
    expect(adapter._inspectState().preservedCounts.galleryItems).toBe(1);
    expect(reauthenticate).toHaveBeenCalledTimes(2);
  });

  it('6c. Surfaces Maintenance Banner on AdminLayout when locked and supports password-verified Resume after interrupted failure', async () => {
    const completedEarlierSteps = FACTORY_RESET_DELETION_MANIFEST.slice(0, 24).map(
      (step) => step.key,
    );
    const seed = createFullOperationalSeed({ bookingsCount: 3 });
    const adapter = createInMemoryFactoryResetRepositoryAdapter({
      initialCollections: {
        bookings: seed.initialCollections.bookings.slice(1),
      },
      initialRequestSubcollections: {},
      initialPreserved: seed.initialPreserved,
      initialOperation: {
        schemaVersion: 1,
        operationId: 'reset_resumable_001',
        status: FACTORY_RESET_STATUS.FAILED,
        initiatedByUid: 'owner-1',
        initiatedAt: '2026-11-22T04:00:00.000Z',
        startedAt: '2026-11-22T04:00:00.000Z',
        updatedAt: '2026-11-22T04:01:00.000Z',
        completedAt: null,
        currentCollection: 'bookings',
        lastProcessedDocumentId: 'bkg_001',
        completedCollections: completedEarlierSteps,
        deletedDocumentCounts: { bookings: 1 },
        totalDeletedCount: 1,
        lastErrorCode: 'unavailable',
        lastErrorMessage: 'Network timeout during batch commit.',
        verificationSummary: null,
      },
    });
    setFactoryResetRepositoryAdapter(adapter);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/settings']}>
        <AuthContext.Provider value={buildAuthContextValue()}>
          <AppRoutes />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const banner = await screen.findByTestId('admin-factory-reset-maintenance-banner');
    expect(banner.textContent).toMatch(/maintenance mode aktif/i);

    await user.click(within(banner).getByRole('link', { name: /buka danger area/i }));

    expect(await screen.findByTestId('factory-reset-progress-section')).toBeTruthy();
    expect(screen.getByTestId('factory-reset-execution-error').textContent).toMatch(
      /network timeout during batch commit/i,
    );

    const resumePwd = screen.getByLabelText(/password owner untuk resume factory reset/i);
    await user.type(resumePwd, 'OwnerPass!37');
    await user.click(screen.getByRole('button', { name: /coba lagi & resume/i }));

    const resultSection = await screen.findByTestId('factory-reset-result-section');
    expect(within(resultSection).getByText(/factory reset completed/i)).toBeTruthy();
    expect(adapter._inspectState().operation.operationId).toBe('reset_resumable_001');
  });

  it('7. Deletes reviewInvitations and reviewInvitationIndexes while preserving customerReviews and publicReviewStats', async () => {
    const seed = createFullOperationalSeed({ bookingsCount: 1 });
    seed.initialCollections.reviewInvitations = [{ id: 'a'.repeat(64), bookingId: 'bkg_001' }];
    seed.initialCollections.reviewInvitationIndexes = [
      { id: 'bkg_001', activeInvitationId: 'a'.repeat(64) },
    ];
    seed.initialPreserved.customerReviews = [
      { id: 'bkg_001', displayName: 'Nadia Vocal', rating: 5, status: 'published' },
    ];
    seed.initialPreserved.publicReviewStats = [{ id: 'summary', publishedCount: 1, ratingSum: 5 }];

    const adapter = createInMemoryFactoryResetRepositoryAdapter(seed);
    const owner = buildActor({ role: 'owner' });
    const preflight = await previewFactoryReset({ actor: owner, adapter });

    const byKey = Object.fromEntries(preflight.items.map((item) => [item.key, item.count]));
    expect(byKey.reviewInvitations).toBe(1);
    expect(byKey.reviewInvitationIndexes).toBe(1);

    const fixedNow = new Date('2026-11-22T05:00:00.000Z');
    const result = await startFactoryReset({
      actor: owner,
      preflight,
      confirmationPhrase: FACTORY_RESET_CONFIRMATION_PHRASE,
      acknowledged: true,
      reauthenticatedAt: fixedNow.getTime(),
      adapter,
      now: fixedNow,
    });

    expect(result.status).toBe(FACTORY_RESET_STATUS.COMPLETED);
    const state = adapter._inspectState();
    expect(state.operationalCounts.reviewInvitations).toBe(0);
    expect(state.operationalCounts.reviewInvitationIndexes).toBe(0);
    expect(state.preservedCounts.customerReviews).toBe(1);
    expect(state.preservedCounts.publicReviewStats).toBe(1);
  });

  it('8. Blocks parent invoice deletion if invoices/{invoiceId}/adjustments still has remaining documents', async () => {
    const seed = createFullOperationalSeed({ bookingsCount: 1 });
    const adapter = createInMemoryFactoryResetRepositoryAdapter(seed);
    const owner = buildActor({ role: 'owner' });

    const preflight = await previewFactoryReset({ actor: owner, adapter });
    const fixedNow = new Date('2026-11-22T05:00:00.000Z');
    // Pre-mark invoices_adjustments completed while adj_000000000000000000000001 still exists
    await adapter.startOrReplaceResetOperation({
      schemaVersion: 1,
      operationId: 'reset_guard_adj',
      status: FACTORY_RESET_STATUS.FAILED,
      initiatedByUid: owner.uid,
      currentCollection: 'invoices',
      lastProcessedDocumentId: '',
      completedCollections: ['invoices_adjustments'],
      deletedDocumentCounts: { invoices_adjustments: 0 },
      totalDeletedCount: 0,
    });
    expect(preflight.isComplete).toBe(true);

    await expect(
      resumeFactoryReset({
        actor: owner,
        reauthenticatedAt: fixedNow.getTime(),
        adapter,
        now: fixedNow,
      }),
    ).rejects.toMatchObject({ code: 'factory-reset/subcollection-not-empty' });
  });
});
