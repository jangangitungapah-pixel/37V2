# Danger Area & Operational Factory Reset Architecture — 37 Music Studio

## 1. Purpose & Scope

The **Danger Area & Operational Factory Reset** module (`/admin/settings/danger-area`) enables an authenticated, active **Studio Owner** to permanently wipe all historical operational and customer-related data so the studio can start fresh from zero without losing authentication accounts, studio configuration, message templates, gallery library items, or published landing page media placements.

## 2. Explicit Scope — What Is Deleted vs. What Is Preserved

### 2.1 Deleted Operational Targets (18 Targets in Dependency Order)

Every deletion runs strictly against the explicit allowlisted `FACTORY_RESET_DELETION_MANIFEST` (`src/features/admin/settings/danger-area/config/factory-reset-config.js`) — never a wildcard database sweep:

| Order | Manifest Key                           | Path / Pattern                                     | Kind          | Group                                        |
| ----: | :------------------------------------- | :------------------------------------------------- | :------------ | :------------------------------------------- |
|     1 | `publicBookingRequests_communications` | `publicBookingRequests/{requestId}/communications` | Subcollection | Booking Requests & History                   |
|     2 | `publicBookingRequests_activities`     | `publicBookingRequests/{requestId}/activities`     | Subcollection | Booking Requests & History                   |
|     3 | `publicBookingRequests`                | `publicBookingRequests`                            | Collection    | Booking Requests & History                   |
|     4 | `bookingEvents`                        | `bookingEvents`                                    | Collection    | Booking & Scheduling                         |
|     5 | `bookingSlots`                         | `bookingSlots`                                     | Collection    | Booking & Scheduling                         |
|     6 | `publicAvailability`                   | `publicAvailability`                               | Collection    | Public Availability Projections              |
|     7 | `paymentTransactions`                  | `paymentTransactions`                              | Collection    | Financial, Payment, Commission & Bookkeeping |
|     8 | `invoices`                             | `invoices`                                         | Collection    | Financial, Payment, Commission & Bookkeeping |
|     9 | `commissionReviewResolutions`          | `commissionReviewResolutions`                      | Collection    | Financial, Payment, Commission & Bookkeeping |
|    10 | `commissionPostingItems`               | `commissionPostingItems`                           | Collection    | Financial, Payment, Commission & Bookkeeping |
|    11 | `commissionBatches`                    | `commissionBatches`                                | Collection    | Financial, Payment, Commission & Bookkeeping |
|    12 | `bookkeepingSettlements`               | `bookkeepingSettlements`                           | Collection    | Financial, Payment, Commission & Bookkeeping |
|    13 | `bookkeepingEntries`                   | `bookkeepingEntries`                               | Collection    | Financial, Payment, Commission & Bookkeeping |
|    14 | `inventoryMovements`                   | `inventoryMovements`                               | Collection    | Inventory Master & Movements                 |
|    15 | `inventoryItems`                       | `inventoryItems`                                   | Collection    | Inventory Master & Movements                 |
|    16 | `customerPhoneIndex`                   | `customerPhoneIndex`                               | Collection    | Customer Records                             |
|    17 | `customers`                            | `customers`                                        | Collection    | Customer Records                             |
|    18 | `bookings`                             | `bookings`                                         | Collection    | Booking & Scheduling                         |

**Subcollection Safety Invariant:** Steps 1 and 2 delete and verify empty every `communications` and `activities` subcollection document per parent `publicBookingRequests/{requestId}`, and Step 3 (`processTopLevelCollectionStep` for `publicBookingRequests`) additionally re-verifies child emptiness right before deleting each parent batch so orphaned subcollections cannot remain behind.

### 2.2 Preserved Assets & Configuration

- **Firebase Authentication accounts** (untouched).
- **`staffProfiles/{uid}`** (active Owner and Staff authorization records preserved; delete denied in Firestore Rules even during reset).
- **`settings/studioProfile`** (studio name, address, official WhatsApp number, Maps coordinates).
- **`settings/pricing`** (services, hourly/package rates, duration discounts, fee rules).
- **`bookkeepingSettings/default`** (bookkeeping opening configuration).
- **`publicSiteSettings/site`** (published website settings & copy).
- **`bookingRequestMessageTemplates`** (WhatsApp operational templates).
- **`galleryItems`** & **`landingPagePlacements`** (gallery photos and public landing page placements).
- **Cloudinary Media Assets** (Factory Reset **never** invokes Cloudinary delete or admin APIs).
- **`publicAvailabilityMetadata/status`** (preserved doc; set to `isReady: false` during reset execution and reinitialized to `{ isReady: true, backfilledFromDate: <today Asia/Jakarta ISO> }` once all 18 operational targets are verified empty).
- **`systemOperations/factoryReset`** (minimal non-PII operational state & audit record; delete denied in Firestore Rules).

## 3. Defense-in-Depth Security & Authorization

1. **UI Visibility (`AdminSettingsPage.jsx`)**: The Danger Area card (`settings-danger-area-card`, `OWNER ONLY`) is rendered only when `isOwner` is true (`role === 'owner'` and `profile.role === 'owner'`).
2. **Route Guard (`src/features/auth/RequireOwner.jsx`)**: Protects `/admin/settings/danger-area` in `src/App.jsx`. Requires `status === 'authenticated'`, active profile (`profile?.active === true`), and Owner role (`role === 'owner' && profile.role === 'owner'`). Non-Owner Staff are stopped cleanly with `require-owner-denied`.
3. **Service Authorization (`assertActiveOwnerActor`)**: Every service entry point (`previewFactoryReset`, `startFactoryReset`, `resumeFactoryReset`, `cancelFactoryResetBeforeDeletion`) independently asserts active Owner status.
4. **Fresh Current-Password Re-Authentication**:
   - `reauthenticateCurrentStaff(password)` (`src/features/auth/auth-service.js`) uses Firebase Authentication `EmailAuthProvider.credential` + `reauthenticateWithCredential` and re-validates the active `staffProfiles/{uid}` profile.
   - `assertFreshReauthentication` enforces a 5-minute validity window (`FACTORY_RESET_REAUTH_WINDOW_MS = 300_000` ms) before `startFactoryReset` or `resumeFactoryReset`.
   - Raw password input is cleared immediately after verification and is never stored in React Query caches, `localStorage`, console logs, or `systemOperations/factoryReset`.
5. **Cloud Firestore Security Rules (`firestore.rules`)**:
   - Normal state (`idle`, `completed`, `cancelled`): `allow delete: if canFactoryResetDelete()` evaluates `false` across all 18 operational targets, so neither public visitors, Staff, nor Owner can delete operational records during normal operations.
   - During Factory Reset (`systemOperations/factoryReset.status == 'running'`): `canFactoryResetDelete()` (`isActiveOwner() && isFactoryResetRunning()`) permits Owner batch deletes strictly on the 18 operational paths while preserved collections (`staffProfiles`, `settings/*`, `bookkeepingSettings`, `publicSiteSettings`, `bookingRequestMessageTemplates`, `galleryItems`, `landingPagePlacements`, `systemOperations`) remain strictly protected from deletion.
   - `customerPhoneIndex`: `allow list: if isActiveOwner()` enables Owner-only paginated enumeration and deletion during Factory Reset while Staff continue using single-document `get` lookups without phone-hash listing access.

## 4. Three-Stage Confirmation & Anti-Mistake Controls

Execution requires completing all three stages inside `FactoryResetConfirmDialog`:

1. **Stage 1 — Warning Review**: Explicit breakdown of the 18 deleted targets and preserved assets.
2. **Stage 2 — Owner Password Re-Authentication**: Verifies current Firebase Auth password via `reauthenticateCurrentStaff`. Wrong password stays cleanly on Stage 2 with a mapped error.
3. **Stage 3 — Manual Confirmation Phrase & Acknowledgment**:
   - Exact manual input `RESET 37 MUSIC STUDIO` (leading/trailing spaces trimmed, internal whitespace normalized).
   - `onPaste` and `onDrop` are blocked on `#factory-reset-confirm-phrase` to prevent blind copy-paste confirmation.
   - Explicit acknowledgment checkbox: _"Saya memahami bahwa data operasional yang tercantum akan dihapus permanen."_
   - Single-flight locked button `DELETE ALL OPERATIONAL DATA`.

## 5. Honest Architectural Trade-Offs (Firebase Spark Client-Session Model)

- **Spark-Only Client Execution:** Because the studio operates strictly on Firebase Spark (no Cloud Functions / Blaze billing), pagination and batch deletions run inside the Owner's authenticated browser session.
- **Not Globally Atomic:** Firestore transactions and batches cannot delete thousands of documents across 18 collections atomically. Deletion proceeds sequentially in small batches (`FACTORY_RESET_BATCH_SIZE = 10`, ordered by `documentId()`). Once the first batch is committed, deleted documents are **permanently irreversible**.
- **Rule Evaluation Call Budget Considerations:** Each delete batch is capped at `<= 10` documents so every Security Rules check (`isActiveOwner()` + `getFactoryResetOperation()` per write/delete) stays comfortably inside Firestore's per-batch rule evaluation limits.
- **Maintenance Lock (`isFactoryResetLocked()`):** While `systemOperations/factoryReset.status` is `'running'`, `'paused'`, or `'failed'`:
  - `firestore.rules` blocks new operational creates/updates (`bookings`, `bookingSlots`, `bookingEvents`, `customers`, `customerPhoneIndex`, `invoices`, `paymentTransactions`, `commission*`, `bookkeeping*`, `inventory*`, `publicAvailability`, and `publicBookingRequests` + subcollections).
  - `AdminLayout.jsx` displays a persistent Owner banner (`admin-factory-reset-maintenance-banner`) linking directly back to `/admin/settings/danger-area`.
  - `AdminCalendarPage.jsx` disables auto-sync and manual `/availability` backfill while locked so background admin tabs do not fight an in-progress reset.
- **Safe Cancellation vs. Resume-Only Guarantee:** Cancelling (`cancelFactoryResetBeforeDeletion`) is allowed **both in UI and Firestore Security Rules** ONLY while `totalDeletedCount == 0 && completedCollections.size() == 0`. Once any document is deleted, the operation cannot be rolled back or unlocked mid-way — the Owner must resume and complete verification across all 18 targets.

## 6. Resumability, Cursor Tracking & Completion Verification

- `systemOperations/factoryReset` stores only non-PII manifest progress (`operationId`, `status`, `initiatedByUid`, `currentCollection`, `lastProcessedDocumentId`, `completedCollections`, `deletedDocumentCounts`, `totalDeletedCount`, timestamps, sanitized error code/message, and `verificationSummary`).
- On network loss, tab close, or transient Firestore failure:
  - In-flight `executeResetLoop` catches failures and persists `status: 'failed'` along with the latest `stateBox.current` cursor and counts (preserving monotonic `totalDeletedCount >= prevTotalDeletedCount`).
  - Re-opening `/admin/settings/danger-area` presents `FactoryResetProgress` where the Owner enters their current password and resumes (`resumeFactoryReset`) from the persisted cursor with the same immutable `operationId`.
- Before marking `completed`, `verifyAllManifestTargetsEmpty` re-counts all 18 operational targets from scratch (`getCountFromServer` + paginated subcollection checks). Only if `remainingTotal === 0` (`allZero: true`) does the engine reinitialize `publicAvailabilityMetadata/status` (`isReady: true`) and write `status: 'completed'` (also enforced directly by Firestore Security Rules).

## 7. Pre-Reset Backup Guidance

Before initiating a Factory Reset in production:

1. **Export/Screenshot Financial Summaries:** Record closing monthly totals, pending balances, and audit figures from Admin Dashboard / Bookkeeping if needed for external accounting.
2. **Use GCP/Firestore Export (Optional / External):** Note that `gcloud firestore export` requires billing/Blaze on Google Cloud; on Spark-only setups, download or print any required invoices/records prior to confirming Stage 3.
3. **Verify `/admin/settings/danger-area` Dry Run Preview:** Ensure the real document counts match expectations (`isComplete: true`) before confirming password and confirmation phrase.

## 8. Verification & Test Commands

```bash
# Real Local Firestore Emulator Security Rules Suite (starts/stops emulator automatically)
npm run test:rules

# Full Vitest Unit & UI Integration Suite (uses in-memory repository adapters)
npm run test:run

# Static Linting & Production Bundle Verification
npm run lint
npm run build
```

**Important Safety Notice:** Never execute `npm run test:rules` or Factory Reset flows against production project credentials (`studio37classic`). Always run emulator tests with `demo-studio37-rules` via `firebase emulators:exec`.
