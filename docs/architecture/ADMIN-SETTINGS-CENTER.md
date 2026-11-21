# Admin Settings Center Architecture — 37 Music Studio

**Module:** Settings Center Foundation  
**Routes:** `/admin/settings`, `/admin/settings/studio-profile`, `/admin/settings/account-security`, `/admin/settings/price-and-fee`  
**Design System:** Spatial Ambient Workspace  
**Backend:** Firebase Authentication + Cloud Firestore (Spark Plan Compliant)  
**Locale / Timezone Baseline:** `IDR` (Rupiah), `Asia/Jakarta` (WIB), Indonesian locale 24-hour presentation

---

## 1. Module Structure

The Admin sidebar stays fixed at **8 top-level navigation items**. `/admin/settings` now serves as an extensible **Settings Center Overview**, highlighting active modules and clearly communicating planned modules without adding extra top-level sidebar destinations.

### Overview Grouping (`AdminSettingsPage`)

1. **Group A — Studio Configuration**
   - `Studio Profile` (`/admin/settings/studio-profile`) — Active module (`Owner edit`, `Staff read-only`)
   - `Price and Fee Settings` (`/admin/settings/price-and-fee`) — Existing V2 module preserved as-is (`Owner edit`, `Staff read-only`)
   - `Operations & Booking Rules` — Strictly non-interactive `PLANNED` roadmap card
2. **Group B — Personal Settings**
   - `Account & Security` (`/admin/settings/account-security`) — Active module (`Owner & Staff`)
   - `Notifications & Devices` — Strictly non-interactive `PLANNED` roadmap card
3. **System Baseline (Read-Only Panel)**
   - Currency: `IDR (Indonesian Rupiah)`
   - Timezone: `Asia/Jakarta (WIB)`
   - Date & Time Presentation: `Indonesian locale, 24-hour format`
   - Backend: `Firebase Authentication + Cloud Firestore`

---

## 2. Studio Profile & Contact (`settings/studioProfile`)

### Source Files

- `src/features/admin/settings/studio-profile/config/default-studio-profile.js`
- `src/features/admin/settings/studio-profile/utils/normalize-studio-profile.js`
- `src/features/admin/settings/studio-profile/schemas/studio-profile-schema.js`
- `src/features/admin/settings/studio-profile/repositories/studio-profile-repository.js`
- `src/features/admin/settings/studio-profile/services/studio-profile-service.js`
- `src/features/admin/settings/studio-profile/hooks/useStudioProfile.js`
- `src/features/admin/settings/components/StudioProfileForm.jsx`
- `src/features/admin/settings/components/StudioProfilePreview.jsx`
- `src/features/admin/settings/components/StudioProfileSaveBar.jsx`
- `src/features/admin/settings/pages/StudioProfilePage.jsx`

### Firestore Document Schema

Document path: `settings/studioProfile` (exactly 11 keys; no arbitrary extra fields):

| Field | Type | Validation / Rules |
| :--- | :--- | :--- |
| `schemaVersion` | integer | `1` |
| `studioName` | string | Required trimmed string, 2..100 characters |
| `tagline` | string | Trimmed string, 0..160 characters |
| `whatsappNumber` | string | Empty string `""` or E.164 `+` plus 8..15 digits (`^\\+[1-9][0-9]{7,14}$`) |
| `email` | string | Empty string `""` or lowercased valid email, 0..120 characters |
| `address` | string | Trimmed string, 0..300 characters |
| `city` | string | Trimmed string, 0..80 characters |
| `mapsUrl` | string | Empty string `""` or `http://` / `https://` URL without whitespace, 0..500 characters |
| `version` | integer | Starts at `1` on create; must equal `resource.data.version + 1` on update |
| `updatedAt` | timestamp | Written via Firestore `serverTimestamp()` |
| `updatedByUid` | string | Must match `request.auth.uid` |

### Concurrency, Authorization & Navigation Integrity

- **Read Behavior:** Missing `settings/studioProfile` falls back cleanly to `DEFAULT_STUDIO_PROFILE` (`isPersisted: false`, `version: 0`) without auto-writing on read/mount.
- **Role Enforcement:** Client hides mutating controls (`Simpan Profil Studio`, `Batalkan Perubahan`) for Staff and enforces Owner checks inside `saveStudioProfile`; `firestore.rules` enforces `isActiveStaff()` for `get`, `allow list: if false`, `isActiveOwner()` for `create`/`update`, and `allow delete: if false`.
- **Optimistic Concurrency:** Saves run inside `runTransaction` verifying `expectedVersion` against `currentVersion`. If another session updates the document concurrently, conflicting saves reject with `studio-profile/stale-version` and the page displays a **Muat Data Terbaru** recovery banner.
- **Unsaved Change Guard:** Dirty forms register a `beforeunload` browser prompt and guard internal Settings breadcrumb / back navigation with `SettingsConfirmDialog`.
- **Scope Boundary:** `StudioProfilePreview` is strictly internal to Admin Settings; the public Landing Page was not modified to read `settings/studioProfile`.

---

## 3. Account & Security (`/admin/settings/account-security`)

- **Component:** `src/features/admin/settings/pages/AccountSecurityPage.jsx`
- **Data Source:** Live authenticated context from `useAuth()` (`user`, `profile`, `role`, `resetPassword`).
- **Presented Fields (Read-Only):**
  - `Display Name`: `profile.displayName || profile.name || user.displayName || "Belum diatur"`
  - `Email Address`: `user.email || profile.email`
  - `Role`: `Owner` / `Staff`
  - `Account Status`: Renders `Active` strictly when `profile.active === true`; renders `Inactive` when `false` and `Tidak diketahui` when absent.
  - `Last Sign-In Time`: `user.metadata.lastSignInTime` formatted in Indonesian 24-hour presentation in `Asia/Jakarta` (`WIB`).
- **Action:** Single primary **Send Password Reset Email** workflow guarded by `SettingsConfirmDialog` and an in-flight duplicate-submit lock (`isSendingReset`), invoking existing `useAuth().resetPassword(user.email)` (`requestStaffPasswordReset` in `src/features/auth/auth-service.js`).
- **Strict Non-Goals:** No display name editing, email changing, role management, password input forms, staff management, or user deletion controls.
