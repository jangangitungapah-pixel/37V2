# Phase 6 Architecture — Admin Settings & Price and Fee Configuration

**Project:** 37 Music Studio  
**Branch:** `main`  
**Routes:** `/admin/settings` & `/admin/settings/price-and-fee`  
**Firestore Document:** `settings/pricing`

---

## 1. Settings Routes & Navigation Compatibility

- The global Admin Sidebar maintains the locked 8-item Phase 4 order (`01 Dashboard` .. `08 Settings`). No separate top-level sidebar entry was added for **Price and Fee Settings**.
- `getAdminNavItemByPath(pathname)` in `src/features/admin/navigation/admin-navigation.js` now matches both exact module routes (`normalized === item.href`) and nested subpage routes (`normalized.startsWith(item.href + '/')`), ensuring `Settings` stays highlighted in both the sidebar and `AdminTopbar` breadcrumb across `/admin/settings` and `/admin/settings/price-and-fee`.
- `/admin/settings` mounts `AdminSettingsPage`, displaying title **Settings**, subtitle **Studio configuration and operational presets**, and a single module card linking to **Price and Fee Settings** (`/admin/settings/price-and-fee`).
- `/admin/settings/price-and-fee` mounts `PriceAndFeeSettingsPage` with breadcrumb `Admin > Settings > Price and Fee Settings` and the 5 sequential configuration sections in a single scrollable workspace.

---

## 2. Configuration Sections & Domain Models

### Default Configuration (`DEFAULT_PRICING_SETTINGS`)

When `settings/pricing` does not yet exist in Cloud Firestore, the app initializes from `DEFAULT_PRICING_SETTINGS` matching existing V2 presets without performing automatic initial writes on page render:

- **Session Types:**
  - `rehearsal` — Rehearsal (`Rp 100.000/jam`)
  - `recording` — Recording (`Rp 150.000/jam`)
  - `mixing` — Mixing (`Rp 250.000/jam`)
  - `mastering` — Mastering (`Rp 300.000/jam`)
- **Recording Options:**
  - `tracking-regular` — Tracking Reguler (`hourly`, `Rp 150.000/jam`)
  - `live-recording-3h` — Live Recording Session (`fixed`, `180` mins, `Rp 420.000`)
  - `multitrack-shift-6h` — Multitrack Shift (`fixed`, `360` mins, `Rp 800.000`)
- **Studio Packages:**
  - `pkg-rehearsal-3h` — Paket Rehearsal 3 Jam (`180` mins, subtotal `300.000`, discount `30.000`, final `270.000`, staffCommission `0`, operatorCommission `0`)
  - `pkg-rehearsal-5h` — Paket Rehearsal 5 Jam (`300` mins, subtotal `500.000`, discount `50.000`, final `450.000`, staffCommission `0`, operatorCommission `0`)
- **Discount Presets:** `[]` (empty until configured by Owner/Staff)
- **Operational Fees:** `rehearsalStaffCommissionPerHour: 0`, `dailyMealAllowancePerStaff: 0`

### Section 01 — Session Types (`SessionTypeList` / `SessionTypeDialog`)

- Fields: `id` (opaque UUID generated via `crypto.randomUUID()`, independent of display name), `name`, `description`, `hourlyRate` (non-negative IDR integer), `isActive`, `sortOrder`.
- Deleting a Session Type checks `canDeleteSessionType(id, packages)` and blocks removal if any **active** Studio Package still references it.
- Inactive session types are excluded from new Booking Forms while historical bookings continue showing their stored `serviceLabel`.

### Section 02 — Recording Options (`RecordingOptionList` / `RecordingOptionDialog`)

- Applies only when Session Type `recording` is selected.
- Fields: `id`, `name`, `description`, `priceMode` (`hourly | fixed`), `durationMinutes` (`0` for hourly, positive multiple of 30 minutes for fixed), `price` (hourly rate or fixed shift price), `isActive`, `sortOrder`.
- Fixed options automatically lock duration in `BookingFormDialog` via `resolveFormDurationMinutes()`.

### Section 03 — Studio Packages (`StudioPackageList` / `StudioPackageDialog`)

- Fields: `id`, `name`, `detail`, `sessionTypeId`, `durationMinutes`, `basePrice`, `discountAmount` (`<= basePrice`), `staffCommissionAmount`, `recordingOperatorCommissionAmount`, `isActive`, `sortOrder`.
- Customer final price formula: `finalPrice = max(0, basePrice - discountAmount)`.
- Internal commission fields (`staffCommissionAmount`, `recordingOperatorCommissionAmount`) are stored exclusively as internal operational estimates and NEVER added to customer `totalAmount`, DP, or remaining balance.

### Section 04 — Discount Presets (`DiscountPresetList` / `DiscountPresetDialog`)

- Fields: `id`, `name`, `sessionTypeId`, `minimumDurationMinutes`, `discountAmount`, `isActive`, `sortOrder`.
- Automatic discount rule (`selectBestSessionDiscount`):
  - Applies only to regular (non-package) sessions.
  - Matches active presets where `preset.sessionTypeId === booking.serviceId` and `booking.durationMinutes >= preset.minimumDurationMinutes`.
  - Picks the **single highest `discountAmount`** preset (never stacks discounts) and caps the discount at `subtotal`.
  - Package bookings ignore regular session discounts and use only their own package `discountAmount`.

### Section 05 — Staff and Operational Fees (`OperationalFeesForm`)

- **Rehearsal Staff Commission per Hour (`rehearsalStaffCommissionPerHour`):** Internal studio guard commission per hour applied exclusively to regular (non-package) Rehearsal bookings (`rate * durationHours`). Never combined with package commissions and never applied to Recording, Mixing, or Mastering.
- **Daily Meal Allowance per Staff (`dailyMealAllowancePerStaff`):** Stored purely as a daily per-staff operational preset. Never calculated per booking and never creates payroll, attendance, or bookkeeping records.

---

## 3. Centralized Firestore Document & Realtime Sync

- Single Firestore document path: `settings/pricing` (via `getFirebaseDb()` in `src/lib/firebase/firestore.js`).
- Top-level fields:
  - `schemaVersion: 1`
  - `sessionTypes: Array`
  - `recordingTypes: Array`
  - `packages: Array`
  - `discounts: Array`
  - `fees: { rehearsalStaffCommissionPerHour, dailyMealAllowancePerStaff }`
  - `version: number` (starts at `1` on first save, incremented atomically on every subsequent update)
  - `updatedAt: Timestamp` (`serverTimestamp()`)
  - `updatedByUid: string` (`request.auth.uid`)
- Shared realtime hook `usePricingSettings()` (`src/features/admin/settings/hooks/usePricingSettings.js`) subscribes via `onSnapshot`, manages loading/error/unpersisted states, cleans up on unmount, and never uses `localStorage` as a source of truth.
- `savePricingSettings()` validates the entire configuration with Zod (`validatePricingSettingsPayload`) and writes atomically inside a Firestore `runTransaction` with optimistic concurrency check against `expectedVersion` (`pricing/stale-version` on mismatch).

---

## 4. Firestore Security Rules (`firestore.rules`)

- `match /settings/pricing`:
  - `allow get`: active Owner or Staff (`isActiveStaff()`).
  - `allow list`: `false`.
  - `allow create`: `isActiveStaff()`, strict top-level key allow-list (`isValidPricingSettings`), list/map types, non-negative `fees`, `version == 1`, `updatedAt is timestamp`, and `updatedByUid == request.auth.uid`.
  - `allow update`: `isActiveStaff()`, `isValidPricingSettings`, and `request.resource.data.version == resource.data.version + 1`.
  - `allow delete`: `false`.
- `match /bookings/{bookingId}` updates:
  - Permits optional `commissionSnapshot` map (`staffBasis`, `staffRate`, `staffAmount`, `recordingOperatorAmount`, `settingsVersion`) with non-negative values and positive integer `settingsVersion`.
  - Enforces immutability of price snapshot (`unitRate`, `subtotal`, `discountAmount`, `totalAmount`) and `commissionSnapshot` whenever `serviceId`, `packageId`, `recordingTypeId`, and `durationMinutes` are unchanged (`isServiceScopeUnchanged`), preserving full compatibility with Phase 5 bookings lacking `commissionSnapshot`.

---

## 5. Calendar Integration & Historical Snapshot Protection

- `AdminCalendarPage` reads `usePricingSettings()` and passes `pricingSettings` into `BookingFormDialog`, `createBooking()`, and `updateOrRescheduleBooking()`.
- `BookingFormDialog` dynamically renders active Session Types, Recording Options, Studio Packages, automatic discount calculations, and a dedicated two-column preview:
  - **CUSTOMER CHARGE** (`Subtotal`, `Discount`, `TOTAL`, `Pembayaran Awal`, `Sisa Tagihan`)
  - **INTERNAL FEE ESTIMATE** (`Staff Commission`, `Recording Operator`)
- New bookings persist:
  - Customer price snapshot: `unitRate`, `subtotal`, `discountAmount`, `totalAmount`
  - Internal commission snapshot (`commissionSnapshot`):
    `{ staffBasis: 'package' | 'rehearsal_hourly' | 'none', staffRate, staffAmount, recordingOperatorAmount, settingsVersion }`
- **Historical Protection & Phase 5 Compatibility:**
  - Updating presets in Settings never mutates existing bookings.
  - Editing customer notes/contact info or rescheduling room/date/time on an existing booking preserves the recorded price snapshot and `commissionSnapshot`.
  - If service/package/recording option/duration is changed while editing an existing booking, `BookingFormDialog` requires an explicit confirmation checkbox (`Terapkan harga & fee preset terbaru`) before updating the stored snapshots.
  - `normalizeBookingRecord` normalizes missing `commissionSnapshot` to `null` so Phase 5 bookings load and update cleanly without forced database migration.

---

## 6. Known Limitations

- Updated `firestore.rules` has been verified locally against the Firebase Firestore Emulator (`23/23` checks), not deployed to the production `studio37classic` Firebase project (per strict no-deployment scope). Saving `settings/pricing` in production requires deploying the updated `firestore.rules` when authorized.
- Daily Meal Allowance per Staff is stored strictly as an operational preset; daily attendance and payout settlement are deferred to dedicated future phases.
