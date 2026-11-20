/**
 * Transactional Inventory Item Service for 37 Music Studio:
 * - Item Creation with optional atomic `opening_stock` movement
 * - Metadata Editing (strictly prohibiting direct stock balance mutation)
 * - Automatic `location_changed` movement when moving an item that has movement history
 * - Safe Soft Archive (`isActive = false` only when active operational stock is 0) & Owner Reactivation
 */

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';

import {
  INVENTORY_ITEM_TYPES,
  INVENTORY_MOVEMENT_SOURCES,
  INVENTORY_MOVEMENT_TYPES,
} from '../config/inventory-config';
import { getInventoryRepositoryAdapter } from '../repositories/inventory-repository';
import {
  normalizeInventoryItemRecord,
  normalizeInventoryMovementRecord,
  validateInventoryItemCreateInput,
  validateInventoryItemEditInput,
} from '../schemas/inventory-schema';
import { checkArchiveEligibility } from '../utils/inventory-calculation';
import { resolveUnitDisplayLabel, roundInventoryQuantity } from '../utils/inventory-format';

export function createInventoryServiceError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

export function mapInventoryErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code === 'inventory/owner-only') {
    return error.message || 'Tindakan ini hanya dapat dilakukan oleh Owner aktif.';
  }

  if (code === 'inventory/stale-version' || code.includes('aborted')) {
    return 'Data barang telah diperbarui oleh pengguna lain. Muat ulang detail barang lalu coba kembali.';
  }

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'Akses ditolak oleh Firestore. Pastikan akun Anda aktif sebagai Owner atau Staff.';
  }

  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'Koneksi jaringan terputus. Periksa koneksi internet Anda lalu coba kembali.';
  }

  if (code.startsWith('inventory/') && typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return 'Gagal memproses data inventory. Periksa kembali input Anda lalu coba lagi.';
}

export function assertInventoryStaffActor(actorUid) {
  const clean = String(actorUid || '').trim();
  if (!clean) {
    throw createInventoryServiceError(
      'inventory/missing-actor',
      'Sesi login tidak valid. Silakan login kembali sebagai Staff atau Owner.',
    );
  }
  return clean;
}

export function assertInventoryOwnerActor({ actorUid, actorRole }) {
  const cleanUid = assertInventoryStaffActor(actorUid);
  const cleanRole = String(actorRole || '')
    .trim()
    .toLowerCase();

  if (cleanRole !== 'owner') {
    throw createInventoryServiceError(
      'inventory/owner-only',
      'Akses Owner Diperlukan — tindakan ini hanya dapat dilakukan oleh Owner aktif.',
    );
  }
  return cleanUid;
}

/**
 * Creates a new Consumable or Equipment inventory item.
 * When `openingQuantity > 0`, atomically creates the opening_stock movement inside
 * the exact same Firestore transaction so stock never exists without movement history.
 */
export async function createInventoryItem({
  itemId = generateOperationId('inv'),
  openingMovementId = generateOperationId('mov'),
  actorUid,
  actorName = '',
  input,
  adapter = getInventoryRepositoryAdapter(),
}) {
  const cleanActorUid = assertInventoryStaffActor(actorUid);
  const cleanActorName =
    String(actorName || '')
      .trim()
      .slice(0, 120) || cleanActorUid;
  const cleanItemId = String(itemId || '').trim() || generateOperationId('inv');
  const cleanMovementId = String(openingMovementId || '').trim() || generateOperationId('mov');

  const validation = validateInventoryItemCreateInput(input);
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0] || 'Data barang inventory tidak valid.';
    throw createInventoryServiceError('inventory/validation-error', firstError, validation.errors);
  }

  const normalizedInput = validation.data;
  const existingCodeMatch = await adapter.getItemByCode(normalizedInput.normalizedCode);
  if (existingCodeMatch && existingCodeMatch.id !== cleanItemId) {
    throw createInventoryServiceError(
      'inventory/duplicate-code',
      `Kode item "${normalizedInput.itemCode}" sudah digunakan oleh "${existingCodeMatch.name}". Gunakan kode lain.`,
      { itemCode: `Kode "${normalizedInput.itemCode}" sudah dipakai.` },
    );
  }

  const isEquipment = normalizedInput.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;
  const openingQty = isEquipment
    ? Math.max(0, Math.round(normalizedInput.openingQuantity))
    : roundInventoryQuantity(normalizedInput.openingQuantity);
  const hasOpeningStock = openingQty > 0;

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [existingItem, existingMovement] = await Promise.all([
      tx.getItem(cleanItemId),
      hasOpeningStock ? tx.getMovement(cleanMovementId) : Promise.resolve(null),
    ]);

    if (existingItem) {
      // Idempotent replay when client retries exact create operationId
      return {
        item: existingItem,
        openingMovement: existingMovement,
        replayed: true,
      };
    }

    const now = tx.nowValue();
    const consumableStock = isEquipment ? null : { onHandQuantity: openingQty };
    const equipmentStock = isEquipment
      ? {
          availableQuantity: openingQty,
          maintenanceQuantity: 0,
          damagedQuantity: 0,
          retiredQuantity: 0,
        }
      : null;

    const lowStock =
      !isEquipment && consumableStock.onHandQuantity <= normalizedInput.minimumStockQuantity;

    const itemPayload = {
      itemCode: normalizedInput.itemCode,
      normalizedCode: normalizedInput.normalizedCode,
      name: normalizedInput.name,
      normalizedName: normalizedInput.normalizedName,
      itemType: normalizedInput.itemType,
      categoryId: normalizedInput.categoryId,
      categoryLabel: normalizedInput.categoryLabel,
      unit: normalizedInput.unit,
      customUnitLabel: normalizedInput.customUnitLabel,
      locationId: normalizedInput.locationId,
      locationLabel: normalizedInput.locationLabel,
      brand: normalizedInput.brand,
      model: normalizedInput.model,
      notes: normalizedInput.notes,
      minimumStockQuantity: normalizedInput.minimumStockQuantity,
      minimumAvailableQuantity: normalizedInput.minimumAvailableQuantity,
      lowStock,
      inMaintenance: false,
      hasDamagedOrRetired: false,
      consumableStock,
      equipmentStock,
      lastMaintenanceDate: normalizedInput.lastMaintenanceDate,
      nextMaintenanceDate: normalizedInput.nextMaintenanceDate,
      maintenanceIntervalDays: normalizedInput.maintenanceIntervalDays,
      isActive: true,
      lastMovementId: hasOpeningStock ? cleanMovementId : null,
      lastMovementAt: hasOpeningStock ? now : null,
      createdAt: now,
      createdByUid: cleanActorUid,
      updatedAt: now,
      updatedByUid: cleanActorUid,
      version: 1,
    };

    let movementPayload = null;
    if (hasOpeningStock) {
      movementPayload = {
        itemId: cleanItemId,
        itemCode: normalizedInput.itemCode,
        itemNameSnapshot: normalizedInput.name,
        itemType: normalizedInput.itemType,
        movementType: INVENTORY_MOVEMENT_TYPES.OPENING_STOCK,
        quantity: openingQty,
        unit: resolveUnitDisplayLabel(normalizedInput.unit, normalizedInput.customUnitLabel),
        balanceBefore: isEquipment
          ? {
              availableQuantity: 0,
              maintenanceQuantity: 0,
              damagedQuantity: 0,
              retiredQuantity: 0,
            }
          : { onHandQuantity: 0 },
        balanceAfter: isEquipment
          ? {
              availableQuantity: openingQty,
              maintenanceQuantity: 0,
              damagedQuantity: 0,
              retiredQuantity: 0,
            }
          : { onHandQuantity: openingQty },
        locationBefore: null,
        locationAfter: null,
        reason: 'Opening stock',
        notes: 'Stok awal saat barang didaftarkan',
        source: INVENTORY_MOVEMENT_SOURCES.OPENING_STOCK,
        occurredAt: now,
        operationId: cleanMovementId,
        recordedByUid: cleanActorUid,
        recordedByNameSnapshot: cleanActorName,
        createdAt: now,
      };
    }

    // 2. ALL WRITES AFTER READS
    if (movementPayload) {
      tx.setMovement(cleanMovementId, movementPayload);
    }
    tx.setItem(cleanItemId, itemPayload);

    return {
      item: normalizeInventoryItemRecord(cleanItemId, itemPayload),
      openingMovement: movementPayload
        ? normalizeInventoryMovementRecord(cleanMovementId, movementPayload)
        : null,
      replayed: false,
    };
  });
}

/**
 * Updates item metadata (name, code, category, unit, location, thresholds, maintenance schedule, notes).
 * Strictly NEVER modifies current stock balances.
 * When location changes on an item that already has movement history, atomically emits a
 * `location_changed` movement record in the exact same transaction.
 */
export async function updateInventoryItemMetadata({
  itemId,
  expectedVersion,
  locationMovementId = generateOperationId('mov'),
  actorUid,
  actorName = '',
  input,
  adapter = getInventoryRepositoryAdapter(),
}) {
  const cleanActorUid = assertInventoryStaffActor(actorUid);
  const cleanActorName =
    String(actorName || '')
      .trim()
      .slice(0, 120) || cleanActorUid;
  const cleanItemId = String(itemId || '').trim();
  const cleanLocMovementId = String(locationMovementId || '').trim() || generateOperationId('mov');

  if (!cleanItemId) {
    throw createInventoryServiceError('inventory/missing-item', 'ID item inventory wajib diisi.');
  }

  const currentSnapshot = await adapter.getItemById(cleanItemId);
  if (!currentSnapshot) {
    throw createInventoryServiceError('inventory/not-found', 'Item inventory tidak ditemukan.');
  }

  const validation = validateInventoryItemEditInput(input, currentSnapshot);
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0] || 'Data pembaruan barang tidak valid.';
    throw createInventoryServiceError('inventory/validation-error', firstError, validation.errors);
  }

  const normalizedInput = validation.data;
  if (normalizedInput.normalizedCode !== currentSnapshot.normalizedCode) {
    const duplicate = await adapter.getItemByCode(normalizedInput.normalizedCode);
    if (duplicate && duplicate.id !== cleanItemId) {
      throw createInventoryServiceError(
        'inventory/duplicate-code',
        `Kode item "${normalizedInput.itemCode}" sudah dipakai oleh "${duplicate.name}".`,
        { itemCode: `Kode "${normalizedInput.itemCode}" sudah dipakai.` },
      );
    }
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [existingItem, existingLocMovement] = await Promise.all([
      tx.getItem(cleanItemId),
      tx.getMovement(cleanLocMovementId),
    ]);

    if (!existingItem) {
      throw createInventoryServiceError('inventory/not-found', 'Item inventory tidak ditemukan.');
    }

    if (existingLocMovement && existingLocMovement.itemId === cleanItemId) {
      return {
        item: existingItem,
        locationMovement: existingLocMovement,
        replayed: true,
      };
    }

    if (existingItem.isActive === false) {
      throw createInventoryServiceError(
        'inventory/archived-item',
        'Item yang sudah diarsipkan tidak dapat diedit. Aktifkan kembali terlebih dahulu.',
      );
    }

    if (typeof expectedVersion === 'number' && existingItem.version !== expectedVersion) {
      throw createInventoryServiceError(
        'inventory/stale-version',
        'Data barang baru saja berubah oleh pengguna lain. Muat ulang lalu coba simpan lagi.',
      );
    }

    const locationChanged =
      existingItem.locationId !== normalizedInput.locationId ||
      String(existingItem.locationLabel || '')
        .trim()
        .toLowerCase() !== normalizedInput.locationLabel.trim().toLowerCase();
    const hasMovementHistory = Boolean(existingItem.lastMovementId);
    const shouldEmitLocationMovement = locationChanged && hasMovementHistory;

    const now = tx.nowValue();
    const isEquipment = existingItem.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;
    const lowStock =
      !isEquipment &&
      roundInventoryQuantity(existingItem.consumableStock?.onHandQuantity || 0) <=
        normalizedInput.minimumStockQuantity;

    const updatePayload = {
      itemCode: normalizedInput.itemCode,
      normalizedCode: normalizedInput.normalizedCode,
      name: normalizedInput.name,
      normalizedName: normalizedInput.normalizedName,
      categoryId: normalizedInput.categoryId,
      categoryLabel: normalizedInput.categoryLabel,
      unit: normalizedInput.unit,
      customUnitLabel: normalizedInput.customUnitLabel,
      locationId: normalizedInput.locationId,
      locationLabel: normalizedInput.locationLabel,
      brand: normalizedInput.brand,
      model: normalizedInput.model,
      notes: normalizedInput.notes,
      minimumStockQuantity: isEquipment ? 0 : normalizedInput.minimumStockQuantity,
      minimumAvailableQuantity: isEquipment ? normalizedInput.minimumAvailableQuantity : 0,
      lowStock,
      lastMaintenanceDate: isEquipment ? normalizedInput.lastMaintenanceDate : null,
      nextMaintenanceDate: isEquipment ? normalizedInput.nextMaintenanceDate : null,
      maintenanceIntervalDays: isEquipment ? normalizedInput.maintenanceIntervalDays : null,
      updatedAt: now,
      updatedByUid: cleanActorUid,
      version: existingItem.version + 1,
    };

    let locMovementPayload = null;
    if (shouldEmitLocationMovement) {
      const currentBalance = isEquipment
        ? { ...existingItem.equipmentStock }
        : {
            onHandQuantity: roundInventoryQuantity(
              existingItem.consumableStock?.onHandQuantity || 0,
            ),
          };

      locMovementPayload = {
        itemId: cleanItemId,
        itemCode: normalizedInput.itemCode,
        itemNameSnapshot: normalizedInput.name,
        itemType: existingItem.itemType,
        movementType: INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED,
        quantity: 0,
        unit: resolveUnitDisplayLabel(normalizedInput.unit, normalizedInput.customUnitLabel),
        balanceBefore: { ...currentBalance },
        balanceAfter: { ...currentBalance },
        locationBefore: {
          locationId: existingItem.locationId,
          locationLabel: existingItem.locationLabel,
        },
        locationAfter: {
          locationId: normalizedInput.locationId,
          locationLabel: normalizedInput.locationLabel,
        },
        reason: 'Location updated',
        notes: `Pindah dari ${existingItem.locationLabel} ke ${normalizedInput.locationLabel}`,
        source: INVENTORY_MOVEMENT_SOURCES.LOCATION_CHANGE,
        occurredAt: now,
        operationId: cleanLocMovementId,
        recordedByUid: cleanActorUid,
        recordedByNameSnapshot: cleanActorName,
        createdAt: now,
      };

      updatePayload.lastMovementId = cleanLocMovementId;
      updatePayload.lastMovementAt = now;
    }

    // 2. ALL WRITES AFTER READS
    if (locMovementPayload) {
      tx.setMovement(cleanLocMovementId, locMovementPayload);
    }
    tx.updateItem(cleanItemId, updatePayload);

    return {
      item: normalizeInventoryItemRecord(cleanItemId, {
        ...existingItem,
        ...updatePayload,
      }),
      locationMovement: locMovementPayload
        ? normalizeInventoryMovementRecord(cleanLocMovementId, locMovementPayload)
        : null,
      replayed: false,
    };
  });
}

/**
 * Soft-archives an item (`isActive = false`, allowed only when active operational stock is 0)
 * or reactivates an archived item (`isActive = true`, Owner only).
 */
export async function setInventoryItemArchiveStatus({
  itemId,
  expectedVersion,
  archived,
  actorUid,
  actorRole = 'staff',
  adapter = getInventoryRepositoryAdapter(),
}) {
  const cleanItemId = String(itemId || '').trim();
  if (!cleanItemId) {
    throw createInventoryServiceError('inventory/missing-item', 'ID item inventory wajib diisi.');
  }

  const cleanActorUid = archived
    ? assertInventoryStaffActor(actorUid)
    : assertInventoryOwnerActor({ actorUid, actorRole });

  return adapter.runAtomicTransaction(async (tx) => {
    const existingItem = await tx.getItem(cleanItemId);
    if (!existingItem) {
      throw createInventoryServiceError('inventory/not-found', 'Item inventory tidak ditemukan.');
    }

    if (typeof expectedVersion === 'number' && existingItem.version !== expectedVersion) {
      throw createInventoryServiceError(
        'inventory/stale-version',
        'Data barang baru saja berubah. Muat ulang lalu coba lagi.',
      );
    }

    const nextIsActive = !archived;
    if (existingItem.isActive === nextIsActive) {
      return existingItem;
    }

    if (archived) {
      const eligibility = checkArchiveEligibility(existingItem);
      if (!eligibility.allowed) {
        throw createInventoryServiceError('inventory/archive-blocked', eligibility.reason);
      }
    }

    const isEquipment = existingItem.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;
    const lowStock =
      nextIsActive &&
      !isEquipment &&
      roundInventoryQuantity(existingItem.consumableStock?.onHandQuantity || 0) <=
        roundInventoryQuantity(existingItem.minimumStockQuantity || 0);
    const inMaintenance =
      nextIsActive &&
      isEquipment &&
      Math.round(Number(existingItem.equipmentStock?.maintenanceQuantity) || 0) > 0;
    const hasDamagedOrRetired =
      nextIsActive &&
      isEquipment &&
      (Math.round(Number(existingItem.equipmentStock?.damagedQuantity) || 0) > 0 ||
        Math.round(Number(existingItem.equipmentStock?.retiredQuantity) || 0) > 0);

    const now = tx.nowValue();
    const updatePayload = {
      isActive: nextIsActive,
      lowStock,
      inMaintenance,
      hasDamagedOrRetired,
      updatedAt: now,
      updatedByUid: cleanActorUid,
      version: existingItem.version + 1,
    };

    tx.updateItem(cleanItemId, updatePayload);

    return normalizeInventoryItemRecord(cleanItemId, {
      ...existingItem,
      ...updatePayload,
    });
  });
}
