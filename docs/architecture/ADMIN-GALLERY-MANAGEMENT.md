# Admin Gallery Management & Landing Page Integration Architecture

**Module:** Gallery Management  
**Admin Route:** `/admin/gallery` (Order `08` in top-level navigation; `Settings` is `09`)  
**Public Integration Target:** Landing Page Gallery Section (`/#gallery`)  
**Binary Delivery & Upload:** Cloudinary Direct Unsigned Upload (`VITE_CLOUDINARY_CLOUD_NAME=fodgcil9`, `VITE_CLOUDINARY_UPLOAD_PRESET=37gallery`)  
**Metadata Store:** Firebase Cloud Firestore (`galleryItems/{galleryItemId}`)  
**Architecture Policy:** Firebase Spark Plan Compliant (Zero Cloud Functions, Zero Backend Servers, Zero Firebase Storage)

---

## 1. Admin Navigation & Role Access Model

- **Top-Level Navigation Order (`src/features/admin/navigation/admin-navigation.js`):**
  1. `01` Dashboard (`/admin/dashboard`)
  2. `02` Calendar (`/admin/calendar`)
  3. `03` Customer (`/admin/customer`)
  4. `04` Payment and Bill (`/admin/payment-and-bill`)
  5. `05` Commission and Fee (`/admin/commission-and-fee`)
  6. `06` Inventory (`/admin/inventory`)
  7. `07` Pembukuan (`/admin/pembukuan`)
  8. `08` Gallery (`/admin/gallery`)
  9. `09` Settings (`/admin/settings`)
- **Owner-Only Gallery Management:**
  - `AdminGalleryPage` verifies `role === 'owner'` and an active profile (`profile.active === true`).
  - Active Staff accounts can see the top-level `Gallery` menu item in the Admin Shell, but visiting `/admin/gallery` renders `GalleryOwnerAccessNotice` (`Owner Access Required`), never subscribes to private `draft`/`archived` Firestore records, and never initializes Cloudinary upload actions.
  - All mutating service calls in `gallery-service.js` and security rules in `firestore.rules` enforce `isActiveOwner()`.

---

## 2. Cloudinary Unsigned Upload & Security Boundaries

### 2.1 Credential & Security Rules

- **Cloudinary API Secret is NEVER used, read, logged, or stored** in browser code, `.env.example`, `.env.local`, documentation, or handoff artifacts.
- **Cloudinary API Key is NOT required** for unsigned uploads and is completely omitted from the client application.
- The upload preset name (`37gallery`) and cloud name (`fodgcil9`) are public to browser clients (`VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`).
- **Client-Side Validation Boundary:** Client-side checks (`<= 10 MB`, `<= 6000 × 6000 px`, non-empty file, allowed formats `jpg/jpeg/png/webp/avif`, rejecting `svg/gif/video/pdf/exe`) improve usability and prevent accidental bad uploads, but **are not a hard server security boundary** because Cloudinary unsigned presets are callable directly by browser clients.
- **Public Asset Policy:** All uploaded photographs use public HTTPS Cloudinary delivery (`res.cloudinary.com`) and are intended exclusively for approved public promotional studio photography — never private or confidential files.

### 2.2 Required Cloudinary Upload Preset Configuration (`37gallery`)

In **Cloudinary Console → Settings → Upload → Upload Presets → `37gallery`**:

| Setting         | Required Value               |
| :-------------- | :--------------------------- |
| Signing Mode    | **Unsigned**                 |
| Resource Type   | `Image`                      |
| Asset Folder    | `37musicstudio/gallery`      |
| Allowed Formats | `jpg, jpeg, png, webp, avif` |
| Overwrite       | Disabled (`false`)           |
| Delivery Type   | Public HTTPS (`upload`)      |

### 2.3 Upload & Firestore Persistence Sequence + Partial Failure Recovery

1. A stable Firestore document ID (`gal_<timestamp>_<random>`) is generated **before** the Cloudinary upload starts.
2. The file is uploaded directly via `POST https://api.cloudinary.com/v1_1/fodgcil9/image/upload` with `FormData` containing only `file` and `upload_preset`. Concurrent uploads are capped at **2 files**.
3. The JSON response is validated for `public_id`, `asset_id`, `secure_url` (`https://res.cloudinary.com/fodgcil9/image/upload/...`), `resource_type === 'image'`, allowed `format`, and positive integers `width`, `height`, and `bytes`.
4. **Partial Failure Recovery (Cloudinary succeeded, Firestore metadata write failed):**
   - The validated Cloudinary response and pre-generated document ID are preserved in the upload queue state (`METADATA_FAILED`).
   - The UI displays the `cloudinaryPublicId` (for manual audit/cleanup if ever needed) and exposes a **Retry Save Metadata** button that commits the Firestore document **without re-uploading** the file or creating duplicate Cloudinary assets.

### 2.4 Responsive Image Delivery Optimization (`cloudinary-url.js`)

Original `secureUrl` and `cloudinaryPublicId` are stored unmodified in Firestore. Delivery URLs insert on-the-fly transformations (`f_auto,q_auto,c_limit,w_<width>`):

- Admin Library Thumbnail: `w_600`
- Public Landing Page Card: `w_900`
- Lightbox Full Inspection: `w_1600`

---

## 3. Firestore Data Model (`galleryItems/{galleryItemId}`)

Every document in `galleryItems` contains **exactly 22 keys**:

| Field                | Type      | Constraints                                                                            |
| :------------------- | :-------- | :------------------------------------------------------------------------------------- |
| `schemaVersion`      | int       | Must be `1`                                                                            |
| `title`              | string    | Trimmed `2..120` chars                                                                 |
| `category`           | string    | Trimmed `2..60` chars                                                                  |
| `altText`            | string    | `0..220` chars (`>= 3` trimmed chars required when `status == 'published'`)            |
| `caption`            | string    | `0..400` chars                                                                         |
| `cloudinaryPublicId` | string    | Immutable, `1..240` chars                                                              |
| `cloudinaryAssetId`  | string    | Immutable, `1..120` chars                                                              |
| `secureUrl`          | string    | Immutable HTTPS `https://res.cloudinary.com/<cloud>/image/upload/...` (`<= 600` chars) |
| `resourceType`       | string    | Immutable `'image'`                                                                    |
| `format`             | string    | Immutable `'jpg' \| 'jpeg' \| 'png' \| 'webp' \| 'avif'`                               |
| `width`              | int       | Immutable `1..6000`                                                                    |
| `height`             | int       | Immutable `1..6000`                                                                    |
| `bytes`              | int       | Immutable `1..10485760`                                                                |
| `status`             | string    | `'draft' \| 'published' \| 'archived'`                                                 |
| `sortOrder`          | int       | Non-negative integer (`>= 0`, step `1000`)                                             |
| `uploadedAt`         | timestamp | Immutable upload timestamp                                                             |
| `uploadedByUid`      | string    | Immutable uploader UID (`== request.auth.uid` on create)                               |
| `createdAt`          | timestamp | Immutable creation timestamp                                                           |
| `createdByUid`       | string    | Immutable creator UID (`== request.auth.uid` on create)                                |
| `updatedAt`          | timestamp | Updated on every write                                                                 |
| `updatedByUid`       | string    | Must equal `request.auth.uid`                                                          |
| `version`            | int       | Starts at `1` on create; increments by `+1` on every update                            |

### Publication, Archival & Ordering Semantics

- **Draft (`draft`):** Newly uploaded or unpublished item; visible only to Active Owner in `/admin/gallery`.
- **Published (`published`):** Visible on the public Landing Page sorted by `sortOrder ASC`. Requires non-empty `altText` (`>= 3` characters) and cannot transition directly from `archived`.
- **Archived (`archived`):** Removed from public display and active curation without physically deleting the Cloudinary asset. Restoring an archived item returns it to `draft`. Physical deletion of binary files in Cloudinary must be performed manually in the Cloudinary Console until a trusted backend exists.
- **Permanent Firestore Deletion:** Prohibited (`allow delete: if false`).
- **Atomic Reordering:** Moving a published photograph Up or Down executes a Firestore transaction reading both adjacent published items, verifying their `expectedVersion`s, swapping their `sortOrder` values, incrementing both `version`s by `+1`, and committing atomically.

---

## 4. Firestore Security Rules & Composite Index

### Security Rules (`firestore.rules`)

- `allow read`: Allowed for `isActiveOwner()` on all documents, and allowed for Anonymous visitors (`request.auth == null`) or `isActiveStaff()` **strictly when `resource.data.status == 'published'`**. Inactive accounts (`active == false`) are denied all reads.
- `allow create`: `isActiveOwner()` + `isValidGalleryItemCreate(request.resource.data)` (`version == 1`).
- `allow update`: `isActiveOwner()` + `isValidGalleryItemUpdate(request.resource.data, resource.data)` (`version == resource.data.version + 1`, immutable asset/creation fields unchanged, `altText` required when `published`, no direct `archived -> published` jump).
- `allow delete`: `false`.

### Composite Index (`firestore.indexes.json`)

Required by the public query `where('status', '==', 'published'), orderBy('sortOrder', 'asc'), limit(100)`:

- Collection: `galleryItems`
- Fields: `status` (`ASCENDING`), `sortOrder` (`ASCENDING`)
- Referenced in `firebase.json` under `firestore.indexes`. Must be deployed manually by the Owner via `firebase deploy --only firestore:indexes` when authorized.

---

## 5. Public Landing Page Integration

- `usePublishedGallery()` subscribes to `query(collection(db, 'galleryItems'), where('status', '==', 'published'), orderBy('sortOrder', 'asc'), limit(100))` without requiring authentication.
- The four static demo SVG placeholders (`gallery-guitar.svg`, `gallery-drums.svg`, `gallery-mic.svg`, `gallery-console.svg`) have been removed from `landingPageContent.gallery.items`.
- `GallerySection.jsx` preserves the Landing Page's **Neo-Brutalist Editorial** aesthetic and `GalleryLightboxDialog`, while handling:
  - **Loading state:** 4-card editorial skeleton grid without layout shift or demo images.
  - **Empty state:** Restrained `"Studio photos coming soon."` card with `View all photos` hidden.
  - **Error state:** Non-technical fallback card without stack traces or demo images.
  - **Published state:** 2-column mobile / 4-column desktop grid + interactive lightbox viewer.
