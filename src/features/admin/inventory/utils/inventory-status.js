/**
 * Pure status derivation & summary metric calculations for Inventory items.
 * Ensures zero double-counting and strictly uses `Asia/Jakarta` dates.
 */

import {
  addDaysToIsoDate,
  getJakartaTodayIso,
} from '@/features/admin/calendar/utils/calendar-date';

import {
  INVENTORY_CONSUMABLE_STATUS,
  INVENTORY_EQUIPMENT_STATUS,
  INVENTORY_ITEM_TYPES,
  INVENTORY_MAINTENANCE_DUE_STATE,
  MAINTENANCE_SOON_WINDOW_DAYS,
} from '../config/inventory-config';
import { roundInventoryQuantity } from './inventory-format';

/**
 * Derives automatic Consumable status strictly from quantity vs minimum threshold:
 * - `out_of_stock`: onHandQuantity === 0
 * - `low_stock`: onHandQuantity > 0 && onHandQuantity <= minimumStockQuantity
 * - `in_stock`: onHandQuantity > minimumStockQuantity
 */
export function deriveConsumableStockStatus(item) {
  const onHand = roundInventoryQuantity(item?.consumableStock?.onHandQuantity || 0);
  const minimum = roundInventoryQuantity(item?.minimumStockQuantity || 0);

  if (onHand <= 0) {
    return INVENTORY_CONSUMABLE_STATUS.OUT_OF_STOCK;
  }
  if (onHand <= minimum) {
    return INVENTORY_CONSUMABLE_STATUS.LOW_STOCK;
  }
  return INVENTORY_CONSUMABLE_STATUS.IN_STOCK;
}

/**
 * Returns whether an active Consumable item belongs in the Low Stock alert bucket.
 */
export function isConsumableLowStockOrEmpty(item) {
  if (!item || item.isActive === false || item.itemType !== INVENTORY_ITEM_TYPES.CONSUMABLE) {
    return false;
  }
  const onHand = roundInventoryQuantity(item?.consumableStock?.onHandQuantity || 0);
  const minimum = roundInventoryQuantity(item?.minimumStockQuantity || 0);
  return onHand <= minimum;
}

/**
 * Sums all four Equipment buckets into registered total without dropping retired units.
 */
export function computeEquipmentRegisteredTotal(equipmentStock = {}) {
  const available = Math.max(0, Math.round(Number(equipmentStock?.availableQuantity) || 0));
  const maintenance = Math.max(0, Math.round(Number(equipmentStock?.maintenanceQuantity) || 0));
  const damaged = Math.max(0, Math.round(Number(equipmentStock?.damagedQuantity) || 0));
  const retired = Math.max(0, Math.round(Number(equipmentStock?.retiredQuantity) || 0));
  return available + maintenance + damaged + retired;
}

/**
 * Derives Equipment Maintenance schedule status relative to `Asia/Jakarta` today.
 */
export function deriveEquipmentMaintenanceMeta(item, todayIso = getJakartaTodayIso()) {
  if (!item || item.itemType !== INVENTORY_ITEM_TYPES.EQUIPMENT) {
    return {
      dueState: INVENTORY_MAINTENANCE_DUE_STATE.NONE,
      label: 'Tidak Dijadwalkan',
      tone: 'neutral',
      isDue: false,
      isSoon: false,
    };
  }

  const nextDate = String(item.nextMaintenanceDate || '').trim();
  if (!nextDate) {
    return {
      dueState: INVENTORY_MAINTENANCE_DUE_STATE.NONE,
      label: 'No Upcoming Maintenance',
      tone: 'neutral',
      isDue: false,
      isSoon: false,
    };
  }

  if (nextDate <= todayIso) {
    return {
      dueState: INVENTORY_MAINTENANCE_DUE_STATE.DUE,
      label: 'Maintenance Due',
      tone: 'orange',
      isDue: true,
      isSoon: false,
    };
  }

  const soonCutoff = addDaysToIsoDate(todayIso, MAINTENANCE_SOON_WINDOW_DAYS);
  if (nextDate <= soonCutoff) {
    return {
      dueState: INVENTORY_MAINTENANCE_DUE_STATE.SOON,
      label: 'Maintenance Soon',
      tone: 'amber',
      isDue: false,
      isSoon: true,
    };
  }

  return {
    dueState: INVENTORY_MAINTENANCE_DUE_STATE.SCHEDULED,
    label: 'Terjadwal',
    tone: 'ivory',
    isDue: false,
    isSoon: false,
  };
}

/**
 * Derives primary Equipment operational status and matching filter tags.
 */
export function deriveEquipmentStatusMeta(item, todayIso = getJakartaTodayIso()) {
  const stock = item?.equipmentStock || {};
  const available = Math.max(0, Math.round(Number(stock.availableQuantity) || 0));
  const maintenance = Math.max(0, Math.round(Number(stock.maintenanceQuantity) || 0));
  const damaged = Math.max(0, Math.round(Number(stock.damagedQuantity) || 0));
  const retired = Math.max(0, Math.round(Number(stock.retiredQuantity) || 0));
  const minAvail = Math.max(0, Math.round(Number(item?.minimumAvailableQuantity) || 0));
  const maintMeta = deriveEquipmentMaintenanceMeta(item, todayIso);

  const filterMatches = new Set();
  if (available > 0) filterMatches.add(INVENTORY_EQUIPMENT_STATUS.AVAILABLE);
  if (maintenance > 0) filterMatches.add(INVENTORY_EQUIPMENT_STATUS.MAINTENANCE);
  if (damaged > 0) filterMatches.add(INVENTORY_EQUIPMENT_STATUS.DAMAGED);
  if (retired > 0) filterMatches.add(INVENTORY_EQUIPMENT_STATUS.RETIRED);
  if (maintMeta.isDue) filterMatches.add(INVENTORY_EQUIPMENT_STATUS.MAINTENANCE_DUE);

  let primaryStatus = {
    id: INVENTORY_EQUIPMENT_STATUS.AVAILABLE,
    label: 'Available',
    tone: 'lime',
  };

  if (damaged > 0) {
    primaryStatus = {
      id: INVENTORY_EQUIPMENT_STATUS.DAMAGED,
      label: available > 0 ? 'Damaged Units' : 'Damaged',
      tone: 'orange',
    };
  } else if (maintenance > 0) {
    primaryStatus = {
      id: INVENTORY_EQUIPMENT_STATUS.MAINTENANCE,
      label: 'Maintenance',
      tone: 'amber',
    };
  } else if (maintMeta.isDue) {
    primaryStatus = {
      id: INVENTORY_EQUIPMENT_STATUS.MAINTENANCE_DUE,
      label: 'Maintenance Due',
      tone: 'orange',
    };
  } else if (available === 0 && retired > 0) {
    primaryStatus = {
      id: INVENTORY_EQUIPMENT_STATUS.RETIRED,
      label: 'Retired / Lost',
      tone: 'neutral',
    };
  } else if (available === 0) {
    primaryStatus = {
      id: 'empty',
      label: 'Kosong (0 Unit)',
      tone: 'neutral',
    };
  } else if (minAvail > 0 && available <= minAvail) {
    primaryStatus = {
      id: INVENTORY_EQUIPMENT_STATUS.AVAILABLE,
      label: 'Available (Minimum)',
      tone: 'amber',
    };
  }

  return {
    ...primaryStatus,
    maintMeta,
    filterMatches,
    hasMaintenanceAttention: maintenance > 0 || maintMeta.isDue,
    hasDamagedOrRetired: damaged > 0 || retired > 0,
  };
}

/**
 * Returns unified display status badge metadata for either Consumables or Equipment,
 * handling Archived items consistently.
 */
export function deriveInventoryItemStatusMeta(item, todayIso = getJakartaTodayIso()) {
  if (!item) {
    return { id: 'unknown', label: '-', tone: 'neutral', filterMatches: new Set() };
  }

  if (item.isActive === false) {
    return {
      id: 'archived',
      label: 'Archived',
      tone: 'neutral',
      filterMatches: new Set(['archived']),
      hasMaintenanceAttention: false,
      hasDamagedOrRetired: false,
    };
  }

  if (item.itemType === INVENTORY_ITEM_TYPES.CONSUMABLE) {
    const status = deriveConsumableStockStatus(item);
    const metaByStatus = {
      [INVENTORY_CONSUMABLE_STATUS.IN_STOCK]: { label: 'In Stock', tone: 'lime' },
      [INVENTORY_CONSUMABLE_STATUS.LOW_STOCK]: { label: 'Low Stock', tone: 'orange' },
      [INVENTORY_CONSUMABLE_STATUS.OUT_OF_STOCK]: { label: 'Out of Stock', tone: 'orange' },
    };
    const chosen = metaByStatus[status] || metaByStatus[INVENTORY_CONSUMABLE_STATUS.IN_STOCK];
    return {
      id: status,
      label: chosen.label,
      tone: chosen.tone,
      filterMatches: new Set([status]),
      hasMaintenanceAttention: false,
      hasDamagedOrRetired: false,
    };
  }

  return deriveEquipmentStatusMeta(item, todayIso);
}

/**
 * Computes deduplicated KPI metrics over a list of Inventory Item records.
 * Guaranteed not to double-count the same record within any metric bucket.
 */
export function computeInventorySummaryMetrics(items = [], todayIso = getJakartaTodayIso()) {
  const seenIds = new Set();
  let activeItemsCount = 0;
  let archivedItemsCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let maintenanceCount = 0;
  let damagedRetiredCount = 0;

  for (const item of items || []) {
    if (!item?.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    if (item.isActive === false) {
      archivedItemsCount += 1;
      continue;
    }

    activeItemsCount += 1;

    if (item.itemType === INVENTORY_ITEM_TYPES.CONSUMABLE) {
      const status = deriveConsumableStockStatus(item);
      if (status === INVENTORY_CONSUMABLE_STATUS.OUT_OF_STOCK) {
        lowStockCount += 1;
        outOfStockCount += 1;
      } else if (status === INVENTORY_CONSUMABLE_STATUS.LOW_STOCK) {
        lowStockCount += 1;
      }
      continue;
    }

    if (item.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT) {
      const eqMeta = deriveEquipmentStatusMeta(item, todayIso);
      if (eqMeta.hasMaintenanceAttention) {
        maintenanceCount += 1;
      }
      if (eqMeta.hasDamagedOrRetired) {
        damagedRetiredCount += 1;
      }
    }
  }

  return {
    activeItemsCount,
    archivedItemsCount,
    lowStockCount,
    outOfStockCount,
    maintenanceCount,
    damagedRetiredCount,
  };
}
