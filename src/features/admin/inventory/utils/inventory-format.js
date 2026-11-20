/**
 * Display and numeric formatting helpers for 37 Music Studio Inventory Module.
 */

import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';

import { INVENTORY_ITEM_TYPES, INVENTORY_MOVEMENT_TYPES } from '../config/inventory-config';

/**
 * Rounds consumable quantities to at most 3 decimal places without floating point noise.
 */
export function roundInventoryQuantity(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 1000) / 1000;
}

/**
 * Checks whether a numeric quantity has at most 3 decimal places.
 */
export function hasAtMostThreeDecimals(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return false;
  return Math.abs(Math.round(num * 1000) - num * 1000) < 1e-7;
}

/**
 * Resolves effective display unit label (`customUnitLabel` when `unit === 'other'`).
 */
export function resolveUnitDisplayLabel(unit, customUnitLabel = '') {
  if (unit === 'other') {
    const custom = String(customUnitLabel || '').trim();
    return custom || 'unit';
  }
  return String(unit || 'pcs').trim() || 'pcs';
}

/**
 * Formats an inventory quantity cleanly in Indonesian locale (`1.5`, `12`, `0.25`).
 */
export function formatInventoryQuantity(value, itemType = INVENTORY_ITEM_TYPES.CONSUMABLE) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  if (itemType === INVENTORY_ITEM_TYPES.EQUIPMENT) {
    return String(Math.round(num));
  }
  const rounded = roundInventoryQuantity(num);
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(rounded);
}

/**
 * Formats a concise stock quantity + unit string (e.g. `12 set`).
 */
export function formatQuantityWithUnit(
  value,
  unit,
  customUnitLabel = '',
  itemType = INVENTORY_ITEM_TYPES.CONSUMABLE,
) {
  return `${formatInventoryQuantity(value, itemType)} ${resolveUnitDisplayLabel(unit, customUnitLabel)}`;
}

/**
 * Summarizes equipment buckets for compact display and movement balance inspection.
 */
export function formatEquipmentBucketSummary(stock = {}) {
  const available = Math.max(0, Math.round(Number(stock?.availableQuantity) || 0));
  const maintenance = Math.max(0, Math.round(Number(stock?.maintenanceQuantity) || 0));
  const damaged = Math.max(0, Math.round(Number(stock?.damagedQuantity) || 0));
  const retired = Math.max(0, Math.round(Number(stock?.retiredQuantity) || 0));
  const parts = [`Avail ${available}`];
  if (maintenance > 0) parts.push(`Maint ${maintenance}`);
  if (damaged > 0) parts.push(`Dmg ${damaged}`);
  if (retired > 0) parts.push(`Ret ${retired}`);
  return parts.join(' • ');
}

/**
 * Formats movement balance before/after cleanly for History & Activity views.
 */
export function formatMovementBalanceSummary(movement) {
  if (!movement) return { before: '-', after: '-' };

  if (movement.movementType === INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED) {
    return {
      before: movement.locationBefore?.locationLabel || '-',
      after: movement.locationAfter?.locationLabel || '-',
    };
  }

  if (movement.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT) {
    return {
      before: formatEquipmentBucketSummary(movement.balanceBefore),
      after: formatEquipmentBucketSummary(movement.balanceAfter),
    };
  }

  const unitLabel = resolveUnitDisplayLabel(movement.unit);
  return {
    before: `${formatInventoryQuantity(movement.balanceBefore?.onHandQuantity || 0)} ${unitLabel}`,
    after: `${formatInventoryQuantity(movement.balanceAfter?.onHandQuantity || 0)} ${unitLabel}`,
  };
}

/**
 * Formats movement quantity change text (e.g. `+5 set`, `-2 pcs`, `3 unit`, `Moved`).
 */
export function formatMovementDeltaText(movement) {
  if (!movement) return '-';
  const type = movement.movementType;

  if (type === INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED) {
    return `${movement.locationBefore?.locationLabel || '-'} → ${movement.locationAfter?.locationLabel || '-'}`;
  }

  const unitLabel = resolveUnitDisplayLabel(movement.unit);
  const qtyText = formatInventoryQuantity(movement.quantity || 0, movement.itemType);

  if (
    type === INVENTORY_MOVEMENT_TYPES.OPENING_STOCK ||
    type === INVENTORY_MOVEMENT_TYPES.STOCK_IN
  ) {
    return `+${qtyText} ${unitLabel}`;
  }

  if (type === INVENTORY_MOVEMENT_TYPES.CONSUME || type === INVENTORY_MOVEMENT_TYPES.WRITE_OFF) {
    return `-${qtyText} ${unitLabel}`;
  }

  if (type === INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT) {
    if (movement.itemType === INVENTORY_ITEM_TYPES.CONSUMABLE) {
      const diff = roundInventoryQuantity(
        (movement.balanceAfter?.onHandQuantity || 0) -
          (movement.balanceBefore?.onHandQuantity || 0),
      );
      const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
      return `${sign}${formatInventoryQuantity(Math.abs(diff))} ${unitLabel}`;
    }
    return `Adj ${qtyText} ${unitLabel}`;
  }

  return `${qtyText} ${unitLabel}`;
}

export function formatInventoryDate(dateIso) {
  if (!dateIso) return '—';
  return formatIndonesianDateMedium(dateIso);
}

export function formatInventoryTimestamp(timestampLike) {
  if (!timestampLike) return '—';
  return formatIndonesianTimestamp(timestampLike);
}
