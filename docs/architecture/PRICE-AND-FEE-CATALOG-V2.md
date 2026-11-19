# Phase 6 V2 Architecture — Service Catalog & Tariff Model Redesign

**Project:** 37 Music Studio  
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`  
**Branch:** `main`  
**Baseline Audited HEAD:** `8cf4e6c7a5329f857b3a461580010857a45b444e`  
**Routes:** `/admin/settings` & `/admin/settings/price-and-fee`  
**Firestore Document:** `settings/pricing` (`schemaVersion: 2`)

---

## 1. Service Catalog Hierarchy

Phase 6 V2 replaces the flat V1 sections (`sessionTypes`, `recordingTypes`, `packages`, `discounts`, `fees`) with a single intuitive hierarchical catalog:

```text
Service Type (Studio | WFA)
  └── Service Option / Subcategory
        ├── Customer Price (Hourly | Fixed Shift | Fixed Project | Manual Quote | Unconfigured)
        ├── Discount Rules (per completed block | minimum duration; non-stacking)
        └── Internal Fees (Staff | Owner | Recording Operator)

Global Operational Settings
  └── Daily Meal Allowance per Staff (operational preset only)
```

- **Navigation & Route Compatibility:** `/admin/settings` remains the Overview page (`AdminSettingsPage`), `/admin/settings/price-and-fee` renders the refactored V2 catalog (`PriceAndFeeSettingsPage`), and the locked 8-item Admin Sidebar (`01 Dashboard` .. `08 Settings`) is preserved untouched.
- **Authorization:** Active **Owner** (`role === 'owner' && active === true`) has full CRUD & Save permissions. Active **Staff** (`role === 'staff' && active === true`) can view `/admin/settings/price-and-fee` in read-only mode (enforced in UI, `pricing-settings-service.js`, and `firestore.rules`).

---

## 2. Studio vs WFA (`deliveryMode`)

Every Service Type declares an explicit `deliveryMode`:

| Mode | Constant | Room Schedule / Calendar | Slot Lock (`bookingSlots`) | Default Services |
| --- | --- | --- | --- | --- |
| **Studio** | `'studio'` | Appears in `/admin/calendar` Booking Form (Room A / Room B) | Locks 30-minute slots in `bookingSlots` | `Rehearsal`, `Recording` |
| **WFA** (Work From Anywhere) | `'wfa'` | Strictly excluded from Studio Room Calendar | Never locks Room A / Room B | `Mixing`, `Mastering` |

Enforcement exists at three layers:
1. **UI Layer:** `usePricingSettings()` exposes `activeStudioServiceTypes` (`deliveryMode === 'studio' && isActive`) for `BookingFormDialog`.
2. **Service / Schema Layer:** `validateBookingFormPayload()` and `createBooking()` / `updateOrRescheduleBooking()` explicitly reject any WFA service (`booking/wfa-not-bookable-in-studio-calendar`).
3. **Firestore Security Rules Layer:** `isValidBookingV2ServiceFields(data)` enforces `data.deliveryMode == 'studio'` on every V2 booking write.

---

## 3. Service Type & Subcategory Structure

- **Immutable IDs:** Every Service Type and Subcategory has a stable opaque ID (`id`), generated via `crypto.randomUUID()` for new items, so renaming a service or subcategory never breaks historical bookings or lookup references.
- **Safe Delete:**
  - `canDeleteServiceType(serviceType, allServiceTypes)`: blocks removing the last remaining Service Type or any Service Type that still contains active subcategories (requires deactivating or deleting its active subcategories first).
  - `canDeleteServiceOption(option, parentServiceType)`: removes the subcategory safely from new bookings without affecting historical bookings that already recorded snapshot values.
- **Default V2 Catalog (`DEFAULT_SERVICE_TYPES`) — Zero Invented Rates:**
  - **Rehearsal** (`rehearsal`, `studio`):
    - `rehearsal-regular` — **Reguler**: `hourly` `Rp 100.000/jam`, active discount rule `Diskon Durasi` (`per_completed_block`, 180 min, Rp 30.000), staff fee `hourly` `Rp 0`.
    - `pkg-rehearsal-3h` — **Paket 3 Hours**: `fixed_shift` 180 min, base `Rp 300.000`, discount `Rp 30.000` (final `Rp 270.000`), staff fee `fixed` `Rp 0`.
    - `pkg-rehearsal-5h` — **Paket 5 Hours**: `fixed_shift` 300 min, base `Rp 500.000`, discount `Rp 50.000` (final `Rp 450.000`), staff fee `fixed` `Rp 0` (existing V1 preset retained).
    - `rehearsal-pkg-6h` — **Paket 6 Hours**: `unconfigured`, `isActive: false` (360 min template; hidden from Calendar until Owner configures tariff).
  - **Recording** (`recording`, `studio`):
    - `rec-lite` — **Lite**: `unconfigured`, `isActive: false`.
    - `rec-pro` — **Pro**: `unconfigured`, `isActive: false`.
    - `live-recording-3h` — **Live**: `fixed_shift` 180 min, base `Rp 420.000` (existing V1 preset retained).
    - `rec-drum-only` — **Drum Only**: `unconfigured`, `isActive: false`.
    - `rec-others` — **Others**: `manual_quote`, `isActive: true`, staff fee `manual`, recording operator fee `manual`.
    - `tracking-regular` — **Tracking Reguler**: `hourly` `Rp 150.000/jam` (existing V1 preset retained).
    - `multitrack-shift-6h` — **Multitrack Shift**: `fixed_shift` 360 min, base `Rp 800.000` (existing V1 preset retained).
  - **Mixing** (`mixing`, `wfa`):
    - `mixing-regular` — **Mixing Reguler**: `hourly` `Rp 250.000/jam`.
  - **Mastering** (`mastering`, `wfa`):
    - `mastering-regular` — **Mastering Reguler**: `hourly` `Rp 300.000/jam`.

---

## 4. Pricing Modes (`PRICING_MODES`)

All monetary calculations use integer IDR (Rupiah) arithmetic to eliminate floating-point precision drift.

| Mode | Key | Customer Subtotal Formula | Calendar Duration Behavior |
| --- | --- | --- | --- |
| **Hourly** | `'hourly'` | `Math.round((hourlyRate * durationMinutes) / 60)` | User selects any valid 30-min increment duration |
| **Fixed Shift** | `'fixed_shift'` | `basePrice`, with built-in package discount `discountAmount` (`final = max(0, basePrice - discountAmount)`) | Duration is locked to `pricing.durationMinutes` |
| **Fixed Project** | `'fixed_project'` | `projectPrice` (with optional `unitLabel`, e.g., `per lagu`, `per project`) | Primarily for WFA services; excluded from Studio Calendar |
| **Manual Quote** | `'manual_quote'` | Staff/Owner enters negotiated customer total at booking time (`manualCustomerTotal > 0`) | Duration remains flexible for Studio scheduling |
| **Unconfigured** | `'unconfigured'` | Not bookable (`isActive` forced `false`) | Automatically hidden from Booking Form and rejected by validation |

---

## 5. Internal Fee Calculation Modes (`FEE_MODES`)

Every subcategory independently configures **three internal fee roles**: `staff`, `owner`, and `recordingOperator`.

| Role | Supported Modes | Calculation Formula |
| --- | --- | --- |
| **Staff** (`fees.staff`) | `none`, `fixed`, `hourly`, `manual` | `none`: `0` · `fixed`: `amount` · `hourly`: `Math.round((amount * durationMinutes) / 60)` · `manual`: staff-entered value at booking |
| **Owner** (`fees.owner`) | `none`, `fixed`, `hourly`, `manual` | Same deterministic rule; never double-counted with hourly vs fixed |
| **Recording Operator** (`fees.recordingOperator`) | `none`, `fixed`, `hourly`, `manual` | Same deterministic rule; defaults to `manual` on Recording `Others` |

**Financial Isolation Guarantees:**
- Internal fees (`staff`, `owner`, `recordingOperator`) are **strictly separated** from customer billing.
- Internal fees **never** increase or alter `subtotal`, `discountAmount`, `totalAmount`, `initialPaidAmount` (DP), or `remainingBalance`.
- A role has exactly one active `mode` per subcategory (`fixed` and `hourly` can never be computed simultaneously for the same role).

---

## 6. Discount Rules (`DISCOUNT_RULE_MODES`)

Discounts are configured per subcategory (`option.discountRules[]`) and never stack:

1. **`per_completed_block`** (Duration-based automatic discount):
   - `eligibleBlocks = Math.floor(durationMinutes / intervalMinutes)`
   - `rawDiscount = eligibleBlocks * discountAmount`
   - Example: Rehearsal Reguler (`intervalMinutes: 180`, `discountAmount: 30000`) -> 2h: `Rp 0`, 3h–5h: `Rp 30.000`, 6h: `Rp 60.000`.
2. **`minimum_duration`**:
   - Applies flat `discountAmount` once `durationMinutes >= minimumDurationMinutes`.
3. **Non-Stacking & Capping Rules:**
   - `selectBestOptionDiscountRule()` evaluates all active rules on the selected `hourly` option and selects the **single rule producing the highest Rupiah discount**, capped at `subtotal` so `totalAmount >= 0`.
   - `fixed_shift` subcategories use only their own built-in `pricing.discountAmount` and **never** stack with `discountRules`.
   - `manual_quote` subcategories do not apply automatic discount rules.

---

## 7. Daily Meal Allowance (`operationalSettings`)

- Stored globally under `operationalSettings.dailyMealAllowancePerStaff` (integer IDR >= 0, default `0`).
- Treated strictly as an operational daily per-staff preset.
- **Never** included in customer booking totals, DP, remaining balance, or per-booking `commissionSnapshot`.
- Does not create attendance, payroll, or bookkeeping records in Phase 6 V2.

---

## 8. Firestore Schema V2 (`settings/pricing`)

Single centralized Firestore document at `settings/pricing`:

```js
{
  schemaVersion: 2,
  serviceTypes: [
    {
      id: 'rehearsal',
      name: 'Rehearsal',
      description: '...',
      deliveryMode: 'studio', // 'studio' | 'wfa'
      isActive: true,
      sortOrder: 1,
      options: [
        {
          id: 'rehearsal-regular',
          name: 'Reguler',
          description: '...',
          isActive: true,
          sortOrder: 1,
          pricing: {
            mode: 'hourly', // 'hourly' | 'fixed_shift' | 'fixed_project' | 'manual_quote' | 'unconfigured'
            hourlyRate: 100000,
            durationMinutes: null,
            basePrice: null,
            discountAmount: 0,
            projectPrice: null,
            unitLabel: '',
          },
          discountRules: [
            {
              id: 'disc-rehearsal-regular-3h',
              name: 'Diskon Durasi',
              mode: 'per_completed_block', // 'per_completed_block' | 'minimum_duration'
              intervalMinutes: 180,
              minimumDurationMinutes: 0,
              discountAmount: 30000,
              isActive: true,
            },
          ],
          fees: {
            staff: { mode: 'hourly', amount: 0 },
            owner: { mode: 'none', amount: 0 },
            recordingOperator: { mode: 'none', amount: 0 },
          },
        },
      ],
    },
  ],
  operationalSettings: {
    dailyMealAllowancePerStaff: 0,
  },
  version: 1, // incremented transactionally on each Owner save
  updatedAt: Timestamp, // serverTimestamp()
  updatedByUid: '<ownerUid>',
}
```

- Shared realtime hook `usePricingSettings()` subscribes to `settings/pricing` via `onSnapshot` (no `localStorage` source of truth) and cleans up on unmount.
- Transactional saves (`savePricingSettings()`) verify `actorRole === 'owner'`, validate the complete tree with Zod (`validatePricingSettingsPayload()`), enforce global subcategory ID uniqueness, and check `expectedVersion` inside `runTransaction` (`pricing/stale-version` on conflict).

---

## 9. V1 to V2 Safe Migration (`migrate-pricing-settings.js`)

When `settings/pricing` contains a legacy Schema V1 document (`schemaVersion === 1` or `sessionTypes` array without `serviceTypes`):

1. **Pure, Non-Mutating Read Migration:** `pricing-settings-repository.js` runs `migratePricingSettingsV1ToV2(rawV1)` **in memory only** and returns `{ settings, isPersisted: true, migratedFromV1: true }`. **Zero automatic Firestore writes happen during read/render.**
2. **Lossless Mapping:**
   - V1 `sessionTypes` become V2 `serviceTypes` (preserving IDs, names, descriptions, active flags, sort orders, and hourly rates; `mixing` & `mastering` map to `deliveryMode: 'wfa'`, studio types to `'studio'`).
   - V1 `recordingTypes` map to subcategories under `recording` (`hourly` -> `hourly`, `fixed` -> `fixed_shift`) while ensuring requested V2 entries (`Lite`, `Pro`, `Drum Only` as `unconfigured`/`isActive: false`, and `Others` as `manual_quote`) are appended if absent.
   - V1 `packages` map to `fixed_shift` subcategories under their parent `sessionTypeId`, preserving `basePrice`, `discountAmount`, `staffCommissionAmount` -> `fees.staff (fixed)`, and `recordingOperatorCommissionAmount` -> `fees.recordingOperator (fixed)`.
   - V1 `sessionTypes[].durationDiscount` maps to a `per_completed_block` discount rule on the regular hourly option; V1 `discounts[]` map to `minimum_duration` discount rules on the matching regular hourly option.
   - V1 `fees.rehearsalStaffCommissionPerHour` maps to `rehearsal-regular.fees.staff` (`mode: 'hourly'`).
   - V1 `fees.dailyMealAllowancePerStaff` maps to `operationalSettings.dailyMealAllowancePerStaff`.
   - Document `version`, `updatedAt`, and `updatedByUid` are preserved intact.
3. **Explicit Owner Save Upgrade:** `PriceAndFeeSettingsPage` displays an informational migration notice banner and enables `Save Changes` so the Owner explicitly persists Schema V2 at `version + 1` (permitted by `firestore.rules` because `allow update` validates `request.resource.data.schemaVersion == 2` and `request.resource.data.version == resource.data.version + 1`).
4. **Idempotence:** Passing an already-migrated V2 object through `normalizePricingSettings()` produces identical deep output on repeated invocations.

---

## 10. Calendar Integration (`src/features/admin/calendar/`)

- `AdminCalendarPage` reads `usePricingSettings()` and passes `pricingSettings` and `activeStudioServiceTypes` into `BookingFormDialog`, `createBooking()`, and `updateOrRescheduleBooking()`.
- `BookingFormDialog` follows the sequential flow:
  1. **Jenis Jasa (`serviceTypeId`)** — only active `studio` services (`Rehearsal`, `Recording`, or Owner-added Studio services). WFA services (`Mixing`, `Mastering`) are excluded.
  2. **Subkategori / Opsi (`serviceOptionId`)** — only active, configured options under the selected Service Type. Unconfigured and inactive options are excluded.
  3. **Jadwal & Durasi** — `fixed_shift` options lock duration automatically; `hourly` and `manual_quote` options allow 30-minute increment scheduling within studio operating hours (`10:00`–`23:00`).
  4. **Separated Financial Summary:**
     - **CUSTOMER BILL:** Harga Normal / Subtotal, Diskon Durasi / Diskon Paket (shown when > 0), Total Pembayaran, Pembayaran Awal, Sisa Tagihan.
     - **INTERNAL FEE ESTIMATE:** Staff Fee, Owner Fee, Recording Operator Fee (clearly badged as internal only; never added to Customer Bill).
- 30-minute deterministic `bookingSlots` locking (`{date}_{studioId}_{slotStartMinute}`) and transactional concurrent-booking conflict prevention remain intact.

---

## 11. Manual Quote Workflow (`Recording -> Others`)

When a `manual_quote` subcategory (such as `Recording -> Others`) is selected in `BookingFormDialog`:

- **Manual Customer Price Input:** Staff/Owner enters `Harga Manual Customer (Rp)` (required integer > `0`).
- **Manual Internal Fee Inputs:** For each internal fee role configured as `mode: 'manual'` (default on `Others`: `Staff` and `Recording Operator`), Staff/Owner enters the agreed fee amount (non-negative integer >= `0`).
- **Validation:** `booking-schema.js` rejects missing or `<= 0` manual customer totals and negative manual fees before submission.
- **Snapshot:** The submitted booking stores `pricingMode: 'manual_quote'`, `subtotal = totalAmount = manualCustomerTotal`, `discountAmount = 0`, `automaticDiscount = null`, and `commissionSnapshot` V2 recording each manual role as `{ basis: 'manual', rate: amount, amount }`.

---

## 12. Booking Financial Snapshot

Every new Studio booking persists immutable financial snapshot fields alongside its catalog metadata:

- Catalog metadata: `serviceTypeId`, `serviceTypeName`, `serviceOptionId`, `serviceOptionName`, `deliveryMode: 'studio'`, `pricingMode`, `pricingSettingsVersion` (plus legacy compatibility fields `serviceId`, `serviceLabel`, `packageId`, `packageLabel`, `recordingTypeId`, `recordingTypeLabel`).
- Customer price snapshot: `unitRate`, `subtotal`, `discountAmount`, `totalAmount`, `automaticDiscount` (either `null` or `{ type: 'duration_multiple', intervalMinutes, eligibleBlocks, discountPerBlock, totalDiscount }`).
- Payment snapshot: `initialPaymentStatus`, `initialPaidAmount`, `paymentMethod` (locked immutable on update in `firestore.rules`).

---

## 13. Commission / Internal Fee Snapshot (`commissionSnapshot` V2)

New V2 bookings store a 3-role structured `commissionSnapshot`:

```js
{
  schemaVersion: 2,
  staff: { basis: 'none' | 'fixed' | 'hourly' | 'manual', rate: 10000, amount: 50000 },
  owner: { basis: 'none' | 'fixed' | 'hourly' | 'manual', rate: 20000, amount: 20000 },
  recordingOperator: { basis: 'none' | 'fixed' | 'hourly' | 'manual', rate: 0, amount: 0 },
  settingsVersion: 4,
}
```

- Enforced in `firestore.rules` via `isValidBookingCommissionSnapshotV2(snap)` and `isValidCommissionRoleEntry(entry)` (exact key counts, allowed `basis` values, non-negative integer `rate` & `amount`, positive integer `settingsVersion`).
- Locked immutable on update whenever service scope (`serviceId`, `packageId`, `recordingTypeId`, `serviceTypeId`, `serviceOptionId`, `durationMinutes`) is unchanged (`isValidBookingScopeAndSnapshots()`).

---

## 14. Backward Compatibility

- **Phase 5 Bookings (`commissionSnapshot: null`, no V2 service fields):** `normalizeBookingRecord()` fills missing V2 fields with safe defaults; `BookingDetailDrawer` renders legacy service labels and displays graceful fallback without crashing; `firestore.rules` permits updating/rescheduling Phase 5 bookings while protecting their recorded financial totals.
- **Phase 6 V1 Bookings (flat `commissionSnapshot: { staffBasis, staffRate, staffAmount, recordingOperatorAmount, settingsVersion }`):** `normalizeCommissionSnapshot()` and `getCommissionSnapshotDisplay()` preserve and render V1 snapshots accurately alongside V2 snapshots; `firestore.rules` dispatches V1 vs V2 snapshot validation via `snap.get('schemaVersion', 1) == 2 ? isValidBookingCommissionSnapshotV2(snap) : isValidBookingCommissionSnapshotV1(snap)`.
- **Historical Protection:** Updating tariffs, discounts, or fees in `/admin/settings/price-and-fee` never mutates existing bookings. Editing customer contact info, notes, session status, or rescheduling room/date/time preserves the original price & fee snapshots. Changing service/subcategory/duration during edit requires explicit confirmation (`Terapkan harga & fee preset terbaru`) before recalculating snapshots.

---

## 15. Known Limitations & Out-of-Scope Boundaries

- **Local Rules Only (Not Deployed):** Per Phase 6 V2 scope (`no deployment`), updated `firestore.rules` was verified against the local Firebase Firestore Emulator (`24/24` checks passed) and has **not** been deployed to production Firebase project `studio37classic`. Production deployment requires explicit Owner execution (`firebase deploy --only firestore:rules`).
- **WFA Services Are Catalog-Only:** `Mixing` and `Mastering` (and any custom `wfa` Service Types) are configured and persisted in `settings/pricing`, but full WFA order/project/delivery tracking belongs to a future phase and is intentionally not mapped to Studio Room Calendar slots.
- **No Payroll / Payout / Bookkeeping Yet:** `commissionSnapshot` (Staff, Owner, Recording Operator) and `operationalSettings.dailyMealAllowancePerStaff` serve strictly as configuration presets and per-booking financial snapshots; payout settlement, attendance tracking, meal distribution, invoicing, refunds, and bookkeeping ledgers remain out of scope for Phase 6 V2.
- **Workspace Line Endings (Windows CRLF):** Pre-existing untouched files in the repository use Windows CRLF line endings; `scripts/verify-phase-6-tariff-v2.ps1` runs Prettier verification with `--end-of-line auto` across all modified/created V2 directories (`src/features/admin/settings` and `src/features/admin/calendar`).
