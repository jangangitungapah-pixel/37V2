# 37 Music Studio — Public Website Experience Overhaul & Public Availability Calendar

**Routes:** `/` (Public Landing Page) and `/availability` (Public Studio Availability Calendar)  
**Feature Module:** `src/features/public-availability/`  
**Landing Page Components:** `src/pages/LandingPage.jsx`, `src/components/landing/*`  
**Time Zone Authority:** `Asia/Jakarta` (`WIB`, UTC+7)  
**Operating Window:** `10:00` – `23:00` WIB (`600` – `1380` minutes from midnight, `30`-minute slot intervals)  
**Architecture Policy:** Firebase Spark-only, single-field Firestore queries, zero custom composite indexes, zero anonymous access to canonical booking or customer collections.

---

## 1. Landing Page Visual & Editorial Architecture

The public Landing Page (`/`) preserves the **Neo-Brutalist Editorial × Music Culture × Authentic Studio Photography** brand identity (`#F1EEE4` Studio Ivory, `#151515` Studio Ink, `#C8F13A` Studio Lime, `#FF4B22` Studio Orange, `Barlow Condensed` display, `Inter` body, `JetBrains Mono` metadata) while replacing monotonous repeated card boxes with distinct section compositions:

1. **Section 01 — Site Header (`SiteHeader.jsx`):**
   - Non-sticky top utility strip + sticky editorial navigation bar (`Services`, `Rooms`, `Gallery`, `Availability` -> `/availability`, `Contact`, `Client Login`, and primary CTA `Book a session`).
2. **Section 02 — Asymmetric 12-Column Editorial Hero (`HeroSection.jsx`):**
   - Poster-scale headline **`LOUD ROOMS FOR LOUD IDEAS.`**, structural lead paragraph, primary CTA `Book a session` (`#booking`), secondary CTA `Check availability` (`/availability`), architectural facts row, and framed studio photography (`hero-featured` placement).
3. **Section 03 — Acid-Lime Brand Ticker (`HeroSection.jsx`):**
   - Restrained horizontal studio statement strip with reduced-motion support.
4. **Section 04 — Editorial Numbered Service Index (`ServicesSection.jsx`):**
   - Asymmetrical horizontal index rows (`01 Rehearsal`, `02 Recording`, `03 Mix & Master`) replacing repetitive 3-column cardboard cards, with direct prefill actions to `#booking`.
5. **Section 05 — Photography-Led Room Showcases (`RoomsSection.jsx`):**
   - Alternating split compositions with distinct visual identities for **`Room A — Live Room`** (Ivory/Lime live floor frame) and **`Room B — Control + Booth`** (Ink/Orange control suite frame).
   - Primary room CTA: **`CHECK ROOM AVAILABILITY`** -> `/availability?room=room-a` or `/availability?room=room-b`.
   - Secondary room CTA: **`Book this room`** -> preselects the room in `#booking`.
6. **Section 06 — Gallery: Proof, Not Renders (`GallerySection.jsx`):**
   - Displays only published photographs from `usePublishedGallery()`, deduplicated by ID and URL so a single photo is never repeated to fill a grid, with an intentional editorial empty state when no photos are published.
7. **Section 07 — Public Availability Teaser (`PublicAvailabilityTeaserSection.jsx`):**
   - Full-width dark (`#151515`) contrast section (**`FIND YOUR NEXT OPEN SESSION.`**) displaying live today open slot counts from `usePublicAvailability` when `isReady === true` (and an honest readiness notice when uninitialized), plus **`VIEW FULL AVAILABILITY`** -> `/availability`.
8. **Section 08 — Step-Grouped Booking Inquiry Experience (`BookingSection.jsx`):**
   - Structured 3-part progressive flow (`01 Choose Session & Room`, `02 Choose Preferred Date & Time`, `03 Enter Contact Information`) supporting all 26 half-hour start times (`10:00` – `22:30`), URL parameter prefilling (`/?date=YYYY-MM-DD&room=room-a&time=HH:mm&service=...&duration=...#booking`), explicit disclaimer (`Availability may change. Final confirmation is subject to studio verification.`), and honest local demo preview confirmation.
9. **Section 09 & 10 — Artist Notes, Studio Location, Final CTA & Footer (`TestimonialsAndContactSection.jsx`, `SiteFooter.jsx`):**
   - Verified/pending contact safeguards, final conversion block (`Book a session`, `CHECK AVAILABILITY`, `Ask on WhatsApp`), and compact brand footer.

---

## 2. Public Availability Calendar (`/availability`) & Sanitized Data Model

### 2.1 Security & Privacy Boundary

Canonical booking collections (`bookings`, `bookingSlots`, `bookingEvents`, `customers`, `invoices`, `paymentTransactions`) remain strictly restricted to `isActiveStaff()` / `isActiveOwner()` in `firestore.rules`.

Public visitors read **only** from two sanitized collections:

1. **`publicAvailability/{bookingId}`** (1 document per active room-occupying booking, using the opaque booking document ID as the document key):

   ```json
   {
     "schemaVersion": 1,
     "date": "2026-11-25",
     "studioId": "room-a",
     "startMinute": 1140,
     "endMinute": 1260,
     "updatedAt": "<Firestore Timestamp>"
   }
   ```
   - **Strict 6-key allowlist:** `schemaVersion`, `date`, `studioId`, `startMinute`, `endMinute`, `updatedAt`.
   - **Zero PII / Internal Data:** Never contains `customerName`, `bandName`, `phone`, `customerId`, `bookingId` field, `notes`, `serviceId`, pricing, invoice, payment, or staff UIDs.

2. **`publicAvailabilityMetadata/status`** (Readiness gate document):
   ```json
   {
     "schemaVersion": 1,
     "isReady": true,
     "backfilledFromDate": "2026-11-22",
     "backfillCompletedAt": "<Firestore Timestamp>",
     "updatedAt": "<Firestore Timestamp>"
   }
   ```

---

## 3. Firestore Security Rules

In `firestore.rules`:

- `match /publicAvailability/{bookingId}`:
  - `allow read: if true;`
  - `allow create, update: if isActiveStaff() && isValidPublicAvailabilityProjectionShape(request.resource.data) && isPublicAvailabilityMatchedToCanonicalBookingAfter(request.resource.data, bookingId);`
    - Cross-verifies via `getAfter(/databases/$(database)/documents/bookings/$(bookingId))` that the canonical booking exists, is not `cancelled` or `no_show`, and matches `date`, `studioId`, `startMinute`, and `endMinute` identically.
  - `allow delete: if isActiveStaff() && isPublicAvailabilityDeleteAllowedAfter(bookingId);`
    - Requires that the canonical booking either does not exist or has transitioned to `cancelled` or `no_show`.
- `match /publicAvailabilityMetadata/{docId}`:
  - `allow get: if docId == 'status'; allow list: if false;`
  - `allow create, update: if isActiveOwner() && docId == 'status' && isValidPublicAvailabilityMetadataShape(request.resource.data);`
  - `allow delete: if false;`

---

## 4. Atomic Booking Lifecycle Synchronization

In `src/features/admin/calendar/services/calendar-booking-service.js` and `src/features/admin/calendar/repositories/calendar-booking-repository.js`:

- **Create Booking (`createBooking`):** Writes `publicAvailability/{bookingId}` inside the same Firestore transaction as `bookings/{bookingId}`, `bookingSlots/{slotId}`, `bookingEvents/{eventId}`, and `invoices/{invoiceId}`.
- **Edit / Reschedule (`updateOrRescheduleBooking`):** Updates `publicAvailability/{bookingId}` with the new `date`, `studioId`, `startMinute`, and `endMinute` inside the same transaction.
- **Cancel Booking (`cancelBooking`):** Deletes `publicAvailability/{bookingId}` inside the same transaction that releases `bookingSlots` and marks `sessionStatus = 'cancelled'`.
- **Mark No-Show (`transitionBookingSession` with `mark_no_show`):** Deletes `publicAvailability/{bookingId}` inside the same transaction that releases `bookingSlots` and marks `sessionStatus = 'no_show'`.
- **Check-In / Start Session / Complete Session:** Preserves `publicAvailability/{bookingId}` consistently with `bookingSlots`.

Canonical `bookingSlots` locks remain the sole authoritative conflict-detection mechanism.

---

## 5. Legacy Data Backfill & Readiness Gate

`backfillPublicAvailabilityProjections` in `src/features/public-availability/services/public-availability-service.js` (also triggerable by the Owner from the Admin Calendar header bar):

1. Verifies the caller is an authenticated active Owner (`actorRole === 'owner'`).
2. Sets `publicAvailabilityMetadata/status.isReady = false` before scanning.
3. Paginates through canonical `bookings` with `date >= fromDateIso` (`pageSize <= 50`).
4. Projects active bookings (`upcoming`, `in_progress`, `completed`) and deletes stale projections for `cancelled` / `no_show` bookings in small write batches (`writeBatchSize <= 8`) to stay well within Firestore Security Rules `getAfter` limits.
5. Verifies all written projections against the scanned active bookings.
6. Sets `publicAvailabilityMetadata/status.isReady = true` only when all pages and integrity checks succeed.

While `isReady !== true`, `/availability` fails closed and displays:
`Availability data is not ready yet. Please contact the studio.`

---

## 6. Availability Calculation Rules & Known Limitations

- **Time Zone:** All dates, today boundaries, and past-slot checks are evaluated in `Asia/Jakarta` (`WIB`).
- **Full Operating Window (`10:00` – `23:00` WIB):** All 26 30-minute slots (`600` to `1350` start minutes, ending at `1380`) are rendered, including late sessions between `22:00` and `23:00`.
- **Duration-Aware Start Selection:** When a visitor checks a target duration (e.g., `2 hours` / `120 minutes`), any 30-minute free slot that lacks a full contiguous `120-minute` open window before the next occupied block or `23:00` closing is marked `Limited window` (`duration_too_short`) and is non-selectable.
- **Non-Reservation Selection:** Selecting an available slot on `/availability` carries preferred parameters into `/#booking` without locking or reserving the slot.
- **Known Limitations:**
  - The public booking inquiry form on `/` remains a transparent frontend-only demo preview (`Demo Inquiry Received (Local Preview)`) with zero anonymous writes to Firestore.
  - Because no local Firebase Rules Emulator is configured in `package.json`, `firestore.rules` is verified via automated static contract assertions in `public-availability.test.jsx` alongside full unit and integration tests for the sanitization and transaction layer.

---

## 7. Verification Commands

```bash
npm run lint
npx vitest run src/features/public-availability/public-availability.test.jsx src/pages/LandingPage.test.jsx
npm run test:run
npm run build
```
