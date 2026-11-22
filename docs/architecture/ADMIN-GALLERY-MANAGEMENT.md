# Admin Gallery Management & Landing Page Media Management Architecture

**Module:** Gallery Management & Landing Page Media Manager  
**Admin Route:** `/admin/gallery` (Order `08` in top-level navigation; `Settings` is `09`)  
**Workspace Tabs inside `/admin/gallery`:** `Photos` (default) and `Landing Page`  
**Public Integration Targets:**

1. Four Fixed Landing Page Placements (`hero-featured`, `room-a`, `room-b`, `studio-exterior`)
2. Generic Public Gallery Section (`/#gallery` — `"Proof, not renders."`)  
   **Binary Delivery & Upload:** Cloudinary Direct Unsigned Upload (`VITE_CLOUDINARY_CLOUD_NAME=fodgcil9`, `VITE_CLOUDINARY_UPLOAD_PRESET=37gallery`)  
   **Metadata Stores:** Firebase Cloud Firestore (`galleryItems/{galleryItemId}` and `landingPagePlacements/{placementId}`)  
   **Architecture Policy:** Firebase Spark Plan Compliant (Zero Cloud Functions, Zero Backend Servers, Zero Firebase Storage)

---

## 1. Simplified Native Photo Gallery UX (`/admin/gallery`)

`/admin/gallery` is designed as a photo-first, mobile-friendly smartphone gallery experience rather than a technical asset-management console.

### 1.1 Main Workspace Navigation

- **Two Top-Level Workspace Tabs:**
  1. **`Photos` (default):** Responsive square photo thumbnail grid (`3` columns on mobile phones, `4` on tablets, `5` on desktop), simple filter pills (`Semua`, `Galeri Website`, `Tersembunyi`, `Arsip`), title search, and `+ Add Photos` upload trigger.
  2. **`Landing Page`:** Landing Page Media Manager for the 4 fixed website image placements and their associated copywriting.
- **Hidden Technical Metadata in Normal Usage:**
  - Photo cards in the grid show only the photograph, a short title overlay, and tiny status/usage indicators (`Galeri #N`, `Used on Landing Page`, `Arsip`).
  - Internal fields (`cloudinaryPublicId`, `cloudinaryAssetId`, Firestore document ID, image dimensions, file byte size, format, `schemaVersion`, `version`, uploader UID, and raw timestamps) are preserved in Firestore but never clutter the photo grid.
- **Photo Detail Sheet & Natural Editor:**
  - Tapping a photo opens a mobile bottom-sheet / desktop modal preview (`GalleryItemPreviewDialog`) with natural labels:
    - `Judul Foto`
    - `Deskripsi`
    - `Tampilkan di Galeri Website` / `Sembunyikan dari Galeri`
    - `Geser Naik` / `Geser Turun` (for ordering published gallery items)
    - `Edit Foto` (opens `GalleryItemEditorDialog` with `Judul Foto`, `Deskripsi`, and `Simpan Perubahan`, automatically populating internal `altText` and preserving `category` compatibility)
    - `Arsipkan Foto` / `Pulihkan Foto`
- **Compact Upload & Recovery:**
  - `+ Add Photos` opens the device multi-file picker (with desktop drag-and-drop also supported on the Photos view).
  - Completed queue items automatically collapse out of view so new uploads simply appear as photo tiles in the grid.
  - Failed uploads (`Coba Lagi`) and partial Firestore metadata failures (`Simpan Ulang Foto` / `Retry Save Metadata`, which reuses the preserved Cloudinary response without re-uploading the binary) remain recoverable.

---

## 2. Photo Library vs. Landing Page Placement Distinction

The system maintains two independent publication concepts:

1. **Generic Public Gallery (`galleryItems` where `status == 'published'`):**
   - Controls which photos appear in the public `"Proof, not renders."` photo grid (`GallerySection.jsx`) ordered by `sortOrder ASC`.
   - When a visitor opens a photo in `GalleryLightboxDialog`, its `caption` and `altText` are displayed.
2. **Named Landing Page Placements (`landingPagePlacements/{placementId}` where `status == 'published'`):**
   - Controls the 4 specific structural image frames and their copywriting across the Landing Page (`HeroSection`, `RoomsSection`, `TestimonialsAndContactSection`).
   - A photo from `galleryItems` can be assigned to one or multiple Landing Page placements even if its `galleryItems.status` is `draft` (so it does not have to appear in the generic `"Proof, not renders."` grid).
   - Photos assigned to one or more placements display an unobtrusive `Used on Landing Page` indicator in the Gallery library and detail view.
   - Archiving a source `galleryItems` record hides it from active Gallery curation without breaking any already published `landingPagePlacements` record (since the placement stores its own validated Cloudinary `secureUrl` and Cloudinary binaries are never physically deleted by the client).

---

## 3. Firestore Data Contracts

### 3.1 `galleryItems/{galleryItemId}` (Strict 22-Field Schema Preserved)

Preserves the exact 22-field schema (`schemaVersion: 1`, `title`, `category`, `altText`, `caption`, `cloudinaryPublicId`, `cloudinaryAssetId`, `secureUrl`, `resourceType: 'image'`, `format`, `width`, `height`, `bytes`, `status: 'draft' | 'published' | 'archived'`, `sortOrder`, `uploadedAt`, `uploadedByUid`, `createdAt`, `createdByUid`, `updatedAt`, `updatedByUid`, `version`).

### 3.2 `landingPagePlacements/{placementId}` (Strict 19-Field Schema)

Uses **four fixed document IDs**:

- `hero-featured` → maps to `landingPageContent.hero.featuredPhoto`
- `room-a` → maps to `landingPageContent.rooms.items` (`id === 'room-a'`)
- `room-b` → maps to `landingPageContent.rooms.items` (`id === 'room-b'`)
- `studio-exterior` → maps to `landingPageContent.testimonialsAndContact.contact.image`

| Field                 | Type      | Constraints                                                                             |
| :-------------------- | :-------- | :-------------------------------------------------------------------------------------- |
| `schemaVersion`       | int       | Must be `1`                                                                             |
| `placementId`         | string    | Must equal document ID (`'hero-featured' \| 'room-a' \| 'room-b' \| 'studio-exterior'`) |
| `sourceGalleryItemId` | string    | Non-empty source `galleryItems` ID (`1..120` chars)                                     |
| `cloudinaryPublicId`  | string    | Non-empty Cloudinary Public ID (`1..240` chars)                                         |
| `cloudinaryAssetId`   | string    | Non-empty Cloudinary Asset ID (`1..120` chars)                                          |
| `secureUrl`           | string    | HTTPS `https://res.cloudinary.com/<cloud>/image/upload/...` (`<= 600` chars)            |
| `resourceType`        | string    | `'image'`                                                                               |
| `format`              | string    | `'jpg' \| 'jpeg' \| 'png' \| 'webp' \| 'avif'`                                          |
| `width`               | int       | `1..6000`                                                                               |
| `height`              | int       | `1..6000`                                                                               |
| `bytes`               | int       | `1..10485760`                                                                           |
| `altText`             | string    | Required trimmed string `3..220` chars                                                  |
| `copy`                | map       | Placement-specific validated copywriting map (see below)                                |
| `status`              | string    | `'draft' \| 'published'`                                                                |
| `version`             | int       | Starts at `1` on create; increments by `+1` on every update                             |
| `createdAt`           | timestamp | Immutable creation timestamp                                                            |
| `createdByUid`        | string    | Immutable creator UID (`== request.auth.uid` on create)                                 |
| `updatedAt`           | timestamp | Updated on every write                                                                  |
| `updatedByUid`        | string    | Must equal `request.auth.uid`                                                           |

#### Placement-Specific `copy` Schemas

1. **`hero-featured` (`5` keys):**
   - `topSticker` (`0..60` chars)
   - `captionTitle` (`2..100` chars, required)
   - `captionSubtitle` (`0..160` chars)
   - `floatingBadgeTitle` (`0..80` chars)
   - `floatingBadgeSubtitle` (`0..120` chars)
2. **`room-a` and `room-b` (`5` keys):**
   - `sticker` (`0..60` chars)
   - `name` (`2..100` chars, required)
   - `capacityLabel` (`2..180` chars, required)
   - `tags` (list of `1..6` non-empty strings, each `<= 60` chars)
   - `ctaLabel` (`2..60` chars, required)
   - _Immutable internal values:_ `room.id` (`'room-a'`, `'room-b'`) and `room.defaultService` (`'rehearsal'`, `'recording'`) are never stored in `copy` and remain locked in `mergeLandingPageContentWithPlacements`.
3. **`studio-exterior` (`1` key):**
   - `caption` (`0..180` chars, optional caption rendered unobtrusively below the studio location image).

---

## 4. Public Landing Page Query & Dummy SVG Removal

- **Public Query (`usePublishedLandingPagePlacements`):**
  ```js
  query(collection(db, 'landingPagePlacements'), where('status', '==', 'published'), limit(10));
  ```
  Requires no additional composite index beyond single-field indexing on `status`.
- **Dummy SVG Removal & Neutral Placeholders:**
  - The 4 old dummy SVG references (`/images/demo/room-a-live.svg`, `/images/demo/room-b-control.svg`, `/images/demo/location-exterior.svg`) have been removed from active rendering in `landing-page-content.js` and `mergeLandingPageContentWithPlacements`.
  - When a placement is published, it renders its responsive Cloudinary delivery URL and hides `DEMO PREVIEW` / `DEMO ASSET` badges.
  - When a placement is unconfigured or unavailable, `StudioImage` renders a design-consistent neutral placeholder preserving the exact aspect ratio (`aspect-[16/11]`, `aspect-[16/10]`, `aspect-[16/9]`) without layout shift and without ever falling back to a dummy SVG.

---

## 5. Firestore Security Rules (`firestore.rules`)

- `match /landingPagePlacements/{placementId}`:
  - `allow read`: Active Owner can read all; Anonymous visitors (`request.auth == null`) and Active Staff (`isActiveStaff()`) can read **only when `resource.data.status == 'published'`**. Inactive accounts are denied.
  - `allow create`: Active Owner only (`isActiveOwner()`), fixed `placementId in ['hero-featured', 'room-a', 'room-b', 'studio-exterior']`, strict 19-key shape, placement-specific `copy` validation, `version == 1`, `createdByUid == request.auth.uid`, `updatedByUid == request.auth.uid`.
  - `allow update`: Active Owner only, `version == resource.data.version + 1`, `createdAt` and `createdByUid` unchanged, `updatedByUid == request.auth.uid`.
  - `allow delete`: `if false`.
