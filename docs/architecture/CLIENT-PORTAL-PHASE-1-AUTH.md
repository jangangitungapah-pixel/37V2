# 37 Music Studio Client Portal — Phase 1 Authentication & Security Architecture

## 1. Overview & Product Behavior

Phase 1 delivers the customer-facing authentication gateway (`/portal/login`), Google Sign-In/Sign-Up integration, immediate `active` client provisioning, deterministic verified-email matching, and strict Firestore + route isolation on Firebase Spark (zero Cloud Functions, zero external servers).

**Core Policy — Zero Pending Approval:**

- Every user who completes Firebase Google Authentication with a verified email immediately receives a `clientAccounts/{uid}` record with `status: 'active'` (`CLIENT_ACCOUNT_STATUS.ACTIVE`).
- There is no `pending` state and no Owner approval queue.
- Only `active` and `suspended` statuses exist (`active` on creation; Owner may toggle `suspended` if ever needed).

## 2. Authentication Architecture

### 2.1 Google Sign-In & Redirect Flow

- Implemented in `src/features/client-portal/services/client-auth-service.js` and `src/features/auth/AuthProvider.jsx`.
- Uses `GoogleAuthProvider` (`prompt: 'select_account'`) with `signInWithPopup` first and automatic fallback to `signInWithRedirect` when `auth/popup-blocked` or `auth/operation-not-supported-in-this-environment` occurs.
- `AuthProvider` calls `completeGoogleRedirectIfPresent()` on bootstrap before settling auth status so redirect returns provision immediately without re-prompting.
- `validateGoogleFirebaseUser()` verifies:
  1. Non-empty `uid`
  2. `google.com` provider in `providerData` / token `firebase.sign_in_provider`
  3. Valid email syntax normalized (`trim().toLowerCase()`)
  4. `emailVerified === true` on both the Firebase User object and ID token claims

### 2.2 Canonical Role Separation

- **Owner & Staff** live exclusively in `staffProfiles/{uid}` (`role: 'owner' | 'staff'`, `active: boolean`).
- **Clients** live exclusively in `clientAccounts/{uid}` (`role: 'client'`, `status: 'active' | 'suspended'`).
- Existing Staff/Owner accounts cannot create `clientAccounts/{uid}` (enforced both in `client-auth-service.js` and Firestore Rules `!isAnyStaffProfile()`).
- If an active Staff/Owner visits `/portal/login`, the page displays a calm notice linking back to `/admin/dashboard` or offering to sign out first before signing in with a personal Google account.
- Clients (`accountType === 'client'`, `profile === null`) are blocked from `/admin/*` by hardened `RequireStaff` and `RequireOwner` guards and blocked by Firestore Rules from all operational/internal collections.

## 3. Deterministic Email Matching & Isolated Fallback Strategy

```
Google Login (verified emailNormalized)
  ├── Does staffProfiles/{uid} exist? ──▶ YES ──▶ Block conversion; preserve Staff identity
  ├── Does clientAccounts/{uid} exist? ──▶ YES ──▶ Load existing binding; reject if suspended
  └── First-time Google user:
        └── Read customerEmailIndex/{emailNormalized}
              ├── status == 'active' & customerId present?
              │     └── Attempt atomic tx:
              │           clientAccounts/{uid} (linked_customer)
              │         + clientCustomerLinks/{customerId} (ownerUid lock)
              │         ├── Success ─▶ Enter /portal linked to clientProfiles/{customerId}
              │         └── Conflict (already claimed / permission-denied) ─▶ Fallback below
              └── Missing / 'ambiguous' / conflict:
                    └── Atomic isolated tx:
                          clientAccounts/{uid} (isolated_client_profile)
                        + clientCustomerLinks/client_{uid}
                        + clientProfiles/client_{uid}
                        └── Enter /portal with safe isolated profile
```

- **No raw PII exposure:** Clients never read internal `customers/{customerId}` docs (which store Staff `notes`, phone change history, and Staff UIDs). Staff mutations maintain client-safe projections in `clientProfiles/{customerId}`.
- **Duplicate/Ambiguous Safety:** `customerEmailIndex/{emailNormalized}` enforces email uniqueness across active Studio Customers (`customer/email-conflict`) and supports an explicit `status: 'ambiguous'` marker (`customerId: ''`) that forces safe isolated profile fallback if legacy duplicates share an email.

## 4. Route Protection, Session Isolation & Real-Time Revocation

- `RequireClient` protects `/portal/*` (`ClientPortalHomePage`) and fails closed unless:
  1. `status === 'authenticated'`
  2. `accountType === 'client'` and strictly `profile === null`
  3. `clientAccount` matches `uid`, `role === 'client'`, `status === 'active'`
  4. `clientProfile` matches `clientAccount.customerId` and `status === 'active'`
- Switching active UIDs clears `queryClient.clear()`, tears down prior Firestore listeners (`subscribeClientAccount`), and resets cached identity state.
- `subscribeClientAccount(uid)` watches `clientAccounts/{uid}` in real time; if an Owner suspends an active client session, the client is signed out immediately, `queryClient.clear()` runs, and they are redirected to `/portal/login` with a neutral message (`CLIENT_SUSPENDED_MESSAGE`).

## 5. Firestore Collections & Security Boundary

- `customerEmailIndex/{normalizedEmail}`: Client with matching verified Google email can `get` only their exact document; Staff maintain active entries; Owner can `list`.
- `clientProfiles/{customerId}`: Safe public/client subset (`displayName`, `emailNormalized`, `phoneDisplay`, `photoURL`, `status`). Readable only by active Staff or the active Client holding matching `clientAccounts/{uid}.customerId` AND `clientCustomerLinks/{customerId}.ownerUid == auth.uid`.
- `clientAccounts/{uid}`: Owner can `get`/`list` and update only `status` (`active` <-> `suspended`); Client can `get` own doc, `create` once on instant Google onboarding with validated defaults, and update only `displayName` & `photoURL`. `allow delete: if false` preserves identity locks across Factory Reset.
- `clientCustomerLinks/{customerId}`: Immutable 1:1 ownership lock (`allow update: if false`) preventing account takeover across customers.

## 6. Legacy Customer Email Index Backfill Note

Because historical `customers/{customerId}` records were created without an email field, `customerEmailIndex` entries are populated automatically whenever Staff creates a customer with a Google email, edits a customer profile email, or merges customers. Existing customers without an email safely sign into isolated client profiles until Staff adds their Google email in Admin Customer Management.

## 7. Known Phase 1 Boundaries

- Full Client booking history, self-service booking creation, invoices/payments view, messaging, and Owner UI controls for Client account suspension are deferred to subsequent phases.
- Note that `NotFoundPage` explicitly verifies `/client/login` returns 404 while `/portal/login` serves the new Client Portal entrypoint.
