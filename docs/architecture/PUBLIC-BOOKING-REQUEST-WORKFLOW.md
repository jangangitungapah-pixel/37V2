# Public Booking Request, Admin Inbox & WhatsApp Click-to-Chat Architecture

**Application:** 37 Music Studio (Firebase Spark + Cloudinary Media + React 19 + Vite)  
**Baseline Commit:** `43cb977b8e6eb3d126e57ae465751fb05b7f1082`  
**Deployment Model:** Static SPA on Firebase Hosting + Cloud Firestore + Firebase Auth + Firebase App Check (ReCaptcha v3). Zero Paid Cloud Functions / Third-Party Messaging SaaS Required.

---

## 1. End-to-End Operational Lifecycle

```
Public Website (/, /availability, /privacy)
   │  reads publicSiteSettings/site (sanitized config)
   │  reads galleryPlacements / galleryItems (published media)
   │  reads publicAvailability / publicAvailabilityMetadata (busy/open blocks)
   ▼
submitPublicBookingRequest() ──► publicBookingRequests/{requestId} (status = 'new', version = 1)
   │  guarded by Firebase App Check (when site key configured), Zod + client dwell/honeypot/cooldown,
   │  and strict 33-key Firestore Security Rules create allowlist
   ▼
Admin Workspace Alert & Inbox (/admin/dashboard, Sidebar Badge, /admin/booking-requests)
   │  Single shared bounded subscription (BookingRequestAlertsProvider: status == 'new', limit 20, UI badge cap 9+)
   │  Owner & Staff open BookingRequestDetailDrawer:
   │    • Inspect customer request details + live Calendar conflict check on requested date
   │    • Transition status cleanly: new -> in_review / awaiting_customer / accepted / declined / closed
   │    • IMPORTANT: Accepted !== Confirmed (Accept never locks room slots)
   ▼
WhatsApp Communication (Click-to-Chat, Spark-Only)
   │  13 allowlisted placeholders rendered safely via pure string substitution (zero eval())
   │  Opens https://wa.me/<digits>?text=<encoded>
   │  Immutable log to /communications/{eventId}:
   │    Draft -> Prepared in WhatsApp (whatsapp_message_prepared) -> Manually marked sent (whatsapp_message_marked_sent)
   │  Never fabricates "Delivered" or "Read" receipts
   ▼
Calendar Conversion & Canonical Booking Confirmation
   │  Link: /admin/calendar?action=new-booking&requestId={requestId}
   │  Studio Booking ONLY (post_production_inquiry / Mix & Master blocked from room booking)
   │  Dynamic pricing catalog mapping against active internal Studio services (ambiguous catalog forces manual selection)
   ▼
createBooking({ ..., bookingRequestId })  [Single Atomic Firestore runTransaction]
   ├─ creates bookings/{bookingId}
   ├─ creates 30-min bookingSlots/{date__studioId__slotStartMinute} locks (rollback on conflict)
   ├─ updates publicAvailability/{bookingId} projection
   ├─ creates/updates customers/{customerId} + customerPhoneIndex/{phoneHash}
   ├─ creates invoices/{invoiceId} (+ optional initial payment transaction)
   ├─ updates publicBookingRequests/{requestId}:
   │    status = 'confirmed', linkedBookingId = bookingId, confirmedBookingSnapshot (10 fields), version += 1
   └─ creates publicBookingRequests/{requestId}/activities/{eventId} (booking_confirmed)
```

---

## 2. Service Branch Separation (`studio_booking` vs `post_production_inquiry`)

- **`studio_booking` (`rehearsal`, `recording`)**
  - Requires `requestedRoomId` (`room-a`, `room-b`, or `any`), `preferredDate` (`YYYY-MM-DD`, today or future in Asia/Jakarta), `preferredStartMinute` (30-minute step within operating hours `600..1350`), and `preferredDurationMinutes` (`60..780`, multiple of 30, `start + duration <= 1380`).
  - Sets `targetDeadline: null`.
  - Eligible for Calendar conversion via `/admin/calendar?action=new-booking&requestId={requestId}` and atomic confirmation inside `createBooking()`.

- **`post_production_inquiry` (`mix-master`)**
  - Strictly WFA / non-room workflow. Forces `requestedRoomId: null`, `preferredDate: null`, `preferredStartMinute: null`, `preferredDurationMinutes: null`.
  - Supports optional `targetDeadline` (`YYYY-MM-DD`).
  - Blocked from entering the Admin Calendar slot-locking flow (`canTransitionBookingRequestStatus`, `AdminCalendarPage`, `createBooking`, and `firestore.rules` all reject `confirmed` transitions for `post_production_inquiry`).

---

## 3. Firestore Collection Contracts & Security Model

### 3.1 `publicSiteSettings/site` (17 keys)

Publicly readable sanitized website configuration (`allow get: if docId == 'site'; allow list: if false;`).  
Written atomically by active Owners inside `saveStudioProfileTransaction` (`settings/studioProfile` + `publicSiteSettings/site`), stripping internal staff audit fields (`updatedByUid`, `version`, etc.).

Keys enforced in `firestore.rules`:

- `schemaVersion` (`1`), `studioName`, `tagline`, `publicWhatsappNumber` (E.164 or `''`), `publicEmail`, `publicAddress`, `city`, `mapsUrl` (`https?://` or `''`), `operatingHours`, `publishedServices` (list 1..6), `publishedRooms` (list 1..4), `socialLinks` (list <=6), `verifiedTestimonials` (list <=12), `seoTitle`, `seoDescription`, `isPublished` (bool), `updatedAt` (timestamp).

### 3.2 `publicBookingRequests/{requestId}` (33 keys)

- **Public Create (`allow create`):** Unauthenticated visitors may create a document only if all 33 allowed keys exist with exact initial state (`schemaVersion == 1`, `status == 'new'`, `statusReason == ''`, `version == 1`, `privacyConsent == true`, `consentVersion == 'v1'`, valid `REQ-[A-Z0-9]{8}` reference, canonical E.164 `contactPhone`, `createdAt == request.time`, `updatedAt == request.time`, `linkedBookingId == null`, `confirmedBookingSnapshot == null`, `appCheckState in ['verified', 'unconfigured']`).
- **Admin Read & Update (`allow read, update: if isActiveStaff()`):**
  - Immutable customer fields verified via `isBookingRequestCustomerFieldsUnchanged(nextData, prevData)`.
  - Optimistic concurrency enforced via `nextData.version == prevData.version + 1`.
  - Transition to `confirmed` requires:
    - `prevData.requestType == 'studio_booking'`
    - `prevData.status in ['new', 'in_review', 'awaiting_customer', 'accepted']`
    - `prevData.linkedBookingId == null`
    - `existsAfter(/databases/$(database)/documents/bookings/$(nextData.linkedBookingId))` and `getAfter(...)` matching the 10-key `confirmedBookingSnapshot` (`bookingId`, `bookingReference`, `studioId`, `studioName`, `serviceTypeName`, `serviceOptionName`, `date`, `startMinute`, `endMinute`, `durationMinutes`).
  - Transitions to `declined` or `closed` require `statusReason` (3..400 chars).
- **Deletes:** `allow delete: if false`.

### 3.3 `publicBookingRequests/{requestId}/communications/{eventId}` (9 keys)

- Read & append-only create by `isActiveStaff()`, `allow update, delete: if false`.
- `eventType` in `['whatsapp_message_prepared', 'whatsapp_message_marked_sent', 'staff_note_added']`.
- Keys: `templateId`, `templateLabel`, `messageBodySnapshot`, `eventType`, `preparedAt`, `preparedByUid`, `manuallyMarkedSentAt`, `manuallyMarkedSentByUid`, `createdAt`.

### 3.4 `publicBookingRequests/{requestId}/activities/{eventId}` (8 keys)

- Read & append-only create by `isActiveStaff()`, `allow update, delete: if false`.
- `eventType` in `['request_created', 'status_changed', 'booking_confirmed', 'staff_assigned']`.
- Keys: `eventType`, `fromStatus`, `toStatus`, `linkedBookingId`, `note`, `actorUid`, `actorName`, `createdAt`.

### 3.5 `bookingRequestMessageTemplates/{templateId}` (14 keys)

- Read by `isActiveStaff()`, create/update by `isActiveOwner()` only, `allow delete: if false`.
- Code defaults provide 8 built-in templates (`request_received`, `request_under_review`, `needs_more_info`, `alternative_slot`, `request_accepted`, `booking_confirmed` [locked until `status === 'confirmed' && linkedBookingId`], `request_declined`, `post_production_received`).
- Pure string substitution renderer supports 13 allowlisted variables without `eval()`:
  `customerName`, `bandName`, `requestReference`, `serviceName`, `roomName`, `preferredDate`, `preferredTime`, `duration`, `confirmedDate`, `confirmedTime`, `confirmedEndTime`, `bookingReference`, `studioName`.

---

## 4. Query Strategy (Zero New Composite Indexes)

All listeners use single-field queries and in-memory filtering/sorting, avoiding composite index overhead in `firestore.indexes.json`:

- Sidebar/Dashboard badge (`subscribeNewBookingRequests`): `where('status', '==', 'new'), limit(21)` (UI caps badge at `9+`, keeps at most 20 items in memory).
- Admin Inbox (`subscribeBookingRequests` & `fetchMoreBookingRequests`): `orderBy('createdAt', 'desc'), limit(pageSize + 1)` (`pageSize = 50`) with cursor pagination (`startAfter`).
- Timeline subcollections (`communications`, `activities`): `orderBy('createdAt', 'desc'), limit(100)`.
- Templates (`subscribeTemplates`): collection query with `limit(50)`, merged cleanly with defaults on read without auto-writing Firestore.

---

## 5. Honest Spark-Only Anti-Spam & Verification Boundaries

- Client-side guards (honeypot `website` field, minimum dwell time `1000ms`, and `15s` per-session cooldown) provide lightweight UI friction only — a determined attacker calling the Firestore REST API directly can bypass client JavaScript.
- Real abuse deterrence rests on **Firebase App Check (ReCaptcha v3)** enforcement in Firebase Console plus strict **Firestore Security Rules** shape/enum/length checks.
- On the free **Firebase Spark** plan (no Cloud Functions / per-IP server rate limiter), true per-IP server rate limiting is not possible; abuse spike mitigation relies on enabling App Check enforcement in Firebase Console once the site key is registered.
- **Security Rules Emulator Status:** `firestore.rules` has been updated and statically verified in automated tests, **but live Firebase Rules Emulator execution (`firebase emulators:exec`) was not executed in this workspace**. Run the Firebase Rules Emulator before deploying rules to production.

---

## 6. Firebase App Check Configuration

Implemented in `src/lib/firebase/app-check.js`:

- Environment variable in `.env.example`: `VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY=`
- Guarded local development token (`VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`): strictly disabled when `import.meta.env.PROD` is true.
- Singleton `initializeFirebaseAppCheck()` calls `initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true })` once per runtime session.
- `ensureAppCheckTokenForPublicWrite()` runs prior to unauthenticated `publicBookingRequests` writes and records truthful `appCheckState` (`verified` vs `unconfigured`).

---

## 7. Manual Firebase Console & Deployment Checklist (Not Executed Automatically)

No git commits, pushes, merges, or `firebase deploy` actions were executed. Complete these 7 steps before production rollout:

1. **Register reCAPTCHA v3 Site Key:** Create a reCAPTCHA v3 key in Google Cloud / reCAPTCHA Admin for the Studio's production domain(s) and Hosting `.web.app` / `.firebaseapp.com` domains.
2. **Enable App Check in Firebase Console:** Register the web app under Firebase Console -> App Check -> reCAPTCHA v3 using the secret key.
3. **Configure Local Environment Variables:** Set `VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY=<site-key>` in local `.env.local` (and CI secrets) without committing secrets to Git.
4. **Verify Rules in Firebase Emulator:** Test `firestore.rules` against `publicSiteSettings/site`, `publicBookingRequests` create/update/confirm `getAfter()`, subcollections, and `bookingRequestMessageTemplates` using the Firebase Emulator Suite.
5. **Deploy Firestore Security Rules (`firebase deploy --only firestore:rules`):** Publish the updated `firestore.rules` first so client writes conform to production rules.
6. **Initialize Public Site Settings as Owner:** Sign in to `/admin/settings/studio-profile` as Owner and save Studio Profile + Public Website Config to write the initial sanitized `publicSiteSettings/site` projection (verified testimonials, WhatsApp number, operating hours, SEO fields).
7. **Build & Deploy Hosting (`npm run build && firebase deploy --only hosting`):** Smoke-test end-to-end `/` submission -> `/admin/booking-requests` -> WhatsApp Click-to-Chat -> `/admin/calendar` conversion -> atomic `confirmed` status -> `/availability` projection reflection.
