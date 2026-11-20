# 37 Music Studio — Admin Inventory Management Architecture

**Route:** `/admin/inventory`  
**Firestore Collections:** `inventoryItems`, `inventoryMovements`  
**Design System:** Spatial Ambient Workspace (`AdminPageHeader`, `AdminSurface`, `AdminMetricCard`, `AdminStatusBadge`, `AdminButton`, `AdminEmptyState`)

---

## 1. Inventory Overview & Operational Principles

The Inventory Module manages studio physical supplies (**Consumables**) and reusable gear (**Equipment**) through a unified 4-step daily workflow:

1. **Search** (`Search item name, code, category...`)
2. **Select** item row/card -> opens `InventoryItemDetailDrawer`
3. **Record Movement** (`InventoryMovementDialog` or Owner `InventoryAdjustmentDialog`)
4. **Done** — atomically updates item balances and writes an immutable record in `inventoryMovements`

All quantity changes strictly require an atomic movement record inside a Firestore transaction. Direct stock balance editing from metadata forms is prohibited.

---

## 2. Two Core Item Types

### A. Consumables (`itemType: 'consumable'`)

- Supplies consumed during operations (guitar strings, drum sticks, picks, batteries, gaffer tape, cleaning liquid, cable ties).
- Uses `consumableStock: { onHandQuantity }` supporting decimal quantities up to 3 decimal places (`roundInventoryQuantity`).
- Threshold field: `minimumStockQuantity`.
- Automatic status derivation (`deriveConsumableStockStatus`):
  - `out_of_stock`: `onHandQuantity === 0`
  - `low_stock`: `onHandQuantity > 0 && onHandQuantity <= minimumStockQuantity`
  - `in_stock`: `onHandQuantity > minimumStockQuantity`
- Atomic boolean `lowStock` is maintained inside every transaction and threshold update (`isActive && itemType === 'consumable' && onHandQuantity <= minimumStockQuantity`) to support server-side `getCountFromServer()` aggregation without composite indexes.

### B. Equipment (`itemType: 'equipment'`)

- Reusable studio gear (microphones, guitars, amplifiers, speakers, audio interfaces, XLR cables, stands).
- Multi-unit identical gear at a single primary location is tracked using four non-negative **integer condition buckets**:
  - `availableQuantity`
  - `maintenanceQuantity`
  - `damagedQuantity`
  - `retiredQuantity`
- `registeredTotal = availableQuantity + maintenanceQuantity + damagedQuantity + retiredQuantity`.
- Threshold field: `minimumAvailableQuantity`.
- Atomic query booleans:
  - `inMaintenance`: `isActive && maintenanceQuantity > 0`
  - `hasDamagedOrRetired`: `isActive && (damagedQuantity > 0 || retiredQuantity > 0)`

---

## 3. Stable Categories & Studio Locations

### Categories (`categoryId`)

- `instruments` — Instruments
- `audio_recording` — Audio & Recording
- `amplifiers_speakers` — Amplifiers & Speakers
- `cables_connectivity` — Cables & Connectivity
- `stands_accessories` — Stands & Accessories
- `maintenance_cleaning` — Maintenance & Cleaning
- `other` — Other

### Locations (`locationId`)

Strictly reuses canonical studio room IDs from `src/features/admin/calendar/config/calendar-config.js`:

- `room-a` — Room A
- `room-b` — Room B
- `storage` — Storage
- `other` — Other (with custom `locationLabel`)

When `locationId` or `locationLabel` changes on an item that already has movement history (`lastMovementId != null`), the update transaction atomically records a `location_changed` movement storing `locationBefore` and `locationAfter`, actor UID, and timestamp without altering Calendar bookings.

---

## 4. Movement Types & Condition Transitions

### Consumables Movements

- `opening_stock`: Automatically written inside the item creation transaction whenever `openingQuantity > 0`.
- `stock_in`: `onHandQuantity += quantity`.
- `consume` (**Record Usage**): `onHandQuantity -= quantity` (blocked if `quantity > onHandQuantity`), reasons: `Studio Operations`, `Customer Session`, `Maintenance`, `Other`.
- `write_off`: `onHandQuantity -= quantity` (damaged/expired/lost/unusable).
- `stock_adjustment` (**Owner only**): Sets `onHandQuantity` to `actualCountedQuantity`, computes delta, requires reason (`>= 3` chars) and displays Before/After preview.

### Equipment Movements

- `opening_stock`: Created atomically on item creation if initial `availableQuantity > 0`.
- `stock_in` (**Add Equipment**): `availableQuantity += quantity`.
- `send_to_maintenance`: `availableQuantity -= quantity`, `maintenanceQuantity += quantity`.
- `return_from_maintenance`: `maintenanceQuantity -= quantity`, `availableQuantity += quantity`; updates `lastMaintenanceDate` and optional `nextMaintenanceDate`.
- `mark_damaged`: Moves `quantity` from selected `sourceBucket` (`available` or `maintenance`) into `damagedQuantity`.
- `mark_repaired`: `damagedQuantity -= quantity`, `availableQuantity += quantity` (requires Repair Note `>= 3` chars).
- `mark_retired`: Moves `quantity` from `available` or `damaged` into `retiredQuantity` (historical record preserved; item is never permanently deleted).
- `stock_adjustment` (**Owner only**): Reconciles physical count on selected bucket (`available`, `maintenance`, or `damaged`) with required reason.
- `location_changed`: Updates `locationId`/`locationLabel` with `quantity: 0` and unchanged balances.

---

## 5. Maintenance Scheduling (`Asia/Jakarta`)

Equipment records store optional `lastMaintenanceDate` (`YYYY-MM-DD`), `nextMaintenanceDate` (`YYYY-MM-DD`), and `maintenanceIntervalDays` (`1..3650`).

Relative to `getJakartaTodayIso()`:

- `due` (**Maintenance Due**): `nextMaintenanceDate <= todayIso`
- `soon` (**Maintenance Soon**): `todayIso < nextMaintenanceDate <= addDaysToIsoDate(todayIso, 7)`
- `scheduled`: `nextMaintenanceDate > todayIso + 7d`
- `none`: No upcoming maintenance date configured

Maintenance reminders are visual alerts only and never trigger automatic stock movements.

---

## 6. Immutable Movements & Atomic Stock Service

Shared entry points:

- `createInventoryItem()` / `updateInventoryItemMetadata()` / `setInventoryItemArchiveStatus()` in `services/inventory-item-service.js`
- `recordInventoryMovement()` in `services/inventory-movement-service.js`

Transactional guarantees:

1. **All reads before writes** inside `runTransaction` (`getItem`, `getMovement`).
2. **Idempotency**: Dialogs generate a stable `movementId` (`operationId`) before submission; retries detecting existing `inventoryMovements/{movementId}` replay safely without double-counting stock.
3. **Optimistic locking**: Checks `expectedVersion === existingItem.version` (`inventory/stale-version` on conflict) to prevent overselling under concurrent Staff edits.
4. **Atomic linkage**: Updates `consumableStock`/`equipmentStock`, `lowStock`, `inMaintenance`, `hasDamagedOrRetired`, `lastMovementId`, `lastMovementAt`, `updatedAt`, `updatedByUid`, and `version + 1` in the same transaction that creates `inventoryMovements/{movementId}`.

---

## 7. Soft Archive Rules

- Permanent deletion is prohibited (`allow delete: if false` in Firestore Rules, zero delete UI).
- Archiving sets `isActive = false`, allowed **only when**:
  - **Consumables**: `onHandQuantity === 0`
  - **Equipment**: `availableQuantity === 0 && maintenanceQuantity === 0 && damagedQuantity === 0` (`retiredQuantity` may remain `>= 0`).
- Archived items are hidden from default views, searchable under the `Archived` filter, reject new stock movements, and can be reactivated **only by an active Owner**.

---

## 8. Firestore Schema & Zero-Composite-Index Query Strategy

### Collections

1. `inventoryItems/{itemId}` (32 validated fields)
2. `inventoryMovements/{movementId}` (19 validated immutable fields)

### Pagination & Summary Metrics

- **Directory**: Bounded subscription `orderBy('updatedAt', 'desc'), limit(maxLimit + 1)` (`PAGE_SIZE = 50`) with `Load More Items`.
- **Archived View**: Bounded query `where('isActive', '==', false), limit(maxLimit + 1)`.
- **Summary Metrics**: Uses server-side `getCountFromServer()` (`isActive == true`, `isActive == false`, `lowStock == true`, `hasDamagedOrRetired == true`) plus bounded deduplicated check for `inMaintenance == true` and `nextMaintenanceDate <= todayIso` (`INVENTORY_ITEMS_SUMMARY_BOUND = 500`), ensuring:
  - Zero double-counting across records.
  - Totals remain accurate even when directory pagination loads a subset, with explicit `"Menampilkan X dari Y item aktif"` banner.
- **Movement History & Global Activity**: Bounded `where('itemId', '==', itemId), limit(...)` for item drawer and `orderBy('occurredAt', 'desc'), limit(maxLimit + 1)` for global Activity tab (`PAGE_SIZE = 30`). All queries use single-field indexes only (zero custom `firestore.indexes.json` required).

---

## 9. Firestore Security Rules & Role Restrictions

- **Active Staff & Owner** (`isActiveStaff()`): Read `inventoryItems` and `inventoryMovements`; create items; edit metadata; record routine movements (`stock_in`, `consume`, `write_off`, maintenance/damage/repair/retire, `location_changed`); soft-archive when operational stock is 0.
- **Active Owner Only** (`isActiveOwner()`): Create `stock_adjustment` movements; reactivate archived items (`isActive: false -> true`).
- **Strictly Denied**: Anonymous users, inactive staff, updating/deleting `inventoryMovements`, deleting `inventoryItems`, modifying stock fields without a transaction-linked movement verified via `existsAfter()` / `getAfter()`, and creating movements without matching item `version + 1` & `lastMovementId`.

---

## 10. Integration Boundaries & Known Limitations

- **Calendar Boundary**: Inventory does not automatically deduct consumables or reserve equipment when Calendar bookings are created or completed. Staff optionally record usage manually with reason `Customer Session`.
- **Bookkeeping Boundary**: Recording `stock_in` or `write_off` does **not** create `bookkeepingEntries` or `paymentTransactions`; procurement and supplier expenses belong to Pembukuan.
- **Known Limitations (Phase Scope)**:
  - No supplier/PO workflow, individual serial numbers, barcode scanner integration, equipment customer rental, or asset valuation/depreciation.
  - Client-side search filters loaded items (with clear server-total indicator & `Load More Items` when more items exist on server).
  - Updated `firestore.rules` has been verified against the local Firestore Emulator and **not deployed** to production Firebase.
