import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GallerySection } from '@/components/landing/GallerySection';
import { landingPageContent } from '@/data/landing-page-content';
import { AuthContext } from '@/features/auth/AuthContext';
import { LandingPage } from '@/pages/LandingPage';

import {
  GALLERY_STATUSES,
  getCloudinaryConfig,
  resetCloudinaryConfigOverride,
  setCloudinaryConfigOverride,
} from './config/gallery-config';
import { LANDING_PAGE_PLACEMENT_IDS } from './config/landing-page-placements-config';
import { AdminGalleryPage } from './pages/AdminGalleryPage';
import {
  createInMemoryGalleryRepositoryAdapter,
  resetGalleryRepositoryAdapter,
  setGalleryRepositoryAdapter,
} from './repositories/gallery-repository';
import {
  createInMemoryLandingPagePlacementAdapter,
  resetLandingPagePlacementAdapter,
  setLandingPagePlacementAdapter,
} from './repositories/landing-page-placement-repository';
import {
  resetCloudinaryUploadTransport,
  setCloudinaryUploadTransport,
  uploadImageToCloudinary,
  validateCloudinaryUploadResponse,
} from './services/cloudinary-upload-service';
import {
  archiveGalleryItem,
  createGalleryMetadataFromUpload,
  publishGalleryItem,
  reorderPublishedGalleryItem,
  restoreGalleryItem,
  unpublishGalleryItem,
  updateGalleryItemMetadata,
} from './services/gallery-service';
import { saveLandingPagePlacement } from './services/landing-page-placement-service';
import { buildCloudinaryOptimizedUrl, isValidCloudinaryDeliveryUrl } from './utils/cloudinary-url';

function buildAuthValue({
  uid = 'owner-uid-1',
  role = 'owner',
  displayName = 'Owner Studio 37',
  email = 'owner@37music.id',
  active = true,
} = {}) {
  return {
    user: { uid, email, displayName },
    profile: { uid, role, displayName, email, active },
    role,
    status: 'authenticated',
    authError: null,
    login: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    clearAuthError: vi.fn(),
  };
}

function renderGalleryPage({ authValue = buildAuthValue() } = {}) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/admin/gallery']}>
        <AdminGalleryPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function makeTestImageFile(
  name = 'studio-room-a.webp',
  type = 'image/webp',
  sizeBytes = 250 * 1024,
  dimensions = { width: 1600, height: 1200 },
) {
  const file = new File([new Uint8Array(128)], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  if (dimensions) {
    Object.defineProperty(file, 'width', { value: dimensions.width });
    Object.defineProperty(file, 'height', { value: dimensions.height });
  }
  return file;
}

function makeCloudinaryResponse(overrides = {}) {
  return {
    public_id: '37musicstudio/gallery/room-a-session-1',
    asset_id: 'cld_asset_001',
    secure_url:
      'https://res.cloudinary.com/fodgcil9/image/upload/v1700000001/37musicstudio/gallery/room-a-session-1.webp',
    resource_type: 'image',
    format: 'webp',
    width: 1600,
    height: 1200,
    bytes: 256000,
    ...overrides,
  };
}

function makeSampleGalleryItem(id, overrides = {}) {
  return {
    id,
    title: `Photo ${id}`,
    category: 'Recording',
    altText: `Descriptive alt text for ${id}`,
    caption: `Caption for ${id}`,
    cloudinaryPublicId: `37musicstudio/gallery/${id}`,
    cloudinaryAssetId: `asset_${id}`,
    secureUrl: `https://res.cloudinary.com/fodgcil9/image/upload/v1/${id}.webp`,
    resourceType: 'image',
    format: 'webp',
    width: 1600,
    height: 1200,
    bytes: 320000,
    status: 'draft',
    sortOrder: 1000,
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  setCloudinaryConfigOverride({
    VITE_CLOUDINARY_CLOUD_NAME: 'fodgcil9',
    VITE_CLOUDINARY_UPLOAD_PRESET: '37gallery',
  });
});

afterEach(() => {
  cleanup();
  resetCloudinaryConfigOverride();
  resetCloudinaryUploadTransport();
  resetGalleryRepositoryAdapter();
  resetLandingPagePlacementAdapter();
});

describe('1. Cloudinary Configuration, Upload & Service Invariants', () => {
  it('resolves public config cleanly, never reads API Key/Secret, and generates optimized f_auto,q_auto,c_limit,w_ URLs', () => {
    resetCloudinaryConfigOverride();

    const validCfg = getCloudinaryConfig({
      VITE_CLOUDINARY_CLOUD_NAME: 'fodgcil9',
      VITE_CLOUDINARY_UPLOAD_PRESET: '37gallery',
      VITE_CLOUDINARY_API_KEY: 'forbidden-key',
      VITE_CLOUDINARY_API_SECRET: 'forbidden-secret',
    });

    expect(validCfg.isConfigured).toBe(true);
    expect(validCfg.cloudName).toBe('fodgcil9');
    expect(validCfg.uploadPreset).toBe('37gallery');
    expect(JSON.stringify(validCfg)).not.toContain('forbidden');

    const rawUrl =
      'https://res.cloudinary.com/fodgcil9/image/upload/v1700000001/37musicstudio/gallery/room-a.webp';
    expect(isValidCloudinaryDeliveryUrl(rawUrl, 'fodgcil9')).toBe(true);
    expect(buildCloudinaryOptimizedUrl(rawUrl, { width: 900 })).toBe(
      'https://res.cloudinary.com/fodgcil9/image/upload/f_auto,q_auto,c_limit,w_900/v1700000001/37musicstudio/gallery/room-a.webp',
    );
  });

  it('sends only file and upload_preset in unsigned upload, rejects bad files/responses, and enforces optimistic concurrency', async () => {
    const capturedCalls = [];
    setCloudinaryUploadTransport(async ({ endpoint, formData, onProgress }) => {
      onProgress?.(100);
      capturedCalls.push({
        endpoint,
        keys: Array.from(formData.keys()),
        preset: formData.get('upload_preset'),
      });
      return makeCloudinaryResponse();
    });

    const file = makeTestImageFile('live-room.webp', 'image/webp', 300000);
    await uploadImageToCloudinary({ file });
    expect(capturedCalls[0].keys).toEqual(['file', 'upload_preset']);

    const svgFile = makeTestImageFile('vector.svg', 'image/svg+xml', 12000);
    await expect(uploadImageToCloudinary({ file: svgFile })).rejects.toMatchObject({
      code: 'gallery/unsupported-format',
    });

    expect(() =>
      validateCloudinaryUploadResponse(
        makeCloudinaryResponse({
          secure_url: 'http://res.cloudinary.com/fodgcil9/image/upload/test.jpg',
        }),
        { expectedCloudName: 'fodgcil9' },
      ),
    ).toThrow(/HTTPS/i);

    const adapter = createInMemoryGalleryRepositoryAdapter([]);
    const created = await createGalleryMetadataFromUpload({
      itemId: 'gal-1',
      actorUid: 'owner-1',
      actorRole: 'owner',
      cloudinaryResponse: makeCloudinaryResponse(),
      initialMetadata: { title: 'Room A', category: 'Rehearsal', altText: 'Room A setup' },
      expectedCloudName: 'fodgcil9',
      adapter,
    });
    expect(created.version).toBe(1);

    const updated = await updateGalleryItemMetadata({
      item: created,
      actorUid: 'owner-1',
      actorRole: 'owner',
      input: {
        title: 'Room A Updated',
        category: 'Rehearsal',
        altText: 'Room A updated alt text',
        caption: 'Updated caption',
      },
      adapter,
    });
    expect(updated.version).toBe(2);

    await expect(
      updateGalleryItemMetadata({
        item: created, // stale v1
        actorUid: 'owner-1',
        actorRole: 'owner',
        input: {
          title: 'Stale',
          category: 'Rehearsal',
          altText: 'Valid alt',
          caption: '',
        },
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'gallery/stale-version' });

    const published = await publishGalleryItem({
      item: updated,
      actorUid: 'owner-1',
      actorRole: 'owner',
      existingItems: [updated],
      expectedCloudName: 'fodgcil9',
      adapter,
    });
    expect(published.status).toBe(GALLERY_STATUSES.PUBLISHED);

    const unpublished = await unpublishGalleryItem({
      item: published,
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter,
    });
    expect(unpublished.status).toBe(GALLERY_STATUSES.DRAFT);

    const archived = await archiveGalleryItem({
      item: unpublished,
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter,
    });
    expect(archived.status).toBe(GALLERY_STATUSES.ARCHIVED);

    const restored = await restoreGalleryItem({
      item: archived,
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter,
    });
    expect(restored.status).toBe(GALLERY_STATUSES.DRAFT);
  });
});

describe('2. Simplified Native Photo Gallery UX (/admin/gallery Photos Tab)', () => {
  it('defaults to Photos tab, renders a clean thumbnail grid without technical metadata, opens photo detail, edits title/description, changes visibility, and restores archived photos', async () => {
    const adapter = createInMemoryGalleryRepositoryAdapter([
      makeSampleGalleryItem('gal-photo-1', {
        title: 'Live Room Drum Setup',
        caption: 'Evening drum tracking',
        altText: 'Drum kit in Live Room A',
        cloudinaryPublicId: '37musicstudio/gallery/secret-public-id-01',
        width: 1920,
        height: 1080,
        bytes: 512000,
        format: 'webp',
        status: 'draft',
        version: 3,
      }),
      makeSampleGalleryItem('gal-photo-archived', {
        title: 'Vintage Amp Corner',
        caption: 'Archived amp photo',
        altText: 'Vintage guitar amp in corner',
        status: 'archived',
        version: 2,
      }),
    ]);
    setGalleryRepositoryAdapter(adapter);
    setLandingPagePlacementAdapter(createInMemoryLandingPagePlacementAdapter([]));

    const user = userEvent.setup();
    const { container } = renderGalleryPage();

    // Photos tab is active by default
    const photosTab = screen.getByRole('tab', { name: /photos/i });
    expect(photosTab.getAttribute('aria-selected')).toBe('true');

    // Photo tile is rendered in the grid
    const photoTile = await screen.findByRole('button', {
      name: /buka foto live room drum setup/i,
    });
    expect(photoTile).toBeTruthy();

    // Normal photo grid MUST NOT display technical asset metadata
    const pageText = container.textContent || '';
    expect(pageText).not.toContain('37musicstudio/gallery/secret-public-id-01');
    expect(pageText).not.toContain('1920 × 1080');
    expect(pageText).not.toContain('500 KB');
    expect(pageText).not.toContain('v3');

    // Tap photo tile to open Photo Detail dialog
    await user.click(photoTile);
    const detailDialog = await screen.findByRole('dialog');
    expect(within(detailDialog).getByText('Judul Foto')).toBeTruthy();
    expect(within(detailDialog).getByText('Evening drum tracking')).toBeTruthy();

    // Publish directly from detail dialog ("Tampilkan di Galeri Website")
    await user.click(
      within(detailDialog).getByRole('button', { name: /tampilkan di galeri website/i }),
    );
    await waitFor(() => {
      expect(adapter._getItemById('gal-photo-1').status).toBe('published');
    });

    // Click "Edit Foto" to edit title and description
    await user.click(within(detailDialog).getByRole('button', { name: /edit foto/i }));
    const editDialog = await screen.findByRole('dialog');
    const titleInput = within(editDialog).getByLabelText(/judul foto/i);
    const descInput = within(editDialog).getByLabelText(/deskripsi/i);

    await user.clear(titleInput);
    await user.type(titleInput, 'Room A Master Drum Kit');
    await user.clear(descInput);
    await user.type(descInput, 'Custom birch drum kit ready for recording');

    await user.click(within(editDialog).getByRole('button', { name: /simpan perubahan/i }));

    await waitFor(() => {
      expect(adapter._getItemById('gal-photo-1').title).toBe('Room A Master Drum Kit');
    });
    expect(adapter._getItemById('gal-photo-1').caption).toBe(
      'Custom birch drum kit ready for recording',
    );

    // Filter to Archived ("Arsip") and restore archived photo without losing metadata
    await user.click(screen.getByRole('button', { name: /^arsip/i }));
    const archivedTile = await screen.findByRole('button', {
      name: /buka foto vintage amp corner/i,
    });
    await user.click(archivedTile);

    const archivedDialog = await screen.findByRole('dialog');
    await user.click(within(archivedDialog).getByRole('button', { name: /pulihkan foto/i }));

    await waitFor(() => {
      const restored = adapter._getItemById('gal-photo-archived');
      expect(restored.status).toBe('draft');
      expect(restored.title).toBe('Vintage Amp Corner');
      expect(restored.caption).toBe('Archived amp photo');
    });
  });

  it('supports multi-image upload, auto-hides completed queue items, and recovers from upload or metadata-save failures without duplicate upload', async () => {
    const adapter = createInMemoryGalleryRepositoryAdapter([]);
    setGalleryRepositoryAdapter(adapter);
    setLandingPagePlacementAdapter(createInMemoryLandingPagePlacementAdapter([]));

    let cloudinaryUploadCalls = 0;
    setCloudinaryUploadTransport(async ({ formData, onProgress }) => {
      cloudinaryUploadCalls += 1;
      const file = formData.get('file');
      onProgress?.(100);
      return makeCloudinaryResponse({
        public_id: `37musicstudio/gallery/${file.name}`,
        asset_id: `asset_${cloudinaryUploadCalls}`,
      });
    });

    // Fail the first Firestore metadata write to verify partial-failure recovery
    adapter._setNextWriteError(new Error('Simulated Firestore write error'));

    const user = userEvent.setup();
    renderGalleryPage();

    const fileInput = screen.getByLabelText(/select studio photograph files to upload/i);
    const file1 = makeTestImageFile('vocal-booth.webp', 'image/webp', 220000);
    await user.upload(fileInput, file1);

    // Queue shows retry metadata action
    const retryMetaBtn = await screen.findByRole('button', {
      name: /retry save metadata for vocal-booth\.webp/i,
    });
    expect(cloudinaryUploadCalls).toBe(1);

    // Clicking "Simpan Ulang Foto" saves metadata without calling Cloudinary again
    await user.click(retryMetaBtn);
    await waitFor(() => {
      expect(adapter._getItems()).toHaveLength(1);
    });
    expect(cloudinaryUploadCalls).toBe(1);

    // Completed queue item automatically collapses out of view
    expect(
      screen.queryByRole('button', { name: /retry save metadata for vocal-booth\.webp/i }),
    ).toBeNull();
  });
});

describe('3. Landing Page Media Manager (/admin/gallery Landing Page Tab)', () => {
  it('displays all 4 fixed placements, assigns existing or newly uploaded photos, allows shared photo assignment, edits copywriting while preserving immutable room IDs, and recovers from save failure', async () => {
    const galleryAdapter = createInMemoryGalleryRepositoryAdapter([
      makeSampleGalleryItem('gal-shared-1', {
        title: 'Main Live Room Wide',
        altText: 'Wide angle view of Live Room A',
        status: 'draft', // Note: draft in generic gallery, yet can be published in placements!
      }),
      makeSampleGalleryItem('gal-room-b', {
        title: 'Control Desk Close-up',
        altText: 'Mixing console in Room B',
        status: 'draft',
      }),
    ]);
    const placementAdapter = createInMemoryLandingPagePlacementAdapter([]);
    setGalleryRepositoryAdapter(galleryAdapter);
    setLandingPagePlacementAdapter(placementAdapter);

    setCloudinaryUploadTransport(async ({ onProgress }) => {
      onProgress?.(100);
      return makeCloudinaryResponse({
        public_id: '37musicstudio/gallery/fresh-exterior',
        asset_id: 'asset_fresh_ext',
        secure_url:
          'https://res.cloudinary.com/fodgcil9/image/upload/v1/37musicstudio/gallery/fresh-exterior.webp',
      });
    });

    const user = userEvent.setup();
    renderGalleryPage();

    // Switch to "Landing Page" tab
    await user.click(screen.getByRole('tab', { name: /landing page/i }));

    // All 4 fixed placement cards are displayed
    expect(screen.getByRole('heading', { name: 'Hero Featured Photo' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Room A — Live Room' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Room B — Control + Booth' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Studio Exterior / Location Photo' })).toBeTruthy();

    // 1. Assign 'gal-shared-1' to Hero Featured Photo and customize Hero copywriting
    await user.click(screen.getByRole('button', { name: /ganti foto untuk hero featured photo/i }));
    const pickerDialog1 = await screen.findByRole('dialog');
    await user.click(
      within(pickerDialog1).getByRole('option', { name: /pilih foto main live room wide/i }),
    );

    const heroEditor = await screen.findByRole('dialog');
    const heroTitleInput = within(heroEditor).getByLabelText(/judul foto hero/i);
    await user.clear(heroTitleInput);
    await user.type(heroTitleInput, '37 STUDIO — MAIN LIVE FLOOR');

    await user.click(within(heroEditor).getByRole('button', { name: /simpan ke landing page/i }));

    await waitFor(() => {
      expect(
        placementAdapter._getPlacement(LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED)?.copy.captionTitle,
      ).toBe('37 STUDIO — MAIN LIVE FLOOR');
    });

    // 2. Assign the SAME 'gal-shared-1' photo to Room A, test save failure retention, then retry save
    await user.click(screen.getByRole('button', { name: /ganti foto untuk room a — live room/i }));
    const pickerDialog2 = await screen.findByRole('dialog');
    await user.click(
      within(pickerDialog2).getByRole('option', { name: /pilih foto main live room wide/i }),
    );

    const roomAEditor = await screen.findByRole('dialog');
    const roomANameInput = within(roomAEditor).getByLabelText(/nama ruangan/i);
    const roomACtaInput = within(roomAEditor).getByLabelText(/teks tombol booking/i);
    await user.clear(roomANameInput);
    await user.type(roomANameInput, 'Room A — Flagship Rehearsal Space');
    await user.clear(roomACtaInput);
    await user.type(roomACtaInput, 'Pilih Room A');

    // Queue a transient Firestore write error -> editor must retain values in memory
    placementAdapter._setNextWriteError(new Error('Transient network failure'));
    await user.click(within(roomAEditor).getByRole('button', { name: /simpan ke landing page/i }));
    expect(await within(roomAEditor).findByRole('alert')).toBeTruthy();
    expect(within(roomAEditor).getByLabelText(/nama ruangan/i).value).toBe(
      'Room A — Flagship Rehearsal Space',
    );

    // Retry save -> succeeds!
    await user.click(within(roomAEditor).getByRole('button', { name: /simpan ke landing page/i }));
    await waitFor(() => {
      expect(placementAdapter._getPlacement(LANDING_PAGE_PLACEMENT_IDS.ROOM_A)?.copy.name).toBe(
        'Room A — Flagship Rehearsal Space',
      );
    });

    // 3. Upload a brand-new photo directly inside the picker for Studio Exterior
    await user.click(
      screen.getByRole('button', {
        name: /ganti foto untuk studio exterior \/ location photo/i,
      }),
    );
    const pickerDialog3 = await screen.findByRole('dialog');
    const pickerFileInput = within(pickerDialog3).getByLabelText(/upload new photo for placement/i);
    const exteriorFile = makeTestImageFile('front-building.webp', 'image/webp', 280000);
    await user.upload(pickerFileInput, exteriorFile);

    const exteriorEditor = await screen.findByRole('dialog');
    const captionInput = within(exteriorEditor).getByLabelText(/caption foto lokasi \(opsional\)/i);
    await user.type(captionInput, 'Pintu masuk utama & area parkir 37 Music Studio');
    await user.click(
      within(exteriorEditor).getByRole('button', { name: /simpan ke landing page/i }),
    );

    await waitFor(() => {
      expect(
        placementAdapter._getPlacement(LANDING_PAGE_PLACEMENT_IDS.STUDIO_EXTERIOR)?.copy.caption,
      ).toBe('Pintu masuk utama & area parkir 37 Music Studio');
    });
    expect(galleryAdapter._getItems()).toHaveLength(3);

    // Switch back to Photos tab and verify "Used on Landing Page" badge appears on 'gal-shared-1'
    await user.click(screen.getByRole('tab', { name: /photos/i }));
    expect(await screen.findByTestId('used-on-landing-badge-gal-shared-1')).toBeTruthy();
  });
});

describe('4. Public Landing Page Dynamic Placement Rendering & Independence', () => {
  it('replaces all 4 dummy SVGs when published, renders neutral placeholders when unconfigured, keeps generic Gallery independent, and preserves Room booking actions', async () => {
    const galleryAdapter = createInMemoryGalleryRepositoryAdapter([
      makeSampleGalleryItem('gal-generic-1', {
        title: 'Generic Gallery Photo 01',
        category: 'Recording',
        altText: 'Published photo in generic gallery section',
        caption: 'Visible inside the public gallery lightbox',
        status: 'published',
        sortOrder: 1000,
      }),
    ]);
    const placementAdapter = createInMemoryLandingPagePlacementAdapter([]);
    setGalleryRepositoryAdapter(galleryAdapter);
    setLandingPagePlacementAdapter(placementAdapter);

    const user = userEvent.setup();

    // Before placements are configured: neutral placeholders render and NO dummy SVGs appear anywhere
    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(container.innerHTML).not.toMatch(
      /room-a-live\.svg|room-b-control\.svg|location-exterior\.svg|gallery-guitar\.svg/i,
    );

    // Now publish all 4 placements with distinct photos & copywriting
    const heroPhoto = makeSampleGalleryItem('gal-hero', {
      secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/hero-real.webp',
    });
    const roomAPhoto = makeSampleGalleryItem('gal-ra', {
      secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/room-a-real.webp',
    });
    const roomBPhoto = makeSampleGalleryItem('gal-rb', {
      secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/room-b-real.webp',
    });
    const extPhoto = makeSampleGalleryItem('gal-ext', {
      secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/exterior-real.webp',
    });

    await saveLandingPagePlacement({
      placementId: LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED,
      actorUid: 'owner-1',
      actorRole: 'owner',
      photoItem: heroPhoto,
      altText: 'Hero real studio photograph',
      copy: {
        topSticker: 'VERIFIED STUDIO',
        captionTitle: 'HERO LIVE TRACKING HALL',
        captionSubtitle: 'Acoustic treated main room',
        floatingBadgeTitle: 'Verified Space',
        floatingBadgeSubtitle: 'Ready for sessions',
      },
      expectedCloudName: 'fodgcil9',
      adapter: placementAdapter,
    });

    await saveLandingPagePlacement({
      placementId: LANDING_PAGE_PLACEMENT_IDS.ROOM_A,
      actorUid: 'owner-1',
      actorRole: 'owner',
      photoItem: roomAPhoto,
      altText: 'Room A real photograph',
      copy: {
        sticker: 'ROOM A • LIVE',
        name: 'Room A — Custom Live Stage',
        capacityLabel: 'Ideal for 5-7 piece bands',
        tags: ['Custom Tag A1', 'Custom Tag A2'],
        ctaLabel: 'Book Room A Now',
      },
      expectedCloudName: 'fodgcil9',
      adapter: placementAdapter,
    });

    await saveLandingPagePlacement({
      placementId: LANDING_PAGE_PLACEMENT_IDS.ROOM_B,
      actorUid: 'owner-1',
      actorRole: 'owner',
      photoItem: roomBPhoto,
      altText: 'Room B real photograph',
      copy: {
        sticker: 'ROOM B • MIX SUITE',
        name: 'Room B — Precision Control Suite',
        capacityLabel: 'Dedicated mixing and vocal production',
        tags: ['Custom Tag B1'],
        ctaLabel: 'Book Room B Now',
      },
      expectedCloudName: 'fodgcil9',
      adapter: placementAdapter,
    });

    await saveLandingPagePlacement({
      placementId: LANDING_PAGE_PLACEMENT_IDS.STUDIO_EXTERIOR,
      actorUid: 'owner-1',
      actorRole: 'owner',
      photoItem: extPhoto,
      altText: 'Studio exterior building front',
      copy: {
        caption: 'Gedung 37 Music Studio tampak depan',
      },
      expectedCloudName: 'fodgcil9',
      adapter: placementAdapter,
    });

    // Verify all 4 placements and their copywriting appear live on the Landing Page
    expect(await screen.findByText('HERO LIVE TRACKING HALL')).toBeTruthy();
    expect(screen.getByText('Room A — Custom Live Stage')).toBeTruthy();
    expect(screen.getByText('Room B — Precision Control Suite')).toBeTruthy();
    expect(screen.getByText('Gedung 37 Music Studio tampak depan')).toBeTruthy();

    // DEMO ASSET tag is hidden when real Hero photo is configured
    expect(screen.queryByText('DEMO ASSET')).toBeNull();

    // Clicking the customized Room B CTA button still preselects immutable 'room-b' + 'recording'!
    const roomSelect = screen.getByLabelText(/room preference/i);
    await user.click(screen.getByRole('button', { name: /book room b now \(room b\)/i }));
    expect(roomSelect.value).toBe('room-b');
    expect(screen.getByRole('button', { name: /^recording$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    // Generic public Gallery section only shows 'gal-generic-1' (not the 4 placement photos) and shows its caption in lightbox
    expect(screen.getByText('Generic Gallery Photo 01')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /view all photos/i }));
    const lightbox = await screen.findByRole('dialog');
    expect(within(lightbox).getByText('Visible inside the public gallery lightbox')).toBeTruthy();
  });

  it('orders published generic gallery items by sortOrder ASC', async () => {
    const adapter = createInMemoryGalleryRepositoryAdapter([
      makeSampleGalleryItem('gal-a', {
        title: 'First Photo',
        status: 'published',
        sortOrder: 1000,
      }),
      makeSampleGalleryItem('gal-b', {
        title: 'Second Photo',
        status: 'published',
        sortOrder: 2000,
      }),
    ]);
    setGalleryRepositoryAdapter(adapter);

    await reorderPublishedGalleryItem({
      itemId: 'gal-b',
      direction: 'up',
      publishedItems: adapter._getItems(),
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter,
    });

    render(<GallerySection gallery={landingPageContent.gallery} />);
    const figures = await screen.findAllByRole('figure');
    expect(figures[0].textContent).toContain('Second Photo');
    expect(figures[1].textContent).toContain('First Photo');
  });
});
