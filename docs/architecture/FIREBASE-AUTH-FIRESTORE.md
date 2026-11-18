# 37 Music Studio — Firebase Authentication & Cloud Firestore Architecture

**Phase:** 3 — Staff & Owner Authentication  
**Date:** 18 November 2026  
**Repository:** `jangangitungapah-pixel/37V2`  
**Firebase Project ID:** `studio37classic`  
**Firebase Hosting Site ID:** `studio37-os`

---

## 1. Overview

This document explains how Staff and Owner authentication and authorization work in the 37 Music Studio application. The architecture is intentionally simple, minimal, and easy for the studio owner to maintain without custom backend servers or complex role hierarchies.

---

## 2. Firebase Project & Web App Configuration

| Setting                     | Value                                |
| --------------------------- | ------------------------------------ |
| **Firebase Project ID**     | `studio37classic`                    |
| **Authentication Domain**   | `studio37classic.firebaseapp.com`    |
| **Hosting Site ID**         | `studio37-os`                        |
| **Authentication Provider** | Email / Password (no public sign-up) |
| **Firestore Collection**    | `staffProfiles`                      |

### Environment Variables (`.env.local`)

Local environment variables are stored in `.env.local` (which is gitignored and never committed):

```env
VITE_FIREBASE_API_KEY=<public-web-api-key>
VITE_FIREBASE_AUTH_DOMAIN=studio37classic.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=studio37classic
VITE_FIREBASE_MESSAGING_SENDER_ID=968069260344
VITE_FIREBASE_APP_ID=1:968069260344:web:791256b48afe558c5932cd
```

- `.env.example` committed in the repository contains empty placeholders only.
- Vite `VITE_` variables are bundled into the client browser code so the browser can talk to Firebase. Because Firebase Web API keys are public project identifiers, **actual data protection is enforced by Cloud Firestore Security Rules**, not by hiding `VITE_` variables.
- Firebase Analytics and Firebase Storage are **not** initialized in Phase 3.

---

## 3. Authentication & Session Flow

### 3.1 Modular Firebase SDK Layer

- `src/lib/firebase/client.js`: Lazily initializes the single default Firebase App (`getFirebaseApp()`) and checks configuration completeness (`isFirebaseConfigured()`).
- `src/lib/firebase/auth.js`: Exposes the shared Firebase Auth instance (`getFirebaseAuth()`).
- `src/lib/firebase/firestore.js`: Exposes the shared Cloud Firestore instance (`getFirebaseDb()`).

### 3.2 Step-by-Step Sign-In & Verification Flow

1. A staff member or the studio owner navigates to `/staff/login` (linked from the public landing page footer button **`Staff / Owner Login`**).
2. The user enters their email and password and clicks **Sign In**.
3. `signInStaffWithEmailPassword` calls Firebase Authentication's `signInWithEmailAndPassword(auth, trimmedEmail, password)`.
4. Immediately after Firebase Auth succeeds, `fetchAndValidateStaffProfile` reads the user's own Firestore document at:
   ```text
   staffProfiles/{authenticatedUser.uid}
   ```
5. The account is authorized **only** if all four checks pass:
   - The document `staffProfiles/{uid}` exists.
   - The document ID matches `authenticatedUser.uid`.
   - `active === true`.
   - `role === "owner"` or `role === "staff"`.
6. **If authorized:** The user is redirected to `/admin` (Protected Temporary Admin Portal).
7. **If unauthorized** (missing document, `active: false`, invalid role, or Firestore permission denied):
   - The application immediately calls Firebase `signOut(auth)` to terminate the session.
   - The user is denied entry to `/admin` and shown a clear error message on `/staff/login`.
   - The application **never** auto-creates a `staffProfiles` document and **never** assigns a default role.

### 3.3 Session Persistence & Restoration

- `AuthProvider` (`src/features/auth/AuthProvider.jsx`) subscribes to `onAuthStateChanged`.
- When a signed-in user refreshes `/admin`, `RequireStaff` renders a branded verification screen (`Verifying Studio Access`) while `AuthProvider` restores the Firebase Auth session and re-verifies `staffProfiles/{uid}` from Firestore.
- Protected `/admin` content never flashes before verification finishes.
- If an account is deactivated (`active = false`) in Firebase Console, the next reload or sign-in immediately denies access and signs the user out.

### 3.4 Client Login vs. Staff / Owner Login Separation

- **Header (`Client Login`):** Opens a `Client Login Coming Soon` dialog explaining that the customer portal is not available yet and clients can submit booking inquiries without an account. It never routes to `/staff/login` or `/admin`.
- **Footer (`Staff / Owner Login`):** Navigates to `/staff/login` for internal studio staff and owner authentication.

---

## 4. Cloud Firestore Data Model (`staffProfiles`)

Phase 3 uses a single collection: `staffProfiles`.

```text
staffProfiles/
  ├── {OWNER_FIREBASE_UID}
  ├── {STAFF_01_FIREBASE_UID}
  └── {STAFF_02_FIREBASE_UID}
```

### Document Schema

Every document ID in `staffProfiles` **must exactly match** the user's Firebase Authentication UID.

| Field         | Type        | Required | Description                                             |
| ------------- | ----------- | -------- | ------------------------------------------------------- |
| `displayName` | `string`    | Yes      | Name shown in the Admin Portal (e.g., `"Studio Owner"`) |
| `email`       | `string`    | Yes      | Account email address reference                         |
| `role`        | `string`    | Yes      | Must be `"owner"` or `"staff"`                          |
| `active`      | `boolean`   | Yes      | `true` for active access, `false` to revoke access      |
| `createdAt`   | `timestamp` | Yes      | Firestore Timestamp when the profile was created        |

Example document (`staffProfiles/{uid}`):

```json
{
  "displayName": "Studio Owner",
  "email": "owner@example.com",
  "role": "owner",
  "active": true,
  "createdAt": "2026-11-18T12:00:00Z (Firestore Timestamp)"
}
```

---

## 5. Cloud Firestore Security Rules (`firestore.rules`)

The repository defines minimal, default-deny Firestore Security Rules in `firestore.rules`:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /staffProfiles/{uid} {
      allow get: if request.auth != null
                 && request.auth.uid == uid;
    }

  }
}
```

### 5.1 What the Rules Permit and Deny

| Operation                                             | Allowed? | Why                                                 |
| ----------------------------------------------------- | -------- | --------------------------------------------------- |
| Unauthenticated user reads any profile                | **No**   | `request.auth != null` is required                  |
| Signed-in user reads their own `staffProfiles/{uid}`  | **Yes**  | `allow get` matches `request.auth.uid == uid`       |
| Signed-in user reads another user's profile           | **No**   | `request.auth.uid == uid` fails                     |
| Signed-in user lists all documents in `staffProfiles` | **No**   | Only `get` (single document) is allowed, not `list` |
| Client creates, updates, or deletes a profile         | **No**   | No `create`, `update`, or `delete` rule exists      |
| Access to any other collection                        | **No**   | Firestore denies all unmatched paths by default     |

### 5.2 Why Client Profile Writes Are Prohibited

If the browser application were allowed to create or edit `staffProfiles/{uid}`, any user could set their own `role: "owner"` or re-enable `active: true` from browser DevTools. By prohibiting client-side writes to `staffProfiles`, only the Studio Owner (via Firebase Console) can grant or revoke staff/owner roles.

### 5.3 How Future Collections Should Be Added

When future phases introduce bookings, rooms, customers, or finances:

1. Add explicit `match /<collection>/{docId}` blocks in `firestore.rules`.
2. Keep rules simple and specific to the operations needed.
3. Verify that `get(/databases/$(database)/documents/staffProfiles/$(request.auth.uid)).data.active == true` and check `role` where owner-only or staff-only access is required.
4. Never use broad `allow read, write: if request.auth != null;` wildcards.

---

## 6. How to Publish Firestore Rules Manually

Firestore rules are **not** deployed automatically by the coding agent. After reviewing `firestore.rules`, the Studio Owner can publish them using either method below:

### Option A — Firebase Console (No CLI Required)

1. Open [Firebase Console](https://console.firebase.google.com/) and select project **`studio37classic`**.
2. Go to **Build → Firestore Database → Rules**.
3. Copy the contents of `firestore.rules` into the editor.
4. Click **Publish**.

### Option B — Firebase CLI

```powershell
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project studio37classic
```
