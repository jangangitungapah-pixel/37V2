/**
 * Atomic Stock Movement Transaction Service (`recordInventoryMovement`)
 * for 37 Music Studio Inventory Module.
 *
 * Guarantees:
 * - Every stock balance change creates an immutable `inventoryMovements/{movementId}` record
 * - All reads before writes inside Firestore `runTransaction`
 * - Strict idempotency via pre-generated `movementId` (`operationId`)
 * - Optimistic concurrency (`expectedVersion`) preventing overselling / negative balances
 * - Owner-only enforcement for `stock_adjustment`
 */

import {
  addDaysToIsoDate,
  getJakartaTodayIso,
  isValidIsoDateString,
  parseIsoDateParts,
} from '@/features/admin/calendar/utils/calendar-date';
import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';

import { INVENTORY_ITEM_TYPES, INVENTORY_MOVEMENT_TYPES } from '../config/inventory-config';
import { getInventoryRepositoryAdapter } from '../repositories/inventory-repository';
import {
  normalizeInventoryItemRecord,
  normalizeInventoryMovementRecord,
} from '../schemas/inventory-schema';
import { computeInventoryMovementTransition } from '../utils/inventory-calculation';
import { resolveUnitDisplayLabel } from '../utils/inventory-format';
import {
  assertInventoryOwnerActor,
  assertInventoryStaffActor,
  createInventoryServiceError,
} from './inventory-item-service';

function buildMovementOccurredDate({ occurredDate, todayIso }) {
  const cleanDate = String(occurredDate || '').trim();
  if (!cleanDate || cleanDate === todayIso || !isValidIsoDateString(cleanDate)) {
    return null; // Caller will use transaction `nowValue()`
  }
  const parts = parseIsoDateParts(cleanDate);
  if (!parts) return null;
  // Use 12:00 WIB (+07:00 => 05:00 UTC) so calendar day in Asia/Jakarta is always exact
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 5, 0, 0));
}

/**
 * Shared atomic service to record ANY Inventory balance or location movement.
 */
export async function recordInventoryMovement({
  itemId,
  movementId = generateOperationId('mov'),
  expectedVersion,
  actorUid,
  actorRole = 'staff',
  actorName = '',
  movementType,
  quantity,
  sourceBucket = 'available',
  adjustmentBucket = 'available',
  actualCountedQuantity,
  reason = '',
  notes = '',
  occurredDate = '',
  nextMaintenanceDate,
  locationId,
  customLocationLabel = '',
  adapter = getInventoryRepositoryAdapter(),
}) {
  const cleanItemId = String(itemId || '').trim();
  const cleanMovementId = String(movementId || '').trim() || generateOperationId('mov');
  const cleanActorName = String(actorName || '')
    .trim()
    .slice(0, 120);

  if (!cleanItemId) {
    throw createInventoryServiceError('inventory/missing-item', 'ID item inventory wajib diisi.');
  }

  const isStockAdjustment = movementType === INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT;
  const cleanActorUid = isStockAdjustment
    ? assertInventoryOwnerActor({ actorUid, actorRole })
    : assertInventoryStaffActor(actorUid);

  const cleanReason = String(reason || '').trim();
  const cleanNotes = String(notes || '').trim();

  if (cleanReason.length > 160) {
    throw createInventoryServiceError(
      'inventory/invalid-reason',
      'Alasan pergerakan maksimal 160 karakter.',
    );
  }
  if (cleanNotes.length > 500) {
    throw createInventoryServiceError(
      'inventory/invalid-notes',
      'Catatan pergerakan maksimal 500 karakter.',
    );
  }

  const todayIso = getJakartaTodayIso();
  const customOccurredDate = buildMovementOccurredDate({ occurredDate, todayIso });

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [existingItem, existingMovement] = await Promise.all([
      tx.getItem(cleanItemId),
      tx.getMovement(cleanMovementId),
    ]);

    // 2. STRICT IDEMPOTENT REPLAY
    if (existingMovement) {
      if (existingMovement.itemId !== cleanItemId) {
        throw createInventoryServiceError(
          'inventory/operation-conflict',
          'ID transaksi pergerakan bentrok dengan item lain. Tutup dialog lalu coba lagi.',
        );
      }
      return {
        item: existingItem,
        movement: existingMovement,
        replayed: true,
      };
    }

    if (!existingItem) {
      throw createInventoryServiceError('inventory/not-found', 'Item inventory tidak ditemukan.');
    }

    if (existingItem.isActive === false) {
      throw createInventoryServiceError(
        'inventory/archived-item',
        'Item yang sudah diarsipkan tidak dapat menerima pergerakan stok.',
      );
    }

    if (typeof expectedVersion === 'number' && existingItem.version !== expectedVersion) {
      throw createInventoryServiceError(
        'inventory/stale-version',
        'Stok barang baru saja berubah oleh pengguna lain. Muat ulang lalu coba kembali.',
      );
    }

    const transition = computeInventoryMovementTransition({
      item: existingItem,
      movementType,
      quantity,
      sourceBucket,
      adjustmentBucket,
      actualCountedQuantity,
      reason: cleanReason,
      notes: cleanNotes,
      locationId,
      customLocationLabel,
    });

    const isEquipment = existingItem.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;
    const now = tx.nowValue();
    const occurredAt = customOccurredDate ? tx.timestampFromDate(customOccurredDate) : now;

    // Optional Return From Maintenance schedule updates
    let nextLastMaintenance = existingItem.lastMaintenanceDate;
    let nextScheduledMaintenance = existingItem.nextMaintenanceDate;
    if (isEquipment && movementType === INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE) {
      const completionIso = isValidIsoDateString(occurredDate) ? occurredDate : todayIso;
      nextLastMaintenance = completionIso;
      const providedNext = String(nextMaintenanceDate ?? '').trim();
      if (providedNext) {
        if (!isValidIsoDateString(providedNext)) {
          throw createInventoryServiceError(
            'inventory/invalid-date',
            'Format Next Maintenance Date tidak valid (YYYY-MM-DD).',
          );
        }
        nextScheduledMaintenance = providedNext;
      } else if (existingItem.maintenanceIntervalDays > 0) {
        nextScheduledMaintenance = addDaysToIsoDate(
          completionIso,
          existingItem.maintenanceIntervalDays,
        );
      }
    }

    const resolvedLocation =
      movementType === INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED
        ? transition.locationAfter
        : {
            locationId: existingItem.locationId,
            locationLabel: existingItem.locationLabel,
          };

    const resolvedReason =
      cleanReason ||
      (movementType === INVENTORY_MOVEMENT_TYPES.STOCK_IN
        ? 'Restock'
        : movementType === INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE
          ? 'Maintenance completed'
          : movementType === INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED
            ? 'Location updated'
            : '');

    const movementPayload = {
      itemId: cleanItemId,
      itemCode: existingItem.itemCode,
      itemNameSnapshot: existingItem.name,
      itemType: existingItem.itemType,
      movementType,
      quantity: transition.quantity,
      unit: resolveUnitDisplayLabel(existingItem.unit, existingItem.customUnitLabel),
      balanceBefore: transition.balanceBefore,
      balanceAfter: transition.balanceAfter,
      locationBefore: transition.locationBefore || null,
      locationAfter: transition.locationAfter || null,
      reason: resolvedReason,
      notes: cleanNotes,
      source: transition.source,
      occurredAt,
      operationId: cleanMovementId,
      recordedByUid: cleanActorUid,
      recordedByNameSnapshot: cleanActorName || cleanActorUid,
      createdAt: now,
    };

    const itemUpdatePayload = {
      consumableStock: isEquipment ? null : transition.balanceAfter,
      equipmentStock: isEquipment ? transition.balanceAfter : null,
      lowStock: transition.lowStock,
      inMaintenance: transition.inMaintenance,
      hasDamagedOrRetired: transition.hasDamagedOrRetired,
      locationId: resolvedLocation.locationId,
      locationLabel: resolvedLocation.locationLabel,
      lastMaintenanceDate: nextLastMaintenance,
      nextMaintenanceDate: nextScheduledMaintenance,
      lastMovementId: cleanMovementId,
      lastMovementAt: occurredAt,
      updatedAt: now,
      updatedByUid: cleanActorUid,
      version: existingItem.version + 1,
    };

    // 3. ALL WRITES AFTER READS
    tx.setMovement(cleanMovementId, movementPayload);
    tx.updateItem(cleanItemId, itemUpdatePayload);

    return {
      item: normalizeInventoryItemRecord(cleanItemId, {
        ...existingItem,
        ...itemUpdatePayload,
      }),
      movement: normalizeInventoryMovementRecord(cleanMovementId, movementPayload),
      replayed: false,
    };
  });
}
