/**
 * Domain configuration for 37 Music Studio Operational Inventory Module.
 *
 * Strictly reuses existing room IDs from `calendar-config.js` (`room-a`, `room-b`)
 * without inventing extra studio rooms.
 */

import { STUDIO_ROOMS } from '@/features/admin/calendar/config/calendar-config';

export const INVENTORY_ITEMS_PAGE_SIZE = 50;
export const INVENTORY_ITEMS_SUMMARY_BOUND = 500;
export const INVENTORY_MOVEMENTS_PAGE_SIZE = 30;
export const INVENTORY_ITEM_HISTORY_PAGE_SIZE = 20;

export const INVENTORY_ITEM_TYPES = {
  CONSUMABLE: 'consumable',
  EQUIPMENT: 'equipment',
};

export const INVENTORY_ITEM_TYPE_OPTIONS = [
  {
    id: INVENTORY_ITEM_TYPES.CONSUMABLE,
    label: 'Consumables',
    shortLabel: 'Consumable',
    description: 'Barang habis pakai yang stoknya bertambah saat restock & berkurang saat dipakai.',
  },
  {
    id: INVENTORY_ITEM_TYPES.EQUIPMENT,
    label: 'Equipment',
    shortLabel: 'Equipment',
    description: 'Peralatan studio berulang dengan pelacakan kondisi & jadwal perawatan.',
  },
];

export const INVENTORY_CATEGORIES = [
  { id: 'instruments', label: 'Instruments' },
  { id: 'audio_recording', label: 'Audio & Recording' },
  { id: 'amplifiers_speakers', label: 'Amplifiers & Speakers' },
  { id: 'cables_connectivity', label: 'Cables & Connectivity' },
  { id: 'stands_accessories', label: 'Stands & Accessories' },
  { id: 'maintenance_cleaning', label: 'Maintenance & Cleaning' },
  { id: 'other', label: 'Other' },
];

export const INVENTORY_CATEGORY_MAP = Object.fromEntries(
  INVENTORY_CATEGORIES.map((category) => [category.id, category]),
);

export const INVENTORY_UNITS = [
  { id: 'pcs', label: 'pcs' },
  { id: 'unit', label: 'unit' },
  { id: 'set', label: 'set' },
  { id: 'pair', label: 'pair' },
  { id: 'pack', label: 'pack' },
  { id: 'box', label: 'box' },
  { id: 'bottle', label: 'bottle' },
  { id: 'meter', label: 'meter' },
  { id: 'roll', label: 'roll' },
  { id: 'liter', label: 'liter' },
  { id: 'other', label: 'other' },
];

export const INVENTORY_UNIT_IDS = INVENTORY_UNITS.map((unit) => unit.id);

export const INVENTORY_LOCATIONS = [
  ...STUDIO_ROOMS.map((room) => ({
    id: room.id,
    label: room.label,
    shortLabel: room.shortLabel,
  })),
  { id: 'storage', label: 'Storage', shortLabel: 'STRG' },
  { id: 'other', label: 'Other', shortLabel: 'OTHR' },
];

export const INVENTORY_LOCATION_MAP = Object.fromEntries(
  INVENTORY_LOCATIONS.map((loc) => [loc.id, loc]),
);

export const INVENTORY_LOCATION_IDS = INVENTORY_LOCATIONS.map((loc) => loc.id);

export const INVENTORY_CONSUMABLE_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
};

export const INVENTORY_EQUIPMENT_STATUS = {
  AVAILABLE: 'available',
  MAINTENANCE: 'maintenance',
  DAMAGED: 'damaged',
  RETIRED: 'retired',
  MAINTENANCE_DUE: 'maintenance_due',
};

export const INVENTORY_MAINTENANCE_DUE_STATE = {
  DUE: 'due',
  SOON: 'soon',
  SCHEDULED: 'scheduled',
  NONE: 'none',
};

export const MAINTENANCE_SOON_WINDOW_DAYS = 7;

export const INVENTORY_MOVEMENT_TYPES = {
  OPENING_STOCK: 'opening_stock',
  STOCK_IN: 'stock_in',
  CONSUME: 'consume',
  WRITE_OFF: 'write_off',
  STOCK_ADJUSTMENT: 'stock_adjustment',
  SEND_TO_MAINTENANCE: 'send_to_maintenance',
  RETURN_FROM_MAINTENANCE: 'return_from_maintenance',
  MARK_DAMAGED: 'mark_damaged',
  MARK_REPAIRED: 'mark_repaired',
  MARK_RETIRED: 'mark_retired',
  LOCATION_CHANGED: 'location_changed',
};

export const INVENTORY_MOVEMENT_SOURCES = {
  OPENING_STOCK: 'opening_stock',
  MANUAL: 'manual',
  STOCK_ADJUSTMENT: 'stock_adjustment',
  LOCATION_CHANGE: 'location_change',
};

export const INVENTORY_MOVEMENT_META = {
  [INVENTORY_MOVEMENT_TYPES.OPENING_STOCK]: {
    id: INVENTORY_MOVEMENT_TYPES.OPENING_STOCK,
    label: 'Opening Stock',
    shortLabel: 'Stok Awal',
    tone: 'lime',
    direction: 'in',
  },
  [INVENTORY_MOVEMENT_TYPES.STOCK_IN]: {
    id: INVENTORY_MOVEMENT_TYPES.STOCK_IN,
    label: 'Stock In',
    shortLabel: 'Barang Masuk',
    tone: 'lime',
    direction: 'in',
  },
  [INVENTORY_MOVEMENT_TYPES.CONSUME]: {
    id: INVENTORY_MOVEMENT_TYPES.CONSUME,
    label: 'Record Usage',
    shortLabel: 'Pemakaian',
    tone: 'orange',
    direction: 'out',
  },
  [INVENTORY_MOVEMENT_TYPES.WRITE_OFF]: {
    id: INVENTORY_MOVEMENT_TYPES.WRITE_OFF,
    label: 'Write Off',
    shortLabel: 'Hapus Stok',
    tone: 'danger',
    direction: 'out',
  },
  [INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT]: {
    id: INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT,
    label: 'Stock Adjustment',
    shortLabel: 'Penyesuaian Stok',
    tone: 'ink',
    direction: 'adjust',
  },
  [INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE]: {
    id: INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE,
    label: 'Send to Maintenance',
    shortLabel: 'Masuk Servis',
    tone: 'amber',
    direction: 'transfer',
  },
  [INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE]: {
    id: INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE,
    label: 'Return from Maintenance',
    shortLabel: 'Selesai Servis',
    tone: 'emerald',
    direction: 'transfer',
  },
  [INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED]: {
    id: INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED,
    label: 'Mark Damaged',
    shortLabel: 'Tandai Rusak',
    tone: 'orange',
    direction: 'transfer',
  },
  [INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED]: {
    id: INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED,
    label: 'Mark Repaired',
    shortLabel: 'Selesai Diperbaiki',
    tone: 'emerald',
    direction: 'transfer',
  },
  [INVENTORY_MOVEMENT_TYPES.MARK_RETIRED]: {
    id: INVENTORY_MOVEMENT_TYPES.MARK_RETIRED,
    label: 'Mark Lost / Retired',
    shortLabel: 'Hilang / Pensiun',
    tone: 'neutral',
    direction: 'out',
  },
  [INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED]: {
    id: INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED,
    label: 'Location Changed',
    shortLabel: 'Pindah Lokasi',
    tone: 'ivory',
    direction: 'location',
  },
};

export const CONSUMABLE_USAGE_REASONS = [
  { id: 'Studio Operations', label: 'Studio Operations' },
  { id: 'Customer Session', label: 'Customer Session' },
  { id: 'Maintenance', label: 'Maintenance' },
  { id: 'Other', label: 'Other' },
];

export const CONSUMABLE_WRITE_OFF_REASONS = [
  { id: 'Damaged', label: 'Damaged / Rusak' },
  { id: 'Expired', label: 'Expired / Kedaluwarsa' },
  { id: 'Lost', label: 'Lost / Hilang' },
  { id: 'Unusable', label: 'Not Usable / Tidak Layak' },
  { id: 'Other', label: 'Other' },
];

export const EQUIPMENT_RETIRE_REASONS = [
  { id: 'Lost', label: 'Lost / Hilang' },
  { id: 'Beyond Repair', label: 'Beyond Repair / Tidak Bisa Diperbaiki' },
  { id: 'Disposed', label: 'Disposed / Dibuang' },
  { id: 'Other', label: 'Other' },
];

export const EQUIPMENT_DAMAGE_SOURCE_BUCKETS = [
  { id: 'available', label: 'Available Units' },
  { id: 'maintenance', label: 'Units in Maintenance' },
];

export const EQUIPMENT_RETIRE_SOURCE_BUCKETS = [
  { id: 'available', label: 'Available Units' },
  { id: 'damaged', label: 'Damaged Units' },
];

export const EQUIPMENT_ADJUSTMENT_BUCKETS = [
  { id: 'available', label: 'Available Quantity' },
  { id: 'maintenance', label: 'Maintenance Quantity' },
  { id: 'damaged', label: 'Damaged Quantity' },
];

export function getCategoryById(categoryId) {
  return INVENTORY_CATEGORY_MAP[categoryId] || INVENTORY_CATEGORY_MAP.other;
}

export function getLocationOptionById(locationId) {
  return INVENTORY_LOCATION_MAP[locationId] || INVENTORY_LOCATION_MAP.other;
}

export function getMovementMeta(movementType) {
  return (
    INVENTORY_MOVEMENT_META[movementType] || {
      id: String(movementType || 'unknown'),
      label: String(movementType || 'Movement'),
      shortLabel: String(movementType || 'Movement'),
      tone: 'neutral',
      direction: 'transfer',
    }
  );
}
