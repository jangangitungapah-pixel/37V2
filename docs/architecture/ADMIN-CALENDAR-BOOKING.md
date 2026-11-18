# 37 Music Studio — Admin Calendar & Booking Management Architecture (Phase 5)

**Phase:** 5 — Admin Calendar & Booking Management  
**Primary Route:** `/admin/calendar`  
**Stack:** React 19 + Vite 8 + JavaScript (JSX) + Tailwind CSS v4 + `@base-ui/react` + Firebase Authentication + Cloud Firestore

---

## 1. Calendar Workspace Architecture

The `/admin/calendar` workspace transforms the Phase 4 Calendar route into a full-featured **Studio Booking Management Workspace** for 37 Music Studio while preserving the existing `AdminLayout`, `AdminSidebar`, `AdminTopbar`, and `RequireStaff` authentication boundary.

### Core Design Principles

- **Separation of Concerns:** UI presentation (`components/`), state subscriptions (`hooks/`), domain validation (`schemas/`), date/time/pricing math (`utils/`), and Firestore atomic transactions (`repositories/` & `services/`) are cleanly decoupled.
- **Neo-Brutalist Editorial × Modern Operational Interface:** Uses the established 37V2 palette (`#F1EEE4` Studio Ivory, `#151515` Studio Ink, `#C8F13A` Studio Lime, `#FF4B22` Studio Orange, `#FFFFFF` Studio White) with tactile `2px` ink borders, hard offset shadows, `Barlow Condensed` display headers, `Inter` body text, and `JetBrains Mono` timestamps and financial figures.
- **Orthogonal Status Dimensions:** `initialPaymentStatus` (`unpaid`, `partial`, `paid`) and `sessionStatus` (`upcoming`, `in_progress`, `completed`, `no_show`, `cancelled`) are stored, validated, and displayed as two distinct badges.

---

## 2. Folder Structure

```text
src/features/admin/calendar/
├── components/
│   ├── BookingDetailDrawer.jsx     # Slide-over detail drawer, lifecycle controls & Firestore activity log
│   ├── BookingFormDialog.jsx       # Adaptive 4-step modal/sheet for Create, Edit & Reschedule
│   ├── CalendarBookingCard.jsx     # Timeline & compact booking block with room, payment & session badges
│   ├── CalendarDayView.jsx         # Single-day 30-min interval timeline across Room A & Room B
│   ├── CalendarFilters.jsx         # Room filter, payment filter, search box & cancelled visibility toggle
│   ├── CalendarGrid.jsx            # View mode orchestrator + loading, error & truncation states
│   ├── CalendarMonthView.jsx       # Monthly overview grid with Indonesian weekday headers & Day View jump
│   ├── CalendarToolbar.jsx         # Period heading, Prev/Today/Next, date picker, view switcher & + New Booking
│   ├── CalendarViewSwitcher.jsx    # Day / Week / Month view mode control
│   └── UpcomingBookings.jsx        # Chronological upcoming sessions panel linked to BookingDetailDrawer
├── config/
│   └── calendar-config.js          # Rooms, services, recording types, packages, operating hours & status metadata
├── hooks/
│   └── useCalendarBookings.js      # Realtime Firestore onSnapshot hooks for date-range bookings & bookingEvents
├── pages/
│   └── AdminCalendarPage.jsx       # Main `/admin/calendar` workspace container
├── repositories/
│   └── calendar-booking-repository.js # Shared Firestore adapter (`runTransaction`, `onSnapshot`, normalization)
├── schemas/
│   └── booking-schema.js           # Step-by-step & full-payload validation (customer, service, schedule, payment)
├── services/
│   └── calendar-booking-service.js # Atomic transactional operations (create, edit, reschedule, cancel, lifecycle)
├── utils/
│   ├── booking-pricing.js          # Rupiah formatting & immutable pricing snapshot calculation
│   ├── booking-time.js             # 30-min interval math, overlap formula, slot lock builder & collision layout
│   └── calendar-date.js            # Asia/Jakarta date utilities, strict YYYY-MM-DD validation & Indonesian labels
└── calendar.test.jsx               # Automated unit & integration tests for transactions, UI & security rules
```

---

## 3. Routes & Navigation Behavior

- `/admin/calendar` is nested inside `<RequireStaff><AdminLayout /></RequireStaff>` in `src/App.jsx`.
- Default view mode:
  - **Desktop (`>= 1024px`):** `Month View` (`month`)
  - **Mobile & Tablet (`< 1024px`):** `Week View` (`week`)
- Users can switch freely between `Day`, `Week`, and `Month` views at any time.
- Period navigation (`Previous`, `Today`, `Next`) shifts by `-1/+1` day in Day View, `-7/+7` days in Week View, and `-1/+1` month in Month View.
- Clicking any date header in Week View or Month View opens `Day View` for that date.

---

## 4. Studio Rooms, Operating Hours & Time Integrity

- **Supported Rooms:**
  - `room-a` (`Room A` — Live Room)
  - `room-b` (`Room B` — Control + Booth)
- **Operating Hours:** `10:00` (`startMinute = 600`) to `23:00` (`endMinute = 1380`), `Asia/Jakarta` (`WIB`).
- **Slot Granularity:** `30 minutes` (`SLOT_INTERVAL_MINUTES = 30`), supporting preset durations (`1h`–`6h`) and custom durations in 30-minute increments (`90`, `150`, etc.).
- **Date Integrity:** Dates are stored as validated `YYYY-MM-DD` strings (`isValidIsoDateString`), and times are stored as integer minutes from midnight (`startMinute`, `durationMinutes`, `endMinute`) in `Asia/Jakarta` so browser timezone differences never shift booking dates.

---

## 5. Firestore Collections & Data Model

### 5.1 `bookings/{bookingId}`

Canonical booking record:

- `customerName` (`string`)
- `phone` (`string`)
- `bandName` (`string`)
- `studioId` (`'room-a' | 'room-b'`)
- `serviceId` (`'rehearsal' | 'recording' | 'mixing' | 'mastering'`)
- `serviceLabel` (`string`)
- `packageId`, `packageLabel` (`string`)
- `recordingTypeId`, `recordingTypeLabel` (`string`)
- `date` (`YYYY-MM-DD`)
- `startMinute`, `durationMinutes`, `endMinute` (`int`)
- `timeZone` (`'Asia/Jakarta'`)
- `unitRate`, `subtotal`, `discountAmount`, `totalAmount` (`number`)
- `initialPaymentStatus` (`'unpaid' | 'partial' | 'paid'`)
- `initialPaidAmount` (`number`)
- `paymentMethod` (`'cash' | 'transfer' | 'qris' | 'other' | ''`)
- `sessionStatus` (`'upcoming' | 'in_progress' | 'completed' | 'no_show' | 'cancelled'`)
- `checkedInAt`, `actualStartedAt`, `actualCompletedAt` (`Timestamp | null`)
- `checkedInByUid` (`string`)
- `notes` (`string`)
- `createdAt`, `updatedAt` (`Timestamp`)
- `createdByUid`, `updatedByUid` (`string`)
- `version` (`int`, incremented on every update to detect stale writes)

### 5.2 `bookingSlots/{date__studioId__slotStartMinute}`

Deterministic 30-minute lock documents (contains zero customer PII):

- `bookingId` (`string`)
- `date` (`YYYY-MM-DD`)
- `studioId` (`'room-a' | 'room-b'`)
- `slotStartMinute` (`int`, e.g. `600`, `630`, `660`, `690`)
- `createdAt` (`Timestamp`)

### 5.3 `bookingEvents/{eventId}`

Append-only audit log of booking lifecycle events:

- `bookingId` (`string`)
- `eventType` (`'booking_created' | 'booking_edited' | 'booking_rescheduled' | 'customer_checked_in' | 'session_started' | 'session_completed' | 'session_no_show' | 'booking_cancelled'`)
- `actorUid` (`string`)
- `createdAt` (`Timestamp`)
- `previousValue`, `newValue` (`map | null`)
- `note` (`string`)

---

## 6. Overlap Prevention, Slot Locking & Transaction Flow

### 6.1 Domain Overlap Formula

Two intervals `[start1, end1)` and `[start2, end2)` on the same `date` and `studioId` overlap iff:
$$\max(\text{start}_1, \text{start}_2) < \min(\text{end}_1, \text{end}_2)$$

- Adjacent sessions (e.g., `10:00–12:00` and `12:00–14:00`) do not overlap.
- Concurrent sessions in `room-a` and `room-b` do not block each other.
- Historical overlapping records are rendered side-by-side using `computeTimelineOverlapLayout` and are never hidden.

### 6.2 Atomic Firestore Transactions (`runTransaction`)

All write operations execute all reads before any writes:

1. **Create Booking (`createBooking`):**
   - Pre-generates `bookingId` and `eventId` via `crypto.randomUUID()` before submission for strict idempotency on retry.
   - Reads `bookings/{bookingId}`, `bookingEvents/{eventId}`, and every required `bookingSlots/{date__studioId__slotStartMinute}` lock.
   - Rejects with `booking/slot-conflict` if any 30-minute lock is held by another booking.
   - Atomically writes the booking, all 30-minute slot locks, and the `booking_created` event.
2. **Edit & Reschedule (`updateOrRescheduleBooking`):**
   - Verifies `expectedVersion === existing.version` (rejects stale overwrites with `booking/stale-update`).
   - Reads all old slot locks and all target slot locks.
   - If any target slot lock is held by another booking, aborts the entire transaction so the original schedule remains intact.
   - Deletes unused old locks, writes new locks, preserves the initial payment snapshot (`initialPaymentStatus`, `initialPaidAmount`, `paymentMethod`), increments `version`, and writes a `booking_rescheduled` or `booking_edited` event.
3. **Cancel Booking (`cancelBooking`):**
   - Never deletes `bookings/{bookingId}`.
   - Transitions `sessionStatus` to `cancelled`, deletes all `bookingSlots` owned by `bookingId`, increments `version`, and writes a `booking_cancelled` event.
4. **Session Lifecycle (`transitionBookingSession`):**
   - `check_in`: Allowed on `upcoming`; records `checkedInAt` and `checkedInByUid`.
   - `start_session`: Allowed on `upcoming`; transitions to `in_progress` and sets `actualStartedAt`.
   - `complete_session`: Allowed only on `in_progress`; transitions to `completed` and sets `actualCompletedAt`.
   - `mark_no_show`: Allowed only on `upcoming` without check-in after `scheduledStart + 15 minutes` (`Asia/Jakarta`); releases `bookingSlots` locks and records `session_no_show`.
   - Sessions never auto-complete based solely on wall-clock time.

---

## 7. Firestore Security Rules (`firestore.rules`)

- `isActiveStaff()` verifies `request.auth != null`, `staffProfiles/{uid}` exists, `active == true`, and `role in ['owner', 'staff']`.
- Anonymous visitors and inactive/unprovisioned accounts are denied all read/write access to `bookings`, `bookingSlots`, and `bookingEvents`.
- `bookings`:
  - `allow delete: if false;` prevents permanent deletion.
  - Enforces field allow-list, room enum, date format, 30-minute schedule math, non-negative pricing, and locks `initialPaymentStatus`, `initialPaidAmount`, and `paymentMethod` on update.
- `bookingSlots`:
  - Uses `existsAfter()` and `getAfter()` to verify that every created/updated slot lock references an active, non-cancelled booking with matching `date` and `studioId`.
- `bookingEvents`:
  - Append-only (`allow update, delete: if false;`), requires `actorUid == request.auth.uid`, and verifies parent booking existence via `existsAfter()`.

---

## 8. Query Boundaries & Known Limitations

- **Bounded Realtime Queries:** `subscribeBookingsInRange` queries `bookings` bounded by `[startDate, endDate]` with `limit(300)` using a single-field inequality on `date` (requiring zero extra composite indexes). If a period reaches `300` documents, the UI displays an explicit truncation banner advising the user to switch to Week or Day view.
- **Out-of-Scope Modules Deferred:** Customer directory management, full invoice/payment ledger (`Payment and Bill`), operator commissions, inventory, bookkeeping, and dynamic pricing settings UI remain deferred to their dedicated future phases.
