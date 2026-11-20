/**
 * Zod Validation Schemas and Firestore Document Normalizers for Inventory Module.
 */

import { z } from 'zod';

import { isValidIsoDateString } from '@/features/admin/calendar/utils/calendar-date';

import {
  getCategoryById,
  INVENTORY_CATEGORIES,
  INVENTORY_ITEM_TYPES,
  INVENTORY_LOCATION_IDS,
  INVENTORY_MOVEMENT_SOURCES,
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_UNIT_IDS,
} from '../config/inventory-config';
import { resolveInventoryLocation } from '../utils/inventory-calculation';
import { hasAtMostThreeDecimals, roundInventoryQuantity } from '../utils/inventory-format';

const CATEGORY_IDS = INVENTORY_CATEGORIES.map((c) => c.id);
const ITEM_CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

export function normalizeItemName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeItemCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
}

const baseItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nama barang minimal 2 karakter.')
    .max(120, 'Nama barang maksimal 120 karakter.'),
  itemCode: z
    .string()
    .trim()
    .transform((val) => normalizeItemCode(val))
    .refine((val) => ITEM_CODE_REGEX.test(val), {
      message: 'Kode item harus 2-32 karakter (huruf kapital, angka, tanda "-" atau "_").',
    }),
  itemType: z.enum([INVENTORY_ITEM_TYPES.CONSUMABLE, INVENTORY_ITEM_TYPES.EQUIPMENT]),
  categoryId: z.enum(CATEGORY_IDS, {
    message: 'Pilih kategori barang yang valid.',
  }),
  unit: z.enum(INVENTORY_UNIT_IDS, {
    message: 'Pilih satuan barang yang valid.',
  }),
  customUnitLabel: z
    .string()
    .trim()
    .max(40, 'Satuan custom maksimal 40 karakter.')
    .optional()
    .default(''),
  locationId: z.enum(INVENTORY_LOCATION_IDS, {
    message: 'Pilih lokasi penyimpanan yang valid.',
  }),
  customLocationLabel: z
    .string()
    .trim()
    .max(60, 'Nama lokasi custom maksimal 60 karakter.')
    .optional()
    .default(''),
  brand: z.string().trim().max(80, 'Brand maksimal 80 karakter.').optional().default(''),
  model: z.string().trim().max(80, 'Model maksimal 80 karakter.').optional().default(''),
  notes: z.string().trim().max(1000, 'Catatan maksimal 1000 karakter.').optional().default(''),
  minimumStockQuantity: z.coerce.number().min(0, 'Minimum stok tidak boleh negatif.').default(0),
  minimumAvailableQuantity: z.coerce
    .number()
    .int('Minimum unit available harus bilangan bulat.')
    .min(0, 'Minimum unit available tidak boleh negatif.')
    .default(0),
  openingQuantity: z.coerce.number().min(0, 'Stok awal tidak boleh negatif.').default(0),
  lastMaintenanceDate: z.string().trim().optional().default(''),
  nextMaintenanceDate: z.string().trim().optional().default(''),
  maintenanceIntervalDays: z.union([z.string(), z.number(), z.null()]).optional().default(''),
});

function validateConditionalItemFields(parsed, mode = 'create') {
  const errors = {};
  const data = parsed.data;

  if (data.unit === 'other' && String(data.customUnitLabel || '').trim().length < 1) {
    errors.customUnitLabel = 'Isi label satuan custom ketika memilih "Other".';
  }

  if (data.locationId === 'other' && String(data.customLocationLabel || '').trim().length < 2) {
    errors.customLocationLabel = 'Isi nama lokasi custom minimal 2 karakter.';
  }

  if (data.itemType === INVENTORY_ITEM_TYPES.CONSUMABLE) {
    if (!hasAtMostThreeDecimals(data.minimumStockQuantity)) {
      errors.minimumStockQuantity = 'Minimum stok maksimal 3 angka di belakang koma.';
    }
    if (mode === 'create' && !hasAtMostThreeDecimals(data.openingQuantity)) {
      errors.openingQuantity = 'Opening quantity maksimal 3 angka di belakang koma.';
    }
  } else {
    if (mode === 'create' && !Number.isInteger(Number(data.openingQuantity))) {
      errors.openingQuantity = 'Opening quantity untuk Equipment harus berupa bilangan bulat.';
    }

    if (data.lastMaintenanceDate && !isValidIsoDateString(data.lastMaintenanceDate)) {
      errors.lastMaintenanceDate = 'Format Last Maintenance Date tidak valid (YYYY-MM-DD).';
    }
    if (data.nextMaintenanceDate && !isValidIsoDateString(data.nextMaintenanceDate)) {
      errors.nextMaintenanceDate = 'Format Next Maintenance Date tidak valid (YYYY-MM-DD).';
    }
    if (
      data.lastMaintenanceDate &&
      data.nextMaintenanceDate &&
      isValidIsoDateString(data.lastMaintenanceDate) &&
      isValidIsoDateString(data.nextMaintenanceDate) &&
      data.nextMaintenanceDate < data.lastMaintenanceDate
    ) {
      errors.nextMaintenanceDate =
        'Next Maintenance Date tidak boleh lebih awal dari Last Maintenance Date.';
    }

    const rawInterval = String(data.maintenanceIntervalDays ?? '').trim();
    if (rawInterval !== '') {
      const intervalNum = Number(rawInterval);
      if (!Number.isInteger(intervalNum) || intervalNum < 1 || intervalNum > 3650) {
        errors.maintenanceIntervalDays =
          'Interval perawatan harus bilangan bulat antara 1–3650 hari.';
      }
    }
  }

  return errors;
}

function formatNormalizedFormOutput(data) {
  const category = getCategoryById(data.categoryId);
  const location = resolveInventoryLocation({
    locationId: data.locationId,
    customLocationLabel: data.customLocationLabel,
  });

  const isEquipment = data.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;
  const rawInterval = String(data.maintenanceIntervalDays ?? '').trim();
  const parsedInterval = isEquipment && rawInterval !== '' ? Number(rawInterval) : null;

  return {
    name: data.name,
    normalizedName: normalizeItemName(data.name),
    itemCode: normalizeItemCode(data.itemCode),
    normalizedCode: normalizeItemCode(data.itemCode).toLowerCase(),
    itemType: data.itemType,
    categoryId: category.id,
    categoryLabel: category.label,
    unit: data.unit,
    customUnitLabel: data.unit === 'other' ? data.customUnitLabel.trim() : '',
    locationId: location.locationId,
    locationLabel: location.locationLabel,
    brand: data.brand,
    model: data.model,
    notes: data.notes,
    minimumStockQuantity: isEquipment ? 0 : roundInventoryQuantity(data.minimumStockQuantity),
    minimumAvailableQuantity: isEquipment
      ? Math.round(Number(data.minimumAvailableQuantity) || 0)
      : 0,
    openingQuantity: isEquipment
      ? Math.round(Number(data.openingQuantity) || 0)
      : roundInventoryQuantity(data.openingQuantity),
    lastMaintenanceDate: isEquipment && data.lastMaintenanceDate ? data.lastMaintenanceDate : null,
    nextMaintenanceDate: isEquipment && data.nextMaintenanceDate ? data.nextMaintenanceDate : null,
    maintenanceIntervalDays: parsedInterval,
  };
}

/**
 * Validates Item creation input (with optional Opening Stock).
 */
export function validateInventoryItemCreateInput(input = {}) {
  const parsed = baseItemSchema.safeParse({
    name: String(input.name ?? ''),
    itemCode: String(input.itemCode ?? ''),
    itemType: input.itemType || INVENTORY_ITEM_TYPES.CONSUMABLE,
    categoryId: input.categoryId || 'other',
    unit: input.unit || 'pcs',
    customUnitLabel: String(input.customUnitLabel ?? ''),
    locationId: input.locationId || 'storage',
    customLocationLabel: String(input.customLocationLabel ?? ''),
    brand: String(input.brand ?? ''),
    model: String(input.model ?? ''),
    notes: String(input.notes ?? ''),
    minimumStockQuantity: input.minimumStockQuantity ?? 0,
    minimumAvailableQuantity: input.minimumAvailableQuantity ?? 0,
    openingQuantity: input.openingQuantity ?? 0,
    lastMaintenanceDate: String(input.lastMaintenanceDate ?? ''),
    nextMaintenanceDate: String(input.nextMaintenanceDate ?? ''),
    maintenanceIntervalDays: input.maintenanceIntervalDays ?? '',
  });

  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] || 'form');
      if (!errors[key]) errors[key] = issue.message;
    }
    return { isValid: false, errors, data: null };
  }

  const conditionalErrors = validateConditionalItemFields(parsed, 'create');
  if (Object.keys(conditionalErrors).length > 0) {
    return { isValid: false, errors: conditionalErrors, data: null };
  }

  return {
    isValid: true,
    errors: {},
    data: formatNormalizedFormOutput(parsed.data),
  };
}

/**
 * Validates Item metadata editing input (never includes current stock quantity).
 */
export function validateInventoryItemEditInput(input = {}, existingItem = null) {
  const itemType = existingItem?.itemType || input.itemType || INVENTORY_ITEM_TYPES.CONSUMABLE;
  const parsed = baseItemSchema.safeParse({
    name: String(input.name ?? ''),
    itemCode: String(input.itemCode ?? existingItem?.itemCode ?? ''),
    itemType,
    categoryId: input.categoryId || existingItem?.categoryId || 'other',
    unit: input.unit || existingItem?.unit || 'pcs',
    customUnitLabel: String(input.customUnitLabel ?? ''),
    locationId: input.locationId || existingItem?.locationId || 'storage',
    customLocationLabel: String(input.customLocationLabel ?? ''),
    brand: String(input.brand ?? ''),
    model: String(input.model ?? ''),
    notes: String(input.notes ?? ''),
    minimumStockQuantity: input.minimumStockQuantity ?? 0,
    minimumAvailableQuantity: input.minimumAvailableQuantity ?? 0,
    openingQuantity: 0,
    lastMaintenanceDate: String(input.lastMaintenanceDate ?? ''),
    nextMaintenanceDate: String(input.nextMaintenanceDate ?? ''),
    maintenanceIntervalDays: input.maintenanceIntervalDays ?? '',
  });

  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] || 'form');
      if (!errors[key]) errors[key] = issue.message;
    }
    return { isValid: false, errors, data: null };
  }

  const conditionalErrors = validateConditionalItemFields(parsed, 'edit');
  if (Object.keys(conditionalErrors).length > 0) {
    return { isValid: false, errors: conditionalErrors, data: null };
  }

  return {
    isValid: true,
    errors: {},
    data: formatNormalizedFormOutput(parsed.data),
  };
}

/**
 * Normalizes a raw Firestore `inventoryItems/{itemId}` record cleanly.
 */
export function normalizeInventoryItemRecord(id, raw = {}) {
  const cleanId = String(id || raw.id || '').trim();
  const itemType =
    raw.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT
      ? INVENTORY_ITEM_TYPES.EQUIPMENT
      : INVENTORY_ITEM_TYPES.CONSUMABLE;
  const category = getCategoryById(raw.categoryId);
  const minimumStockQuantity =
    itemType === INVENTORY_ITEM_TYPES.CONSUMABLE
      ? roundInventoryQuantity(raw.minimumStockQuantity || 0)
      : 0;
  const minimumAvailableQuantity =
    itemType === INVENTORY_ITEM_TYPES.EQUIPMENT
      ? Math.max(0, Math.round(Number(raw.minimumAvailableQuantity) || 0))
      : 0;

  const consumableStock =
    itemType === INVENTORY_ITEM_TYPES.CONSUMABLE
      ? {
          onHandQuantity: roundInventoryQuantity(raw.consumableStock?.onHandQuantity || 0),
        }
      : null;

  const equipmentStock =
    itemType === INVENTORY_ITEM_TYPES.EQUIPMENT
      ? {
          availableQuantity: Math.max(
            0,
            Math.round(Number(raw.equipmentStock?.availableQuantity) || 0),
          ),
          maintenanceQuantity: Math.max(
            0,
            Math.round(Number(raw.equipmentStock?.maintenanceQuantity) || 0),
          ),
          damagedQuantity: Math.max(
            0,
            Math.round(Number(raw.equipmentStock?.damagedQuantity) || 0),
          ),
          retiredQuantity: Math.max(
            0,
            Math.round(Number(raw.equipmentStock?.retiredQuantity) || 0),
          ),
        }
      : null;

  const isActive = raw.isActive !== false;
  const computedLowStock =
    isActive &&
    itemType === INVENTORY_ITEM_TYPES.CONSUMABLE &&
    consumableStock.onHandQuantity <= minimumStockQuantity;

  const computedInMaintenance =
    isActive &&
    itemType === INVENTORY_ITEM_TYPES.EQUIPMENT &&
    equipmentStock.maintenanceQuantity > 0;

  const computedHasDamagedOrRetired =
    isActive &&
    itemType === INVENTORY_ITEM_TYPES.EQUIPMENT &&
    (equipmentStock.damagedQuantity > 0 || equipmentStock.retiredQuantity > 0);

  return {
    id: cleanId,
    itemCode: String(raw.itemCode || '').trim(),
    normalizedCode: String(raw.normalizedCode || raw.itemCode || '')
      .trim()
      .toLowerCase(),
    name: String(raw.name || '').trim(),
    normalizedName: String(raw.normalizedName || normalizeItemName(raw.name || '')).trim(),
    itemType,
    categoryId: category.id,
    categoryLabel: String(raw.categoryLabel || category.label).trim(),
    unit: String(raw.unit || 'pcs').trim(),
    customUnitLabel: String(raw.customUnitLabel || '').trim(),
    locationId: String(raw.locationId || 'storage').trim(),
    locationLabel: String(raw.locationLabel || 'Storage').trim(),
    brand: String(raw.brand || '').trim(),
    model: String(raw.model || '').trim(),
    notes: String(raw.notes || '').trim(),
    minimumStockQuantity,
    minimumAvailableQuantity,
    lowStock: typeof raw.lowStock === 'boolean' ? raw.lowStock : computedLowStock,
    inMaintenance:
      typeof raw.inMaintenance === 'boolean' ? raw.inMaintenance : computedInMaintenance,
    hasDamagedOrRetired:
      typeof raw.hasDamagedOrRetired === 'boolean'
        ? raw.hasDamagedOrRetired
        : computedHasDamagedOrRetired,
    consumableStock,
    equipmentStock,
    lastMaintenanceDate: raw.lastMaintenanceDate || null,
    nextMaintenanceDate: raw.nextMaintenanceDate || null,
    maintenanceIntervalDays:
      typeof raw.maintenanceIntervalDays === 'number' && raw.maintenanceIntervalDays > 0
        ? Math.round(raw.maintenanceIntervalDays)
        : null,
    isActive,
    lastMovementId: raw.lastMovementId || null,
    lastMovementAt: raw.lastMovementAt || null,
    createdAt: raw.createdAt || null,
    createdByUid: String(raw.createdByUid || '').trim(),
    updatedAt: raw.updatedAt || null,
    updatedByUid: String(raw.updatedByUid || '').trim(),
    version: Math.max(1, Math.round(Number(raw.version) || 1)),
  };
}

/**
 * Normalizes a raw Firestore `inventoryMovements/{movementId}` document cleanly.
 */
export function normalizeInventoryMovementRecord(id, raw = {}) {
  const cleanId = String(id || raw.id || '').trim();
  const itemType =
    raw.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT
      ? INVENTORY_ITEM_TYPES.EQUIPMENT
      : INVENTORY_ITEM_TYPES.CONSUMABLE;

  const normalizeBalance = (bal) => {
    if (!bal || typeof bal !== 'object') {
      return itemType === INVENTORY_ITEM_TYPES.EQUIPMENT
        ? {
            availableQuantity: 0,
            maintenanceQuantity: 0,
            damagedQuantity: 0,
            retiredQuantity: 0,
          }
        : { onHandQuantity: 0 };
    }
    if (itemType === INVENTORY_ITEM_TYPES.EQUIPMENT) {
      return {
        availableQuantity: Math.max(0, Math.round(Number(bal.availableQuantity) || 0)),
        maintenanceQuantity: Math.max(0, Math.round(Number(bal.maintenanceQuantity) || 0)),
        damagedQuantity: Math.max(0, Math.round(Number(bal.damagedQuantity) || 0)),
        retiredQuantity: Math.max(0, Math.round(Number(bal.retiredQuantity) || 0)),
      };
    }
    return {
      onHandQuantity: roundInventoryQuantity(bal.onHandQuantity || 0),
    };
  };

  return {
    id: cleanId,
    itemId: String(raw.itemId || '').trim(),
    itemCode: String(raw.itemCode || '').trim(),
    itemNameSnapshot: String(raw.itemNameSnapshot || '').trim(),
    itemType,
    movementType: String(raw.movementType || INVENTORY_MOVEMENT_TYPES.STOCK_IN).trim(),
    quantity:
      itemType === INVENTORY_ITEM_TYPES.EQUIPMENT
        ? Math.max(0, Math.round(Number(raw.quantity) || 0))
        : roundInventoryQuantity(raw.quantity || 0),
    unit: String(raw.unit || 'pcs').trim(),
    balanceBefore: normalizeBalance(raw.balanceBefore),
    balanceAfter: normalizeBalance(raw.balanceAfter),
    locationBefore: raw.locationBefore || null,
    locationAfter: raw.locationAfter || null,
    reason: String(raw.reason || '').trim(),
    notes: String(raw.notes || '').trim(),
    source: String(raw.source || INVENTORY_MOVEMENT_SOURCES.MANUAL).trim(),
    occurredAt: raw.occurredAt || raw.createdAt || null,
    operationId: String(raw.operationId || cleanId).trim(),
    recordedByUid: String(raw.recordedByUid || '').trim(),
    recordedByNameSnapshot: String(raw.recordedByNameSnapshot || '').trim(),
    createdAt: raw.createdAt || null,
  };
}
