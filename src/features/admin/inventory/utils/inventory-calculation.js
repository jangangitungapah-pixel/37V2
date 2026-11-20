/**
 * Pure Inventory state transition math, validation guards, archive eligibility,
 * code suggestion, and directory/activity filtering.
 */

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';

import {
  getLocationOptionById,
  INVENTORY_ITEM_TYPES,
  INVENTORY_MOVEMENT_SOURCES,
  INVENTORY_MOVEMENT_TYPES,
} from '../config/inventory-config';
import { hasAtMostThreeDecimals, roundInventoryQuantity } from './inventory-format';
import { deriveInventoryItemStatusMeta, isConsumableLowStockOrEmpty } from './inventory-status';

function createTransitionError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toJakartaDateStringFromTimestamp(value) {
  const ms = getTimestampMillis(value);
  if (!ms) return '';
  return getJakartaTodayIso(new Date(ms));
}

/**
 * Resolves normalized `{ locationId, locationLabel }` from dialog/form selection.
 */
export function resolveInventoryLocation({
  locationId = 'storage',
  customLocationLabel = '',
} = {}) {
  const cleanId = String(locationId || 'storage').trim() || 'storage';
  if (cleanId === 'other') {
    const customLabel = String(customLocationLabel || '').trim();
    return {
      locationId: 'other',
      locationLabel: customLabel || 'Other',
    };
  }
  const opt = getLocationOptionById(cleanId);
  return {
    locationId: opt.id,
    locationLabel: opt.label,
  };
}

/**
 * Generates next sequential `INV-001` style item code avoiding collisions with loaded codes.
 */
export function suggestNextItemCode(existingItems = []) {
  let maxNumber = 0;
  const used = new Set();

  for (const item of existingItems || []) {
    const code = String(item?.itemCode || '')
      .trim()
      .toUpperCase();
    if (!code) continue;
    used.add(code);
    const match = /^INV-(\d+)$/.exec(code);
    if (match) {
      const n = Number(match[1]);
      if (Number.isInteger(n) && n > maxNumber) {
        maxNumber = n;
      }
    }
  }

  let candidateNum = maxNumber + 1;
  while (candidateNum < maxNumber + 500) {
    const candidate = `INV-${String(candidateNum).padStart(3, '0')}`;
    if (!used.has(candidate)) {
      return candidate;
    }
    candidateNum += 1;
  }

  return `INV-${String(Date.now()).slice(-4)}`;
}

/**
 * Checks whether an inventory item is allowed to be archived (`isActive = false`).
 * Archived items must have zero active stock across operational buckets.
 */
export function checkArchiveEligibility(item) {
  if (!item) {
    return { allowed: false, reason: 'Item inventory tidak ditemukan.' };
  }

  if (item.itemType === INVENTORY_ITEM_TYPES.CONSUMABLE) {
    const onHand = roundInventoryQuantity(item.consumableStock?.onHandQuantity || 0);
    if (onHand > 0) {
      return {
        allowed: false,
        reason: `Item consumable tidak dapat diarsipkan karena masih memiliki stok ${onHand}. Catat pemakaian (Usage) atau Write Off hingga stok menjadi 0 terlebih dahulu.`,
      };
    }
    return { allowed: true, reason: '' };
  }

  const eq = item.equipmentStock || {};
  const available = Math.max(0, Math.round(Number(eq.availableQuantity) || 0));
  const maintenance = Math.max(0, Math.round(Number(eq.maintenanceQuantity) || 0));
  const damaged = Math.max(0, Math.round(Number(eq.damagedQuantity) || 0));

  if (available > 0 || maintenance > 0 || damaged > 0) {
    const blockingParts = [];
    if (available > 0) blockingParts.push(`Available: ${available}`);
    if (maintenance > 0) blockingParts.push(`Maintenance: ${maintenance}`);
    if (damaged > 0) blockingParts.push(`Damaged: ${damaged}`);
    return {
      allowed: false,
      reason: `Equipment tidak dapat diarsipkan karena masih memiliki unit aktif (${blockingParts.join(', ')}). Pindahkan ke Retired / Lost hingga ketiga status tersebut bernilai 0.`,
    };
  }

  return { allowed: true, reason: '' };
}

/**
 * Computes pure Consumable balance transition for any valid consumable movement.
 */
export function computeConsumableBalanceTransition({
  item,
  movementType,
  quantity,
  actualCountedQuantity,
  reason = '',
}) {
  const beforeQty = roundInventoryQuantity(item?.consumableStock?.onHandQuantity || 0);
  const balanceBefore = { onHandQuantity: beforeQty };
  let afterQty;
  let movementQty;
  let source = INVENTORY_MOVEMENT_SOURCES.MANUAL;

  if (movementType === INVENTORY_MOVEMENT_TYPES.STOCK_IN) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0 || !hasAtMostThreeDecimals(qty)) {
      throw createTransitionError(
        'inventory/invalid-quantity',
        'Jumlah Stock In harus lebih besar dari 0 (maksimal 3 angka di belakang koma).',
      );
    }
    movementQty = roundInventoryQuantity(qty);
    afterQty = roundInventoryQuantity(beforeQty + movementQty);
  } else if (
    movementType === INVENTORY_MOVEMENT_TYPES.CONSUME ||
    movementType === INVENTORY_MOVEMENT_TYPES.WRITE_OFF
  ) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0 || !hasAtMostThreeDecimals(qty)) {
      throw createTransitionError(
        'inventory/invalid-quantity',
        'Jumlah pengurangan harus lebih besar dari 0 (maksimal 3 angka di belakang koma).',
      );
    }
    movementQty = roundInventoryQuantity(qty);
    if (movementQty > beforeQty) {
      throw createTransitionError(
        'inventory/insufficient-stock',
        `Stok tidak mencukupi. Stok tersedia saat ini ${beforeQty}, tidak dapat dikurangi ${movementQty}.`,
      );
    }
    afterQty = roundInventoryQuantity(Math.max(0, beforeQty - movementQty));
  } else if (movementType === INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT) {
    const counted = Number(actualCountedQuantity);
    if (!Number.isFinite(counted) || counted < 0 || !hasAtMostThreeDecimals(counted)) {
      throw createTransitionError(
        'inventory/invalid-quantity',
        'Jumlah hasil hitung fisik tidak boleh negatif (maksimal 3 angka di belakang koma).',
      );
    }
    if (String(reason || '').trim().length < 3) {
      throw createTransitionError(
        'inventory/reason-required',
        'Alasan koreksi stok (Stock Adjustment) wajib diisi minimal 3 karakter.',
      );
    }
    afterQty = roundInventoryQuantity(counted);
    const delta = roundInventoryQuantity(afterQty - beforeQty);
    if (delta === 0) {
      throw createTransitionError(
        'inventory/no-quantity-change',
        'Jumlah hitung fisik sama dengan catatan saat ini. Tidak ada perubahan stok.',
      );
    }
    movementQty = roundInventoryQuantity(Math.abs(delta));
    source = INVENTORY_MOVEMENT_SOURCES.STOCK_ADJUSTMENT;
  } else {
    throw createTransitionError(
      'inventory/invalid-movement-type',
      `Tipe pergerakan "${movementType}" tidak berlaku untuk barang Consumable.`,
    );
  }

  const nextLowStock = afterQty <= roundInventoryQuantity(item?.minimumStockQuantity || 0);

  return {
    quantity: movementQty,
    balanceBefore,
    balanceAfter: { onHandQuantity: afterQty },
    lowStock: nextLowStock,
    inMaintenance: false,
    hasDamagedOrRetired: false,
    source,
  };
}

/**
 * Computes pure Equipment bucket transition for all equipment movements.
 */
export function computeEquipmentBalanceTransition({
  item,
  movementType,
  quantity,
  sourceBucket = 'available',
  adjustmentBucket = 'available',
  actualCountedQuantity,
  reason = '',
  notes = '',
}) {
  const eq = item?.equipmentStock || {};
  const before = {
    availableQuantity: Math.max(0, Math.round(Number(eq.availableQuantity) || 0)),
    maintenanceQuantity: Math.max(0, Math.round(Number(eq.maintenanceQuantity) || 0)),
    damagedQuantity: Math.max(0, Math.round(Number(eq.damagedQuantity) || 0)),
    retiredQuantity: Math.max(0, Math.round(Number(eq.retiredQuantity) || 0)),
  };

  const after = { ...before };
  let movementQty;
  let source = INVENTORY_MOVEMENT_SOURCES.MANUAL;

  const assertPositiveInt = (raw) => {
    const num = Number(raw);
    if (!Number.isInteger(num) || num <= 0) {
      throw createTransitionError(
        'inventory/invalid-quantity',
        'Jumlah unit Equipment harus berupa bilangan bulat lebih besar dari 0.',
      );
    }
    return num;
  };

  if (movementType === INVENTORY_MOVEMENT_TYPES.STOCK_IN) {
    movementQty = assertPositiveInt(quantity);
    after.availableQuantity += movementQty;
  } else if (movementType === INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE) {
    movementQty = assertPositiveInt(quantity);
    if (movementQty > before.availableQuantity) {
      throw createTransitionError(
        'inventory/insufficient-stock',
        `Unit Available tidak mencukupi (tersedia ${before.availableQuantity}, diminta ${movementQty}).`,
      );
    }
    after.availableQuantity -= movementQty;
    after.maintenanceQuantity += movementQty;
  } else if (movementType === INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE) {
    movementQty = assertPositiveInt(quantity);
    if (movementQty > before.maintenanceQuantity) {
      throw createTransitionError(
        'inventory/insufficient-stock',
        `Unit dalam Maintenance hanya ${before.maintenanceQuantity}, tidak dapat mengembalikan ${movementQty} unit.`,
      );
    }
    after.maintenanceQuantity -= movementQty;
    after.availableQuantity += movementQty;
  } else if (movementType === INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED) {
    movementQty = assertPositiveInt(quantity);
    if (sourceBucket === 'maintenance') {
      if (movementQty > before.maintenanceQuantity) {
        throw createTransitionError(
          'inventory/insufficient-stock',
          `Unit Maintenance hanya ${before.maintenanceQuantity}, tidak dapat menandai rusak ${movementQty} unit.`,
        );
      }
      after.maintenanceQuantity -= movementQty;
    } else {
      if (movementQty > before.availableQuantity) {
        throw createTransitionError(
          'inventory/insufficient-stock',
          `Unit Available hanya ${before.availableQuantity}, tidak dapat menandai rusak ${movementQty} unit.`,
        );
      }
      after.availableQuantity -= movementQty;
    }
    after.damagedQuantity += movementQty;
  } else if (movementType === INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED) {
    movementQty = assertPositiveInt(quantity);
    if (movementQty > before.damagedQuantity) {
      throw createTransitionError(
        'inventory/insufficient-stock',
        `Unit Damaged hanya ${before.damagedQuantity}, tidak dapat menandai selesai diperbaiki ${movementQty} unit.`,
      );
    }
    if (String(notes || '').trim().length < 3) {
      throw createTransitionError(
        'inventory/repair-note-required',
        'Catatan perbaikan wajib diisi minimal 3 karakter saat menandai alat selesai diperbaiki.',
      );
    }
    after.damagedQuantity -= movementQty;
    after.availableQuantity += movementQty;
  } else if (movementType === INVENTORY_MOVEMENT_TYPES.MARK_RETIRED) {
    movementQty = assertPositiveInt(quantity);
    if (sourceBucket === 'damaged') {
      if (movementQty > before.damagedQuantity) {
        throw createTransitionError(
          'inventory/insufficient-stock',
          `Unit Damaged hanya ${before.damagedQuantity}, tidak dapat memensiunkan ${movementQty} unit.`,
        );
      }
      after.damagedQuantity -= movementQty;
    } else {
      if (movementQty > before.availableQuantity) {
        throw createTransitionError(
          'inventory/insufficient-stock',
          `Unit Available hanya ${before.availableQuantity}, tidak dapat memensiunkan ${movementQty} unit.`,
        );
      }
      after.availableQuantity -= movementQty;
    }
    after.retiredQuantity += movementQty;
  } else if (movementType === INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT) {
    const counted = Number(actualCountedQuantity);
    if (!Number.isInteger(counted) || counted < 0) {
      throw createTransitionError(
        'inventory/invalid-quantity',
        'Jumlah unit hitung fisik Equipment harus berupa bilangan bulat 0 atau lebih.',
      );
    }
    if (String(reason || '').trim().length < 3) {
      throw createTransitionError(
        'inventory/reason-required',
        'Alasan koreksi stok (Stock Adjustment) wajib diisi minimal 3 karakter.',
      );
    }

    const bucketField =
      adjustmentBucket === 'maintenance'
        ? 'maintenanceQuantity'
        : adjustmentBucket === 'damaged'
          ? 'damagedQuantity'
          : 'availableQuantity';

    const oldBucketQty = before[bucketField];
    const diff = counted - oldBucketQty;
    if (diff === 0) {
      throw createTransitionError(
        'inventory/no-quantity-change',
        'Jumlah hitung fisik sama dengan catatan bucket saat ini. Tidak ada perubahan stok.',
      );
    }
    after[bucketField] = counted;
    movementQty = Math.abs(diff);
    source = INVENTORY_MOVEMENT_SOURCES.STOCK_ADJUSTMENT;
  } else {
    throw createTransitionError(
      'inventory/invalid-movement-type',
      `Tipe pergerakan "${movementType}" tidak berlaku untuk Equipment.`,
    );
  }

  return {
    quantity: movementQty,
    balanceBefore: before,
    balanceAfter: after,
    lowStock: false,
    inMaintenance: after.maintenanceQuantity > 0,
    hasDamagedOrRetired: after.damagedQuantity > 0 || after.retiredQuantity > 0,
    source,
  };
}

/**
 * Unified balance / location transition dispatcher for an active Inventory item.
 */
export function computeInventoryMovementTransition(params) {
  const { item, movementType } = params;
  if (!item) {
    throw createTransitionError('inventory/not-found', 'Item inventory tidak ditemukan.');
  }
  if (item.isActive === false) {
    throw createTransitionError(
      'inventory/archived-item',
      'Item yang sudah diarsipkan tidak dapat menerima pergerakan stok. Aktifkan kembali terlebih dahulu.',
    );
  }

  if (movementType === INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED) {
    const oldLoc = {
      locationId: item.locationId || 'storage',
      locationLabel: item.locationLabel || 'Storage',
    };
    const nextLoc = resolveInventoryLocation({
      locationId: params.locationId,
      customLocationLabel: params.customLocationLabel,
    });
    if (
      oldLoc.locationId === nextLoc.locationId &&
      oldLoc.locationLabel.trim().toLowerCase() === nextLoc.locationLabel.trim().toLowerCase()
    ) {
      throw createTransitionError(
        'inventory/no-location-change',
        'Lokasi baru sama dengan lokasi item saat ini.',
      );
    }

    const currentBalance =
      item.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT
        ? { ...item.equipmentStock }
        : { onHandQuantity: roundInventoryQuantity(item.consumableStock?.onHandQuantity || 0) };

    return {
      quantity: 0,
      balanceBefore: { ...currentBalance },
      balanceAfter: { ...currentBalance },
      locationBefore: oldLoc,
      locationAfter: nextLoc,
      lowStock: isConsumableLowStockOrEmpty(item),
      inMaintenance:
        item.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT &&
        Number(item.equipmentStock?.maintenanceQuantity || 0) > 0,
      hasDamagedOrRetired:
        item.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT &&
        (Number(item.equipmentStock?.damagedQuantity || 0) > 0 ||
          Number(item.equipmentStock?.retiredQuantity || 0) > 0),
      source: INVENTORY_MOVEMENT_SOURCES.LOCATION_CHANGE,
    };
  }

  if (item.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT) {
    return computeEquipmentBalanceTransition(params);
  }

  return computeConsumableBalanceTransition(params);
}

/**
 * Filters inventory items by workspace tab, search query, type, category, location, and status.
 */
export function filterInventoryItems({
  items = [],
  workspaceTab = 'all',
  searchQuery = '',
  typeFilter = 'all',
  categoryFilter = 'all',
  locationFilter = 'all',
  statusFilter = 'all',
  todayIso = getJakartaTodayIso(),
}) {
  const normalizedQuery = String(searchQuery || '')
    .trim()
    .toLowerCase();

  return (items || []).filter((item) => {
    if (!item) return false;

    const isArchived = item.isActive === false;

    // Archived items are hidden unless statusFilter explicitly targets 'archived'
    if (statusFilter === 'archived') {
      if (!isArchived) return false;
    } else if (isArchived) {
      return false;
    }

    if (workspaceTab === 'consumables' && item.itemType !== INVENTORY_ITEM_TYPES.CONSUMABLE) {
      return false;
    }
    if (workspaceTab === 'equipment' && item.itemType !== INVENTORY_ITEM_TYPES.EQUIPMENT) {
      return false;
    }

    if (typeFilter !== 'all' && item.itemType !== typeFilter) {
      return false;
    }

    if (categoryFilter !== 'all' && item.categoryId !== categoryFilter) {
      return false;
    }

    if (locationFilter !== 'all' && item.locationId !== locationFilter) {
      return false;
    }

    if (statusFilter !== 'all' && statusFilter !== 'archived') {
      const statusMeta = deriveInventoryItemStatusMeta(item, todayIso);
      if (!statusMeta.filterMatches.has(statusFilter)) {
        return false;
      }
    }

    if (normalizedQuery) {
      const haystack = [
        item.name,
        item.itemCode,
        item.brand,
        item.model,
        item.categoryLabel,
        item.locationLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filters global inventory movements for the Activity tab.
 */
export function filterInventoryMovements({
  movements = [],
  itemsById = new Map(),
  dateFrom = '',
  dateTo = '',
  itemType = 'all',
  movementType = 'all',
  categoryId = 'all',
  searchQuery = '',
}) {
  const normalizedQuery = String(searchQuery || '')
    .trim()
    .toLowerCase();

  return (movements || []).filter((mov) => {
    if (!mov) return false;

    if (itemType !== 'all' && mov.itemType !== itemType) {
      return false;
    }

    if (movementType !== 'all' && mov.movementType !== movementType) {
      return false;
    }

    if (categoryId !== 'all') {
      const itemRecord = itemsById.get(mov.itemId);
      if (!itemRecord || itemRecord.categoryId !== categoryId) {
        return false;
      }
    }

    if (dateFrom || dateTo) {
      const movDate = toJakartaDateStringFromTimestamp(mov.occurredAt || mov.createdAt);
      if (dateFrom && (!movDate || movDate < dateFrom)) return false;
      if (dateTo && (!movDate || movDate > dateTo)) return false;
    }

    if (normalizedQuery) {
      const haystack = [
        mov.itemNameSnapshot,
        mov.itemCode,
        mov.reason,
        mov.notes,
        mov.recordedByNameSnapshot,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });
}
