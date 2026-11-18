# 37 Music Studio — Admin Calendar & Booking Management Architecture (Phase 5 & 5A)

**Phases:**

- **Phase 5:** Admin Calendar & Booking Management
- **Phase 5A:** Calendar Timeline & Responsive UI Refinement  
  **Primary Route:** `/admin/calendar`  
  **Stack:** React 19 + Vite 8 + JavaScript (JSX) + Tailwind CSS v4 + `@base-ui/react` + Firebase Authentication + Cloud Firestore

---

## 1. Calendar Workspace Architecture

The `/admin/calendar` workspace provides the **Studio Booking Management Workspace** for 37 Music Studio while preserving the existing `AdminLayout`, `AdminSidebar`, `AdminTopbar`, and `RequireStaff` authentication boundary.

### Core Design Principles

- **Unified Shared Timeline Engine:** `Day`, `Week`, and `Month` modes all share a single `CalendarTimelineGrid` rendering architecture rather than splitting Month View into traditional calendar date cells.
- **Separation of Concerns:** UI presentation (`components/`), state subscriptions (`hooks/`), domain validation (`schemas/`), date/time/pricing math (`utils/`), and Firestore atomic transactions (`repositories/` & `services/`) are decoupled.
- **UI Interval vs. Domain Slot Lock Separation:** Timeline UI rows operate on 1-hour intervals (`10:00 – 22:00 WIB`), while internal Firestore booking slot locks remain strictly `30 minutes` (`SLOT_INTERVAL_MINUTES = 30`) so legacy `HH:30` bookings and custom 30-minute durations remain 100% intact.
- **Orthogonal Status Dimensions:** `initialPaymentStatus` (`unpaid`, `partial`, `paid`) and `sessionStatus` (`upcoming`, `in_progress`, `completed`, `no_show`, `cancelled`) remain distinct fields and separate badges.

---

## 2. Folder Structure

```text
src/features/admin/calendar/
├── components/
│   ├── BookingDetailDrawer.jsx     # Slide-over detail drawer, lifecycle controls & Firestore activity log
│   ├── BookingFormDialog.jsx       # Adaptive 4-step modal/sheet for Create, Edit & Reschedule
│   ├── CalendarBookingCard.jsx     # Adaptive proportional timeline booking block (Room A/B accents)
│   ├── CalendarDayView.jsx         # Single-date wrapper (Room A & Room B side-by-side timeline)
│   ├── CalendarFilters.jsx         # Symmetric room filter, search, Show Cancelled & 2x2 mobile payment filter
│   ├── CalendarGrid.jsx            # View mode orchestrator + loading, error & truncation states
│   ├── CalendarMonthView.jsx       # Full-month (28/29/30/31 days) horizontal timeline wrapper
│   ├── CalendarTimelineGrid.jsx    # Unified hourly CSS Grid timeline with sticky left time column & 22:00 boundary
│   ├── CalendarToolbar.jsx         # Compact toolbar: heading, + New Booking CTA, Prev/Today/Next, date picker & view switcher
│   ├── CalendarViewSwitcher.jsx    # Symmetric 3-column Day / Week / Month segmented control
│   ├── CalendarWeekView.jsx        # 7-day Monday–Sunday horizontal timeline wrapper
│   └── UpcomingBookings.jsx        # Chronological upcoming sessions panel linked to BookingDetailDrawer
├── config/
│   └── calendar-config.js          # Internal slot rules (30m) separated from display hourly config (10:00–22:00)
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
│   ├── booking-time.js             # Overlap math, deterministic 30m slot builder & proportional hourly positioning
│   └── calendar-date.js            # Asia/Jakarta date utilities, strict YYYY-MM-DD validation & exact month ranges
└── calendar.test.jsx               # Unit, transaction, UI, responsive Month/Timeline & security rules tests
```

---

## 3. Unified Calendar View Modes (Day / Week / Month)

All three modes render inside the shared `CalendarTimelineGrid` with a sticky left `WIB` time column (`10:00` – `22:00`):

- **Day View (`day`):**
  - Displays a single active date with `Room A` and `Room B` side-by-side when `All Rooms` is selected (or only the filtered room).
- **Week View (`week`):**
  - Displays 7 consecutive Monday–Sunday columns (`getWeekStartIso`), showing Room A and Room B bookings simultaneously positioned by time and split into non-overlapping lanes when concurrent.
  - Clicking any date column header opens `Day View` for that date.
- **Month View (`month`):**
  - Replaced traditional date-box cells with a **unified horizontal month timeline** displaying all actual days of the active month (`28`, `29`, `30`, or `31` columns — zero filler days from neighboring months, zero `+N booking` truncation).
  - Clicking any day header jumps to `Day View` for that date; horizontal scrolling smoothly navigates the full month while the left `WIB` time column remains pinned.
- **Default View Selection:** Desktop (`>= 1024px`) defaults to `month`; Mobile/Tablet (`< 1024px`) defaults to `week`.
- **Period Navigation:** `Previous` / `Next` shifts by 1 day in `day`, 7 days in `week`, and 1 calendar month in `month`. `Today` jumps back to today's `Asia/Jakarta` date, highlighted with Studio Lime (`Hari Ini`).

---

## 4. Display Time Interval & Existing Booking Compatibility

- **Timeline Display Config (`calendar-config.js`):**
  - `CALENDAR_DISPLAY_INTERVAL_MINUTES = 60` (`1 hour`)
  - `CALENDAR_DISPLAY_START_MINUTE = 600` (`10:00 WIB`)
  - `CALENDAR_DISPLAY_END_MINUTE = 1320` (`22:00 WIB` boundary label, not a new booking start slot)
  - `TIMELINE_HOURLY_SLOTS`: `10:00` through `21:00` (12 hourly slots).
  - `CALENDAR_TIMELINE_ROW_HEIGHT_PX = 60` (`1px = 1 minute` scaling).
- **Booking Positioning (`computeHourlyTimelineBlockMetrics`):**
  - `topPx` and `heightPx` are computed directly from integer minutes (`(startMinute - 600) / 60 * 60px` and `durationMinutes / 60 * 60px`) without rounding up to full hours.
  - Existing `HH:30` bookings and 30-minute bookings render proportionally at half-row offsets/heights.
  - When editing an existing booking whose `startMinute` is not on an hourly mark (e.g., `10:30` / `630`), `BookingFormDialog` dynamically preserves that start time as a labeled option (`10:30 WIB (Jadwal Eksisting)`).
  - Bookings that continue past or begin at/after `22:00 WIB` remain intact and trigger explicit interactive overflow indicators (`Sesi lewat 22:00 WIB` strip + card continuation badge) so late sessions are never hidden.

---

## 5. Responsive Layout & ~15% Visual Scale Refinement

- Viewport baseline lowered to `min-width: 280px` in `src/styles/index.css` to support ultra-narrow cover screens such as the Galaxy Z Fold 6 (`286px`) without page-level horizontal overflow.
- Added `.cal-card` and `.cal-control` compact workspace primitives (~15% tighter paddings, borders, headings, and vertical timeline height reduced from `1196–1352px` down to `720px`) while maintaining `44px` minimum CSS touch targets.
- Toolbar (`Prev / Today / Next`, Date Picker, 3-column symmetric `Day | Week | Month` switcher) and Filters (`grid-cols-3` Room selector, full-width Search + aligned `Show Cancelled` toggle, balanced `grid-cols-2` mobile Payment Status selector + aligned Result Count) maintain consistent alignment and symmetry across `286px`–`1440px`.
- Horizontal scrolling is strictly scoped inside the timeline grid wrapper (`overflow-x-auto overscroll-x-contain`) with a sticky `left-0` `WIB` time column and synchronized header/body grid tracks.

---

## 6. Firestore Collections, Transactions, Slot Locking & Rules

- **Core Collections (unchanged from Phase 5):**
  1. `bookings/{bookingId}` — Canonical booking document with customer snapshot, schedule minutes, pricing snapshot, initial payment snapshot, `sessionStatus`, and concurrency `version`.
  2. `bookingSlots/{date__studioId__slotStartMinute}` — Deterministic `30-minute` (`SLOT_INTERVAL_MINUTES = 30`) lock documents containing zero customer PII.
  3. `bookingEvents/{eventId}` — Append-only immutable activity history.
- **Transactions (`runTransaction`):** `createBooking`, `updateOrRescheduleBooking`, `cancelBooking`, and `transitionBookingSession` execute all reads before writes, enforce deterministic 30-minute lock ownership, prevent concurrent double booking and stale overwrites, enforce the 15-minute `Asia/Jakarta` grace period for `No Show`, and maintain UUID idempotency across retries.
- **Firestore Security Rules (`firestore.rules`):** Unchanged from Phase 5 (`isActiveStaff()`, `allow delete: if false` on `bookings`, immutable initial payment snapshot on update, atomic `existsAfter`/`getAfter` checks on `bookingSlots`, append-only `bookingEvents`).

---

## 7. Query Boundaries & Known Limitations

- **Bounded Realtime Queries:** `subscribeBookingsInRange` queries `bookings` bounded by `[startDate, endDate]` with `limit(300)` using a single-field range query on `date` (no additional composite indexes required). If `300` documents are reached in a viewed range, an explicit truncation notice guides operators to narrower Week or Day views.
- **Out-of-Scope Modules Deferred:** Customer directory management, Payment and Bill ledger/refunds, Commission and Fee, Inventory, Pembukuan, Settings management, and Firestore deployment remain deferred to future phases or explicit user direction.
