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
  INVENTORY_CONSUMABLE_STATUS,
  INVENTORY_ITEM_TYPES,
  INVENTORY_MAINTENANCE_DUE_STATE,
  INVENTORY_MOVEMENT_TYPES,
} from './config/inventory-config';
import {
  createInMemoryInventoryRepositoryAdapter,
  resetInventoryRepositoryAdapter,
  setInventoryRepositoryAdapter,
} from './repositories/inventory-repository';
import {
  createInventoryItem,
  setInventoryItemArchiveStatus,
  updateInventoryItemMetadata,
} from './services/inventory-item-service';
import { recordInventoryMovement } from './services/inventory-movement-service';
import {
  computeEquipmentRegisteredTotal,
  computeInventorySummaryMetrics,
  deriveConsumableStockStatus,
  deriveEquipmentMaintenanceMeta,
} from './utils/inventory-status';

function mockAuthenticatedStaff(role = 'owner', uid = 'owner-uid-1') {
  const displayName = role === 'owner' ? '37 Music Studio Owner' : 'Rina Studio Staff';
  const email = role === 'owner' ? 'owner@37studio.com' : 'staff@37studio.com';

  mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
    queueMicrotask(() => callback({ uid, email, displayName }));
    return () => {};
  });

  mockGetDoc.mockImplementation(async (docRef) => {
    if (docRef.path === `staffProfiles/${uid}`) {
      return {
        id: uid,
        exists: () => true,
        data: () => ({
          displayName,
          email,
          role,
          active: true,
        }),
      };
    }

    return {
      id: docRef.id,
      exists: () => false,
      data: () => ({}),
    };
  });
}

function renderInventoryRoute() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/admin/inventory']}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Inventory Module — Domain Logic, Atomic Transactions, Audit Trail & UI', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockOnAuthStateChanged.mockReset();
    mockGetDoc.mockReset();
    resetInventoryRepositoryAdapter();
  });

  afterEach(() => {
    cleanup();
    resetInventoryRepositoryAdapter();
  });

  it('creates consumables & equipment atomically with opening stock movement and blocks 0-opening phantom movements', async () => {
    const adapter = createInMemoryInventoryRepositoryAdapter();

    // 1. Consumable with opening stock creates 1 item + 1 opening_stock movement atomically
    const consResult = await createInventoryItem({
      itemId: 'inv-strings-1',
      openingMovementId: 'mov-open-strings-1',
      actorUid: 'staff-1',
      actorName: 'Rina Staff',
      adapter,
      input: {
        name: 'Guitar Strings 010',
        itemCode: 'INV-001',
        itemType: INVENTORY_ITEM_TYPES.CONSUMABLE,
        categoryId: 'instruments',
        unit: 'set',
        locationId: 'storage',
        minimumStockQuantity: 5,
        openingQuantity: 12.5,
      },
    });

    expect(consResult.item.consumableStock.onHandQuantity).toBe(12.5);
    expect(consResult.item.lastMovementId).toBe('mov-open-strings-1');
    expect(consResult.openingMovement.movementType).toBe(INVENTORY_MOVEMENT_TYPES.OPENING_STOCK);
    expect(consResult.openingMovement.balanceBefore.onHandQuantity).toBe(0);
    expect(consResult.openingMovement.balanceAfter.onHandQuantity).toBe(12.5);

    // Idempotent replay with same IDs creates no second movement
    const replayResult = await createInventoryItem({
      itemId: 'inv-strings-1',
      openingMovementId: 'mov-open-strings-1',
      actorUid: 'staff-1',
      actorName: 'Rina Staff',
      adapter,
      input: {
        name: 'Guitar Strings 010',
        itemCode: 'INV-001',
        itemType: INVENTORY_ITEM_TYPES.CONSUMABLE,
        categoryId: 'instruments',
        unit: 'set',
        locationId: 'storage',
        minimumStockQuantity: 5,
        openingQuantity: 12.5,
      },
    });
    expect(replayResult.replayed).toBe(true);
    expect(adapter.movementsStore.size).toBe(1);

    // 2. Equipment with 0 opening stock initializes zero buckets and creates no opening movement
    const eqResult = await createInventoryItem({
      itemId: 'inv-mic-1',
      actorUid: 'owner-1',
      actorName: 'Owner',
      adapter,
      input: {
        name: 'Shure SM58',
        itemCode: 'INV-002',
        itemType: INVENTORY_ITEM_TYPES.EQUIPMENT,
        categoryId: 'audio_recording',
        unit: 'unit',
        locationId: 'room-a',
        minimumAvailableQuantity: 2,
        openingQuantity: 0,
      },
    });

    expect(eqResult.openingMovement).toBeNull();
    expect(eqResult.item.equipmentStock).toEqual({
      availableQuantity: 0,
      maintenanceQuantity: 0,
      damagedQuantity: 0,
      retiredQuantity: 0,
    });
    expect(adapter.movementsStore.size).toBe(1);
  });

  it('handles consumable stock-in, decimal usage, write-off, low/out-of-stock derivation, and Owner-only stock adjustment', async () => {
    const adapter = createInMemoryInventoryRepositoryAdapter();

    const { item } = await createInventoryItem({
      itemId: 'inv-clean-1',
      openingMovementId: 'mov-clean-open',
      actorUid: 'owner-1',
      adapter,
      input: {
        name: 'Cleaning Liquid',
        itemCode: 'INV-010',
        itemType: INVENTORY_ITEM_TYPES.CONSUMABLE,
        categoryId: 'maintenance_cleaning',
        unit: 'liter',
        locationId: 'storage',
        minimumStockQuantity: 1,
        openingQuantity: 1.5,
      },
    });

    expect(deriveConsumableStockStatus(item)).toBe(INVENTORY_CONSUMABLE_STATUS.IN_STOCK);

    // Stock in 0.75 liter -> 2.25 liter
    const restock = await recordInventoryMovement({
      itemId: item.id,
      movementId: 'mov-clean-in',
      expectedVersion: item.version,
      actorUid: 'staff-1',
      actorRole: 'staff',
      movementType: INVENTORY_MOVEMENT_TYPES.STOCK_IN,
      quantity: 0.75,
      notes: 'Restock botol baru',
      adapter,
    });
    expect(restock.item.consumableStock.onHandQuantity).toBe(2.25);

    // Usage 1.5 liter -> 0.75 liter (<= min 1 => low_stock)
    const usage = await recordInventoryMovement({
      itemId: item.id,
      movementId: 'mov-clean-use',
      expectedVersion: restock.item.version,
      actorUid: 'staff-1',
      actorRole: 'staff',
      movementType: INVENTORY_MOVEMENT_TYPES.CONSUME,
      quantity: 1.5,
      reason: 'Maintenance',
      adapter,
    });
    expect(usage.item.consumableStock.onHandQuantity).toBe(0.75);
    expect(usage.item.lowStock).toBe(true);
    expect(deriveConsumableStockStatus(usage.item)).toBe(INVENTORY_CONSUMABLE_STATUS.LOW_STOCK);

    // Reject negative stock on over-consumption
    await expect(
      recordInventoryMovement({
        itemId: item.id,
        movementId: 'mov-clean-over',
        expectedVersion: usage.item.version,
        actorUid: 'staff-1',
        actorRole: 'staff',
        movementType: INVENTORY_MOVEMENT_TYPES.CONSUME,
        quantity: 1.0,
        reason: 'Studio Operations',
        adapter,
      }),
    ).rejects.toThrow(/tidak mencukupi/i);

    // Staff cannot perform Stock Adjustment
    await expect(
      recordInventoryMovement({
        itemId: item.id,
        movementId: 'mov-clean-staff-adj',
        expectedVersion: usage.item.version,
        actorUid: 'staff-1',
        actorRole: 'staff',
        movementType: INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT,
        actualCountedQuantity: 2,
        reason: 'Stock opname',
        adapter,
      }),
    ).rejects.toThrow(/owner/i);

    // Owner adjustment without reason rejected
    await expect(
      recordInventoryMovement({
        itemId: item.id,
        movementId: 'mov-clean-noreason',
        expectedVersion: usage.item.version,
        actorUid: 'owner-1',
        actorRole: 'owner',
        movementType: INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT,
        actualCountedQuantity: 2,
        reason: '',
        adapter,
      }),
    ).rejects.toThrow(/alasan koreksi/i);

    // Owner stock adjustment with reason succeeds -> 0 (out_of_stock)
    const adj = await recordInventoryMovement({
      itemId: item.id,
      movementId: 'mov-clean-adj',
      expectedVersion: usage.item.version,
      actorUid: 'owner-1',
      actorRole: 'owner',
      movementType: INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT,
      actualCountedQuantity: 0,
      reason: 'Botol pecah saat opname',
      adapter,
    });
    expect(adj.item.consumableStock.onHandQuantity).toBe(0);
    expect(deriveConsumableStockStatus(adj.item)).toBe(INVENTORY_CONSUMABLE_STATUS.OUT_OF_STOCK);
  });

  it('tracks equipment buckets across maintenance, damaged, repaired, retired, and Jakarta maintenance reminders', async () => {
    const adapter = createInMemoryInventoryRepositoryAdapter();

    const { item: eq0 } = await createInventoryItem({
      itemId: 'inv-amp-1',
      openingMovementId: 'mov-amp-open',
      actorUid: 'owner-1',
      adapter,
      input: {
        name: 'Guitar Amplifier JCM',
        itemCode: 'INV-020',
        itemType: INVENTORY_ITEM_TYPES.EQUIPMENT,
        categoryId: 'amplifiers_speakers',
        unit: 'unit',
        locationId: 'room-a',
        minimumAvailableQuantity: 1,
        openingQuantity: 3,
        nextMaintenanceDate: '2026-11-19',
        maintenanceIntervalDays: 90,
      },
    });

    // Due check (reference date 2026-11-20)
    expect(deriveEquipmentMaintenanceMeta(eq0, '2026-11-20').dueState).toBe(
      INVENTORY_MAINTENANCE_DUE_STATE.DUE,
    );
    expect(
      deriveEquipmentMaintenanceMeta({ ...eq0, nextMaintenanceDate: '2026-11-25' }, '2026-11-20')
        .dueState,
    ).toBe(INVENTORY_MAINTENANCE_DUE_STATE.SOON);

    // Send 2 to maintenance
    const sent = await recordInventoryMovement({
      itemId: eq0.id,
      movementId: 'mov-amp-maint',
      expectedVersion: eq0.version,
      actorUid: 'staff-1',
      movementType: INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE,
      quantity: 2,
      reason: 'Servis potensiometer',
      adapter,
    });
    expect(sent.item.equipmentStock).toEqual({
      availableQuantity: 1,
      maintenanceQuantity: 2,
      damagedQuantity: 0,
      retiredQuantity: 0,
    });
    expect(computeEquipmentRegisteredTotal(sent.item.equipmentStock)).toBe(3);

    // Mark 1 damaged from maintenance
    const dmg = await recordInventoryMovement({
      itemId: eq0.id,
      movementId: 'mov-amp-dmg',
      expectedVersion: sent.item.version,
      actorUid: 'staff-1',
      movementType: INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED,
      sourceBucket: 'maintenance',
      quantity: 1,
      reason: 'Trafo terbakar',
      adapter,
    });
    expect(dmg.item.equipmentStock).toEqual({
      availableQuantity: 1,
      maintenanceQuantity: 1,
      damagedQuantity: 1,
      retiredQuantity: 0,
    });

    // Return remaining 1 from maintenance with completion date & next maintenance schedule
    const ret = await recordInventoryMovement({
      itemId: eq0.id,
      movementId: 'mov-amp-ret',
      expectedVersion: dmg.item.version,
      actorUid: 'staff-1',
      movementType: INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE,
      quantity: 1,
      occurredDate: '2026-11-20',
      nextMaintenanceDate: '2027-02-18',
      notes: 'Pembersihan potensio selesai',
      adapter,
    });
    expect(ret.item.equipmentStock.availableQuantity).toBe(2);
    expect(ret.item.equipmentStock.maintenanceQuantity).toBe(0);
    expect(ret.item.lastMaintenanceDate).toBe('2026-11-20');
    expect(ret.item.nextMaintenanceDate).toBe('2027-02-18');

    // Mark repaired requires note
    await expect(
      recordInventoryMovement({
        itemId: eq0.id,
        movementId: 'mov-amp-rep-bad',
        expectedVersion: ret.item.version,
        actorUid: 'staff-1',
        movementType: INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED,
        quantity: 1,
        notes: '',
        adapter,
      }),
    ).rejects.toThrow(/catatan perbaikan/i);

    // Retire the damaged unit -> registered total stays 3
    const retired = await recordInventoryMovement({
      itemId: eq0.id,
      movementId: 'mov-amp-retire',
      expectedVersion: ret.item.version,
      actorUid: 'owner-1',
      movementType: INVENTORY_MOVEMENT_TYPES.MARK_RETIRED,
      sourceBucket: 'damaged',
      quantity: 1,
      reason: 'Beyond Repair',
      adapter,
    });
    expect(retired.item.equipmentStock).toEqual({
      availableQuantity: 2,
      maintenanceQuantity: 0,
      damagedQuantity: 0,
      retiredQuantity: 1,
    });
    expect(computeEquipmentRegisteredTotal(retired.item.equipmentStock)).toBe(3);

    // Archive blocked because 2 available units still exist
    await expect(
      setInventoryItemArchiveStatus({
        itemId: eq0.id,
        expectedVersion: retired.item.version,
        archived: true,
        actorUid: 'owner-1',
        actorRole: 'owner',
        adapter,
      }),
    ).rejects.toThrow(/tidak dapat diarsipkan/i);

    // Retire remaining 2 available -> only retired = 3 remains -> archive allowed
    const retiredAll = await recordInventoryMovement({
      itemId: eq0.id,
      movementId: 'mov-amp-retire-all',
      expectedVersion: retired.item.version,
      actorUid: 'owner-1',
      movementType: INVENTORY_MOVEMENT_TYPES.MARK_RETIRED,
      sourceBucket: 'available',
      quantity: 2,
      reason: 'Disposed',
      adapter,
    });
    const archivedItem = await setInventoryItemArchiveStatus({
      itemId: eq0.id,
      expectedVersion: retiredAll.item.version,
      archived: true,
      actorUid: 'staff-1',
      actorRole: 'staff',
      adapter,
    });
    expect(archivedItem.isActive).toBe(false);

    // Movement rejected while archived
    await expect(
      recordInventoryMovement({
        itemId: eq0.id,
        movementId: 'mov-amp-while-archived',
        expectedVersion: archivedItem.version,
        actorUid: 'owner-1',
        actorRole: 'owner',
        movementType: INVENTORY_MOVEMENT_TYPES.STOCK_IN,
        quantity: 1,
        adapter,
      }),
    ).rejects.toThrow(/diarsipkan/i);

    // Staff cannot reactivate; Owner can reactivate
    await expect(
      setInventoryItemArchiveStatus({
        itemId: eq0.id,
        expectedVersion: archivedItem.version,
        archived: false,
        actorUid: 'staff-1',
        actorRole: 'staff',
        adapter,
      }),
    ).rejects.toThrow(/owner/i);

    const reactivated = await setInventoryItemArchiveStatus({
      itemId: eq0.id,
      expectedVersion: archivedItem.version,
      archived: false,
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter,
    });
    expect(reactivated.isActive).toBe(true);
  });

  it('prevents overselling across concurrent usage transactions, enforces stale version check, and prevents duplicate retries', async () => {
    const adapter = createInMemoryInventoryRepositoryAdapter();

    const { item } = await createInventoryItem({
      itemId: 'inv-tape-1',
      openingMovementId: 'mov-tape-open',
      actorUid: 'owner-1',
      adapter,
      input: {
        name: 'Gaffer Tape',
        itemCode: 'INV-030',
        itemType: INVENTORY_ITEM_TYPES.CONSUMABLE,
        categoryId: 'maintenance_cleaning',
        unit: 'roll',
        locationId: 'room-b',
        minimumStockQuantity: 2,
        openingQuantity: 5,
      },
    });

    // Two concurrent usage attempts referencing version 1: only one commits, other fails optimistic lock / stale version
    const [first, second] = await Promise.allSettled([
      recordInventoryMovement({
        itemId: item.id,
        movementId: 'mov-tape-a',
        expectedVersion: 1,
        actorUid: 'staff-1',
        movementType: INVENTORY_MOVEMENT_TYPES.CONSUME,
        quantity: 4,
        reason: 'Customer Session',
        adapter,
      }),
      recordInventoryMovement({
        itemId: item.id,
        movementId: 'mov-tape-b',
        expectedVersion: 1,
        actorUid: 'staff-2',
        movementType: INVENTORY_MOVEMENT_TYPES.CONSUME,
        quantity: 4,
        reason: 'Studio Operations',
        adapter,
      }),
    ]);

    const fulfilled = [first, second].filter((r) => r.status === 'fulfilled');
    const rejected = [first, second].filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const storedAfter = await adapter.getItemById(item.id);
    expect(storedAfter.consumableStock.onHandQuantity).toBe(1);

    // Retry same movementId (`mov-tape-a` or `mov-tape-b` that succeeded) -> idempotent replay, stock unchanged
    const committedMovId = fulfilled[0].value.movement.id;
    const replayed = await recordInventoryMovement({
      itemId: item.id,
      movementId: committedMovId,
      expectedVersion: storedAfter.version,
      actorUid: 'staff-1',
      movementType: INVENTORY_MOVEMENT_TYPES.CONSUME,
      quantity: 4,
      reason: 'Customer Session',
      adapter,
    });
    expect(replayed.replayed).toBe(true);
    expect((await adapter.getItemById(item.id)).consumableStock.onHandQuantity).toBe(1);
  });

  it('emits location_changed movement when updating location on item with history without altering stock or metrics double-count', async () => {
    const adapter = createInMemoryInventoryRepositoryAdapter();

    const { item } = await createInventoryItem({
      itemId: 'inv-xlr-1',
      openingMovementId: 'mov-xlr-open',
      actorUid: 'owner-1',
      adapter,
      input: {
        name: 'XLR Cable 5m',
        itemCode: 'INV-040',
        itemType: INVENTORY_ITEM_TYPES.EQUIPMENT,
        categoryId: 'cables_connectivity',
        unit: 'pcs',
        locationId: 'room-a',
        openingQuantity: 6,
        nextMaintenanceDate: '2026-11-18',
      },
    });

    const edited = await updateInventoryItemMetadata({
      itemId: item.id,
      expectedVersion: item.version,
      locationMovementId: 'mov-xlr-loc',
      actorUid: 'staff-1',
      actorName: 'Rina Staff',
      adapter,
      input: {
        name: 'XLR Cable 5m Neutrik',
        itemCode: 'INV-040',
        categoryId: 'cables_connectivity',
        unit: 'pcs',
        locationId: 'room-b',
        minimumAvailableQuantity: 2,
        nextMaintenanceDate: '2026-11-18',
      },
    });

    expect(edited.item.equipmentStock.availableQuantity).toBe(6);
    expect(edited.item.locationId).toBe('room-b');
    expect(edited.item.locationLabel).toBe('Room B');
    expect(edited.locationMovement.movementType).toBe(INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED);
    expect(edited.locationMovement.locationBefore.locationId).toBe('room-a');
    expect(edited.locationMovement.locationAfter.locationId).toBe('room-b');

    // Summary metrics count each item at most once per metric even if maintenance + due both match
    const summary = computeInventorySummaryMetrics(
      [
        {
          ...edited.item,
          equipmentStock: {
            availableQuantity: 4,
            maintenanceQuantity: 2,
            damagedQuantity: 1,
            retiredQuantity: 1,
          },
        },
      ],
      '2026-11-20',
    );
    expect(summary.activeItemsCount).toBe(1);
    expect(summary.maintenanceCount).toBe(1);
    expect(summary.damagedRetiredCount).toBe(1);
  });

  it('renders /admin/inventory UI cleanly, creates item, records usage, hides Stock Adjustment from Staff, and shows Activity', async () => {
    const user = userEvent.setup();
    const adapter = createInMemoryInventoryRepositoryAdapter();
    setInventoryRepositoryAdapter(adapter);

    // 1. Login as Staff first -> verify Stock Adjustment is hidden
    mockAuthenticatedStaff('staff', 'staff-ui-1');
    renderInventoryRoute();

    expect(await screen.findByRole('heading', { level: 2, name: 'Inventory' })).toBeTruthy();
    expect(
      screen.getByText(/manage studio equipment, supplies, and maintenance status\./i),
    ).toBeTruthy();

    // Add a Consumable item via Add Item button
    await user.click(screen.getByRole('button', { name: /add item/i }));
    const createDialog = await screen.findByRole('dialog', {
      name: /tambah barang inventory/i,
    });
    await user.type(within(createDialog).getByLabelText(/item name/i), 'Drum Sticks 5A');
    await user.clear(within(createDialog).getByLabelText(/opening quantity/i));
    await user.type(within(createDialog).getByLabelText(/opening quantity/i), '8');
    await user.click(within(createDialog).getByRole('button', { name: /simpan barang/i }));

    // Detail drawer opens for the created item
    const drawer = await screen.findByRole('dialog', { name: /drum sticks 5a/i });
    expect(within(drawer).getByText('Drum Sticks 5A')).toBeTruthy();
    expect(within(drawer).queryByRole('button', { name: /stock adjustment/i })).toBeNull();

    // Record usage of 4 pcs -> becomes Low Stock (<= min 5)
    await user.click(within(drawer).getByRole('button', { name: /record usage/i }));
    const movDialog = await screen.findByRole('dialog', {
      name: /catat pergerakan • drum sticks 5a/i,
    });
    await user.clear(within(movDialog).getByLabelText(/quantity/i));
    await user.type(within(movDialog).getByLabelText(/quantity/i), '4');
    await user.click(within(movDialog).getByRole('button', { name: /simpan pergerakan/i }));

    await waitFor(() => {
      expect(within(drawer).getAllByText('Low Stock').length).toBeGreaterThanOrEqual(1);
    });

    // Close drawer and check Activity tab
    await user.click(within(drawer).getByRole('button', { name: /tutup detail barang/i }));
    await user.click(screen.getByRole('tab', { name: /activity/i }));
    const activityTable = await screen.findByRole('table', { name: /tabel aktivitas inventory/i });
    expect(within(activityTable).getByText('Opening Stock')).toBeTruthy();
    expect(within(activityTable).getByText('Record Usage')).toBeTruthy();
    cleanup();

    // 2. Re-render as Owner -> verify Stock Adjustment button IS visible and works
    mockAuthenticatedStaff('owner', 'owner-ui-1');
    renderInventoryRoute();

    expect(await screen.findByRole('heading', { level: 2, name: 'Inventory' })).toBeTruthy();
    const itemBtn = await screen.findAllByRole('button', { name: 'Drum Sticks 5A' });
    await user.click(itemBtn[0]);

    const ownerDrawer = await screen.findByRole('dialog', {
      name: /drum sticks 5a/i,
    });
    const adjBtn = within(ownerDrawer).getByRole('button', { name: /stock adjustment/i });
    await user.click(adjBtn);

    const adjDialog = await screen.findByRole('dialog', {
      name: /koreksi stok fisik \(drum sticks 5a\)/i,
    });
    await user.clear(within(adjDialog).getByLabelText(/actual counted quantity/i));
    await user.type(within(adjDialog).getByLabelText(/actual counted quantity/i), '10');
    await user.type(within(adjDialog).getByLabelText(/alasan koreksi/i), 'Stock opname gudang');
    await user.click(within(adjDialog).getByRole('button', { name: /konfirmasi adjustment/i }));

    await waitFor(() => {
      expect(within(ownerDrawer).getAllByText('In Stock').length).toBeGreaterThanOrEqual(1);
    });
  });
});
