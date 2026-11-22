# Customer Review Management Architecture — 37 Music Studio

## 1. System Overview & Goals

The **Customer Review Management System** provides a first-party, booking-linked customer review lifecycle operating strictly within the approved **Firebase Spark** plan (**Firebase Authentication + Cloud Firestore + Firebase Hosting**), replacing the previously removed third-party Google Maps Places integration (`GoogleReviewsSection`) and manual Landing Page testimonial editor (`verifiedTestimonials`).

End-to-end flow:

1. A studio booking reaches `sessionStatus === 'completed'` (with `actualCompletedAt`, `deliveryMode === 'studio'`, `customerId`, and a verified WhatsApp phone number).
2. Active Staff or Owner opens the booking in Calendar (`BookingDetailDrawer`), clicks **Request Customer Review**, and generates a high-entropy single-use review invitation URL (`/review/:token`).
3. Staff manually opens WhatsApp via a generated **Click-to-Chat (`wa.me`)** link or copies the message + URL and presses **Send** inside WhatsApp.
4. Customer opens `/review/:token` without signing in, inspects limited non-PII session context, fills display name, 1–5 star rating, written review, and explicit publication consent (`consentToPublish: true`), then submits.
5. Client obtains a Firebase App Check token (when configured), commits an atomic 2-write transaction creating `customerReviews/{bookingId}` (`status: 'pending'`) and transitioning `reviewInvitations/{tokenHash}` from `'active'` to `'submitted'`.
6. Studio Owner reviews incoming submissions inside the Owner-only **Reviews** workspace (`/admin/reviews`), moderating transitions between `pending`, `published`, `rejected`, and `archived` without ever modifying customer-written text or consent flags.
7. Publishing or unpublishing atomically updates `publicReviewStats/summary`.
8. The public Landing Page (`CustomerReviewsSection` on `/`) subscribes only to `status == 'published'` reviews and `publicReviewStats/summary`.

## 2. Firebase Spark-Only Architecture & Operational Policy

- **Zero backend servers or paid billing:** No Cloud Functions, no Blaze billing, no Cloudflare Workers, no external APIs, and no Firebase Storage.
- **No automated outbound WhatsApp messaging:** Staff manually sends invitation links using Click-to-Chat (`buildWhatsAppClickToChatUrl`).
- **Firestore queries & indexes:** Minimal composite index on `customerReviews` (`status` ASC, `publishedAt` DESC) defined in `firestore.indexes.json` to power the Landing Page bounded query (`limit(9)`).

## 3. Data Model & Firestore Collections

### 3.1 `reviewInvitations/{tokenHash}`

Document ID is the lowercase 64-hex SHA-256 hash of the raw 64-hex bearer token. Raw tokens are **never** stored anywhere in Firestore, logs, or URLs persisted to DB.

- `schemaVersion`: `1`
- `bookingId`: string (`bookings/{bookingId}`)
- `serviceLabelSnapshot`: string (e.g., `"Rehearsal Band"`)
- `sessionDate`: ISO `YYYY-MM-DD`
- `studioId`: `'' | 'room-a' | 'room-b'`
- `status`: `'active' | 'submitted' | 'revoked'`
- `issuedByUid`: staff/owner UID
- `issuedAt`: server timestamp
- `expiresAt`: timestamp (30 days after issuance)
- `submittedAt`: server timestamp or `null`
- `revokedAt`: server timestamp or `null`
- `revokedByUid`: string (`''` until revoked)
- `version`: positive integer starting at `1`

**Privacy hygiene:** Contains **zero** customer phone numbers, emails, private booking financial amounts, internal notes, or raw bearer tokens.

### 3.2 `reviewInvitationIndexes/{bookingId}`

One lookup document per eligible booking tracking the latest invitation hash for rotation and calendar drawer inspection:

- `schemaVersion`: `1`
- `bookingId`: string (matches document ID)
- `activeInvitationId`: 64-hex `tokenHash`
- `issuedAt`: server timestamp
- `expiresAt`: timestamp
- `version`: integer incremented on rotation

### 3.3 `customerReviews/{bookingId}`

Document ID equals `bookingId`, enforcing a **strict maximum of 1 submitted review per booking**:

- `schemaVersion`: `1`
- `bookingId`: string (equals doc ID)
- `invitationId`: 64-hex `tokenHash` used during submission
- `displayName`: string (`2..80` chars)
- `rating`: integer (`1..5`)
- `reviewText`: string (`10..1500` chars)
- `serviceLabelSnapshot`: string (copied from invitation at submit time)
- `sessionDate`: string (`YYYY-MM-DD`, copied from invitation)
- `consentToPublish`: boolean (must be `true` on create, immutable thereafter)
- `consentVersion`: `'customer-review-publication-v1'`
- `status`: `'pending' | 'published' | 'rejected' | 'archived'`
- `createdAt`, `updatedAt`: server timestamps
- `publishedAt`: server timestamp when `status == 'published'`, otherwise `null`
- `version`: integer incremented per moderation step

### 3.4 `publicReviewStats/summary`

Singleton public aggregate document atomically maintained inside Owner moderation transactions:

- `schemaVersion`: `1`
- `publishedCount`: non-negative integer
- `ratingSum`: non-negative integer
- `ratingDistribution`: `{ "1": int, "2": int, "3": int, "4": int, "5": int }`
- `updatedAt`: server timestamp

## 4. Token Generation, SHA-256 Hashing & Privacy

- `generateReviewToken()` (`src/features/customer-reviews/utils/review-token.js`) uses `window.crypto.getRandomValues` (32 bytes -> 64 lowercase hex characters = 256-bit entropy).
- `hashReviewToken()` computes SHA-256 via `crypto.subtle.digest('SHA-256', ...)` with deterministic `sha256HexSync` fallback for Node/test parity (`src/features/admin/customer/utils/phone-number.js`).
- `PublicReviewSubmissionPage` sets `<meta name="referrer" content="no-referrer" />` while mounted to prevent referrer header leakage when navigating away from `/review/:token`.
- `ReviewInvitationShareDialog` displays the raw URL strictly in ephemeral UI memory so Staff can copy or open WhatsApp once.

## 5. Eligibility Rules & One-Review-Per-Booking Guarantees

Implemented symmetrically in `evaluateBookingReviewEligibility()` (`review-invitation-service.js`) and `isBookingEligibleForReviewInvitation(bookingId)` (`firestore.rules`):

- `booking.sessionStatus === 'completed'`
- `booking.actualCompletedAt` is present / valid timestamp
- `booking.deliveryMode === 'studio'` (excludes remote async post-production)
- Non-empty `booking.customerId`
- Verified WhatsApp-capable normalized phone (`+62...` check in application service)
- No existing `customerReviews/{bookingId}` document (`!exists(...)`)

Re-issuing an invitation (`issueReviewInvitation`) atomically revokes the previous active invitation (`active -> revoked`), creates a new hashed document (`version: 1`), and updates `reviewInvitationIndexes/{bookingId}`.

## 6. Atomic Transaction Boundaries

1. **Issuance / Rotation (`issueReviewInvitation`):** Reads `bookings/{id}`, `reviewInvitationIndexes/{id}`, `customerReviews/{id}`, and prior invitation; atomically revokes prior active invitation (if any), creates new `reviewInvitations/{newHash}`, and updates index.
2. **Public Submission (`submitCustomerReview`):** Validated after App Check attempt + honeypot check + Zod validation. Atomically creates `customerReviews/{bookingId}` (`status: 'pending'`) and transitions `reviewInvitations/{tokenHash}` (`active -> submitted`, `submittedAt: serverTimestamp()`). Bidirectional `exists` + `get` + `getAfter` checks in `firestore.rules` block splitting or replaying either write.
3. **Owner Moderation (`moderateCustomerReview`):** Atomically transitions `customerReviews/{bookingId}` across the allowed matrix and updates `publicReviewStats/summary` whenever visibility crosses into or out of `published`.

## 7. Moderation State Machine & Content Integrity

Allowed transitions (`ALLOWED_REVIEW_MODERATION_TRANSITIONS` & `isValidCustomerReviewModerationUpdate`):

- `pending` -> `published` or `rejected`
- `rejected` -> `pending` or `published`
- `published` -> `archived`
- `archived` -> `published` or `rejected`

**Immutability invariant:** Customer-submitted fields (`displayName`, `rating`, `reviewText`, `serviceLabelSnapshot`, `sessionDate`, `consentToPublish`, `consentVersion`, `bookingId`, `invitationId`, `createdAt`) cannot be modified by Owner or Staff under any Security Rules path.

## 8. Role-Based Access Control (RBAC)

- **Staff (`staff`, `active == true`):**
  - Can view review eligibility/invitation panel in Calendar `BookingDetailDrawer`.
  - Can issue, rotate, or revoke booking review invitations (`reviewInvitations`, `reviewInvitationIndexes`).
  - **Blocked** from moderating reviews, reading Owner-only `/admin/reviews` route (`RequireOwner`), or writing `publicReviewStats/summary`.
- **Owner (`owner`, `active == true`):**
  - Full Staff capabilities plus `/admin/reviews` moderation inbox, publishing/archiving/rejecting reviews, and atomic `publicReviewStats/summary` updates.
- **Public (`request.auth == null`):**
  - Can `get` only a specific `reviewInvitations/{tokenHash}` when active & unexpired OR submitted (revoked, expired, and missing hashes return uniform `403 permission-denied`).
  - Can `create` one `pending` review only in a paired transaction consuming the valid active invitation.
  - Can `get` / `list` `customerReviews` **only** where `status == 'published'` and `get` `publicReviewStats/summary`.

## 9. Security Rules, App Check & Trust Boundaries

- **Unauthenticated Read Privacy:** Public list queries against `reviewInvitations`, `reviewInvitationIndexes`, `publicReviewStats` collection, and unfiltered `customerReviews` queries fail with `403`.
- **Statistics Integrity:** `isValidPublicReviewStatsWrite` validates exact arithmetic consistency (`publishedCount == sum(dist)` and `ratingSum == 1*d1 + 2*d2 + 3*d3 + 4*d4 + 5*d5`). Because updates occur client-side inside Owner transactions, an authenticated malicious Owner modifying rules-compliant docs represents an intentional Spark trust boundary, mitigated by Owner-only access, version checks, and strict arithmetic constraints.
- **Anti-Spam:** Public form validates length limits via Zod, blocks submission cleanly if hidden honeypot field is filled, and calls `ensureAppCheckTokenForPublicWrite()` before executing Firestore writes when App Check is configured.

## 10. Factory Reset & Deprecation Alignment

- **Operational Factory Reset (`src/features/admin/settings/danger-area`):**
  - `reviewInvitations` (step 18) and `reviewInvitationIndexes` (step 19) are **deleted** before `bookings` (step 20) inside the 20-target manifest so no dangling unsubmitted invitations survive a reset.
  - `customerReviews` and `publicReviewStats/summary` have `allow delete: if false` in `firestore.rules` and remain **preserved** across Factory Reset so verified published customer testimonials and public rating totals remain intact.
- **Legacy Deprecation:**
  - Removed all Google Places code (`GoogleReviewsSection`, `places-client.js`, `VITE_GOOGLE_MAPS_*` env keys, Google Maps review docs/handoffs).
  - Removed `verifiedTestimonials` public rendering from `TestimonialsAndContactSection.jsx` and disabled manual testimonial creation in `PublicSiteSettingsForm.jsx` while keeping existing legacy field data harmlessly intact in `publicSiteSettings/site`.
  - Studio Google Maps directions (`mapsUrl`) and WhatsApp studio buttons remain completely untouched.

## 11. Verification Commands

```bash
# Real Local Firestore Emulator Security Rules Suite
npm run test:rules

# Full Vitest Unit & Integration Test Suite
npm run test:run

# ESLint + Production Vite Build
npm run lint
npm run build
```
