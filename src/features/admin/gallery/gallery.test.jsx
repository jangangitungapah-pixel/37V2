import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GallerySection } from '@/components/landing/GallerySection';
import { landingPageContent } from '@/data/landing-page-content';
import { AuthContext } from '@/features/auth/AuthContext';

import {
  GALLERY_STATUSES,
  getCloudinaryConfig,
  resetCloudinaryConfigOverride,
  setCloudinaryConfigOverride,
} from './config/gallery-config';
import { AdminGalleryPage } from './pages/AdminGalleryPage';
import {
  createInMemoryGalleryRepositoryAdapter,
  resetGalleryRepositoryAdapter,
  setGalleryRepositoryAdapter,
} from './repositories/gallery-repository';
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
import { buildCloudinaryOptimizedUrl, isValidCloudinaryDeliveryUrl } from './utils/cloudinary-url';

function buildAuthValue({
  uid = 'owner-uid-1',
  role = 'owner',
  displayName = 'Owner Studio 37',
  email = 'owner@37music.id',
  active = true,
} = {}) {
  return {
    user: {
      uid,
      email,
      displayName,
    },
    profile: {
      uid,
      role,
      displayName,
      email,
      active,
    },
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

beforeEach(() => {
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
});

describe('14.1 Cloudinary Configuration & URL Optimization', () => {
  it('resolves cloudName and uploadPreset cleanly, reports missing config, and never reads API Key or Secret', () => {
    resetCloudinaryConfigOverride();

    const validCfg = getCloudinaryConfig({
      VITE_CLOUDINARY_CLOUD_NAME: 'fodgcil9',
      VITE_CLOUDINARY_UPLOAD_PRESET: '37gallery',
      VITE_CLOUDINARY_API_KEY: 'should-never-be-read',
      VITE_CLOUDINARY_API_SECRET: 'should-never-be-read',
    });

    expect(validCfg.isConfigured).toBe(true);
    expect(validCfg.cloudName).toBe('fodgcil9');
    expect(validCfg.uploadPreset).toBe('37gallery');
    expect(validCfg.uploadEndpoint).toBe('https://api.cloudinary.com/v1_1/fodgcil9/image/upload');
    expect(validCfg.apiKey).toBeUndefined();
    expect(validCfg.apiSecret).toBeUndefined();
    expect(JSON.stringify(validCfg)).not.toContain('should-never-be-read');

    const missingCfg = getCloudinaryConfig({});
    expect(missingCfg.isConfigured).toBe(false);
    expect(missingCfg.missingKeys).toEqual([
      'VITE_CLOUDINARY_CLOUD_NAME',
      'VITE_CLOUDINARY_UPLOAD_PRESET',
    ]);
  });

  it('validates HTTPS res.cloudinary.com delivery URLs and injects responsive f_auto,q_auto,c_limit,w_ transformations', () => {
    const rawUrl =
      'https://res.cloudinary.com/fodgcil9/image/upload/v1700000001/37musicstudio/gallery/room-a.webp';

    expect(isValidCloudinaryDeliveryUrl(rawUrl, 'fodgcil9')).toBe(true);
    expect(isValidCloudinaryDeliveryUrl(rawUrl.replace('https:', 'http:'), 'fodgcil9')).toBe(false);
    expect(
      isValidCloudinaryDeliveryUrl(
        'https://evil.example.com/fodgcil9/image/upload/room-a.webp',
        'fodgcil9',
      ),
    ).toBe(false);
    expect(
      isValidCloudinaryDeliveryUrl(
        'https://res.cloudinary.com/othercloud/image/upload/room-a.webp',
        'fodgcil9',
      ),
    ).toBe(false);

    const optimized = buildCloudinaryOptimizedUrl(rawUrl, { width: 900 });
    expect(optimized).toBe(
      'https://res.cloudinary.com/fodgcil9/image/upload/f_auto,q_auto,c_limit,w_900/v1700000001/37musicstudio/gallery/room-a.webp',
    );
  });
});

describe('14.2 Cloudinary Unsigned Upload & Response Validation', () => {
  it('sends only file and upload_preset to the unsigned endpoint without API Key or Secret', async () => {
    const capturedCalls = [];
    setCloudinaryUploadTransport(async ({ endpoint, formData, onProgress }) => {
      onProgress?.(50);
      capturedCalls.push({
        endpoint,
        keys: Array.from(formData.keys()),
        preset: formData.get('upload_preset'),
        file: formData.get('file'),
      });
      onProgress?.(100);
      return makeCloudinaryResponse();
    });

    const file = makeTestImageFile('live-room.webp', 'image/webp', 300000);
    const result = await uploadImageToCloudinary({ file });

    expect(capturedCalls).toHaveLength(1);
    expect(capturedCalls[0].endpoint).toBe('https://api.cloudinary.com/v1_1/fodgcil9/image/upload');
    expect(capturedCalls[0].keys).toEqual(['file', 'upload_preset']);
    expect(capturedCalls[0].preset).toBe('37gallery');
    expect(result.cloudinaryPublicId).toBe('37musicstudio/gallery/room-a-session-1');
    expect(result.format).toBe('webp');
  });

  it('rejects unsupported formats (SVG/GIF/PDF), oversized files (>10MB), oversized dimensions (>6000px), and malformed responses', async () => {
    const svgFile = makeTestImageFile('vector.svg', 'image/svg+xml', 12000);
    await expect(uploadImageToCloudinary({ file: svgFile })).rejects.toMatchObject({
      code: 'gallery/unsupported-format',
    });

    const gifFile = makeTestImageFile('anim.gif', 'image/gif', 50000);
    await expect(uploadImageToCloudinary({ file: gifFile })).rejects.toMatchObject({
      code: 'gallery/unsupported-format',
    });

    const hugeFile = makeTestImageFile('huge.jpg', 'image/jpeg', 11 * 1024 * 1024);
    await expect(uploadImageToCloudinary({ file: hugeFile })).rejects.toMatchObject({
      code: 'gallery/file-too-large',
    });

    const wideFile = makeTestImageFile('wide.jpg', 'image/jpeg', 500000, {
      width: 6500,
      height: 4000,
    });
    await expect(uploadImageToCloudinary({ file: wideFile })).rejects.toMatchObject({
      code: 'gallery/dimensions-too-large',
    });

    // Response validation
    expect(() =>
      validateCloudinaryUploadResponse(
        makeCloudinaryResponse({
          secure_url: 'http://res.cloudinary.com/fodgcil9/image/upload/test.jpg',
        }),
        { expectedCloudName: 'fodgcil9' },
      ),
    ).toThrow(/HTTPS/i);

    expect(() =>
      validateCloudinaryUploadResponse(
        makeCloudinaryResponse({
          secure_url: 'https://cdn.example.com/fodgcil9/image/upload/test.jpg',
        }),
        { expectedCloudName: 'fodgcil9' },
      ),
    ).toThrow(/res\.cloudinary\.com/i);

    expect(() =>
      validateCloudinaryUploadResponse(
        makeCloudinaryResponse({
          resource_type: 'video',
        }),
        { expectedCloudName: 'fodgcil9' },
      ),
    ).toThrow(/image/i);
  });
});

describe('14.3 Gallery Metadata, Optimistic Concurrency, Publication & Ordering', () => {
  it('creates draft v1 metadata, increments version on edit, blocks stale writes, and blocks Staff mutations', async () => {
    const adapter = createInMemoryGalleryRepositoryAdapter([]);

    await expect(
      createGalleryMetadataFromUpload({
        itemId: 'gal-1',
        actorUid: 'staff-1',
        actorRole: 'staff',
        cloudinaryResponse: makeCloudinaryResponse(),
        initialMetadata: {
          title: 'Room A Drum Kit',
          category: 'Rehearsal',
          altText: 'Drum kit in Room A',
        },
        expectedCloudName: 'fodgcil9',
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'gallery/forbidden' });

    const created = await createGalleryMetadataFromUpload({
      itemId: 'gal-1',
      actorUid: 'owner-1',
      actorRole: 'owner',
      cloudinaryResponse: makeCloudinaryResponse(),
      initialMetadata: {
        title: 'Room A Drum Kit',
        category: 'Rehearsal',
        altText: '',
      },
      expectedCloudName: 'fodgcil9',
      adapter,
    });

    expect(created.version).toBe(1);
    expect(created.status).toBe(GALLERY_STATUSES.DRAFT);

    // Missing altText prevents publication
    await expect(
      publishGalleryItem({
        item: created,
        actorUid: 'owner-1',
        actorRole: 'owner',
        existingItems: [created],
        expectedCloudName: 'fodgcil9',
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'gallery/publish-validation-failed' });

    // Edit metadata adds altText and increments version to v2
    const updatedV2 = await updateGalleryItemMetadata({
      item: created,
      actorUid: 'owner-1',
      actorRole: 'owner',
      input: {
        title: 'Room A Full Backline',
        category: 'Live Room (Room A)',
        altText: 'Full drum kit and guitar amplifiers inside Room A',
        caption: 'Ready for band rehearsal',
      },
      adapter,
    });

    expect(updatedV2.version).toBe(2);
    expect(updatedV2.title).toBe('Room A Full Backline');

    // Stale write using old version v1 fails safely
    await expect(
      updateGalleryItemMetadata({
        item: created, // stale version 1
        actorUid: 'owner-1',
        actorRole: 'owner',
        input: {
          title: 'Stale Title Overwrite',
          category: 'Rehearsal',
          altText: 'Valid alt text',
          caption: '',
        },
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'gallery/stale-version' });

    // Publish succeeds once altText is valid (version -> v3)
    const publishedV3 = await publishGalleryItem({
      item: updatedV2,
      actorUid: 'owner-1',
      actorRole: 'owner',
      existingItems: [updatedV2],
      expectedCloudName: 'fodgcil9',
      adapter,
    });
    expect(publishedV3.status).toBe(GALLERY_STATUSES.PUBLISHED);
    expect(publishedV3.version).toBe(3);

    // Archive removes from published (v4), and archived cannot be published directly without restore to draft
    const archivedV4 = await archiveGalleryItem({
      item: publishedV3,
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter,
    });
    expect(archivedV4.status).toBe(GALLERY_STATUSES.ARCHIVED);

    await expect(
      publishGalleryItem({
        item: archivedV4,
        actorUid: 'owner-1',
        actorRole: 'owner',
        existingItems: [archivedV4],
        expectedCloudName: 'fodgcil9',
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'gallery/publish-validation-failed' });

    const restoredV5 = await restoreGalleryItem({
      item: archivedV4,
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter,
    });
    expect(restoredV5.status).toBe(GALLERY_STATUSES.DRAFT);
    expect(restoredV5.version).toBe(5);
  });

  it('swaps sortOrder atomically when reordering published photographs and unpublishes back to draft', async () => {
    const adapter = createInMemoryGalleryRepositoryAdapter([
      {
        id: 'gal-a',
        title: 'First Published Photo',
        category: 'Recording',
        altText: 'First published studio photo',
        caption: '',
        cloudinaryPublicId: '37musicstudio/gallery/a',
        cloudinaryAssetId: 'asset-a',
        secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/a.webp',
        resourceType: 'image',
        format: 'webp',
        width: 1200,
        height: 900,
        bytes: 200000,
        status: 'published',
        sortOrder: 1000,
        version: 1,
      },
      {
        id: 'gal-b',
        title: 'Second Published Photo',
        category: 'Mixing',
        altText: 'Second published studio photo',
        caption: '',
        cloudinaryPublicId: '37musicstudio/gallery/b',
        cloudinaryAssetId: 'asset-b',
        secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/b.webp',
        resourceType: 'image',
        format: 'webp',
        width: 1200,
        height: 900,
        bytes: 210000,
        status: 'published',
        sortOrder: 2000,
        version: 1,
      },
    ]);

    await reorderPublishedGalleryItem({
      itemId: 'gal-b',
      direction: 'up',
      publishedItems: adapter._getItems(),
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter,
    });

    const afterSwap = adapter._getItems();
    expect(afterSwap.map((item) => item.id)).toEqual(['gal-b', 'gal-a']);
    expect(adapter._getItemById('gal-b').sortOrder).toBe(1000);
    expect(adapter._getItemById('gal-a').sortOrder).toBe(2000);

    const unpublished = await unpublishGalleryItem({
      item: adapter._getItemById('gal-b'),
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter,
    });
    expect(unpublished.status).toBe(GALLERY_STATUSES.DRAFT);
  });
});

describe('14.3 & 14.4 Admin Gallery UI, Retry Save Metadata & Landing Page Sync', () => {
  it('blocks Staff with Owner Access Required and keeps private gallery items unread', async () => {
    const adapter = createInMemoryGalleryRepositoryAdapter([
      {
        id: 'gal-secret-draft',
        title: 'Private Unreleased Room Photo',
        category: 'Recording',
        altText: 'Draft photo',
        caption: '',
        cloudinaryPublicId: '37musicstudio/gallery/draft',
        cloudinaryAssetId: 'asset-draft',
        secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/draft.webp',
        resourceType: 'image',
        format: 'webp',
        width: 1200,
        height: 900,
        bytes: 180000,
        status: 'draft',
        sortOrder: 1000,
        version: 1,
      },
    ]);
    setGalleryRepositoryAdapter(adapter);

    renderGalleryPage({
      authValue: buildAuthValue({ uid: 'staff-1', role: 'staff', email: 'staff@37music.id' }),
    });

    expect(screen.getByRole('heading', { name: /owner access required/i })).toBeTruthy();
    expect(screen.queryByText('Private Unreleased Room Photo')).toBeNull();
    expect(screen.queryByRole('button', { name: /select photographs/i })).toBeNull();
  });

  it('preserves Cloudinary response on Firestore metadata failure and retries metadata save without duplicate upload', async () => {
    const adapter = createInMemoryGalleryRepositoryAdapter([]);
    setGalleryRepositoryAdapter(adapter);

    let cloudinaryUploadCalls = 0;
    setCloudinaryUploadTransport(async ({ onProgress }) => {
      cloudinaryUploadCalls += 1;
      onProgress?.(100);
      return makeCloudinaryResponse({
        public_id: '37musicstudio/gallery/retry-test-asset',
        asset_id: 'asset-retry-99',
      });
    });

    // Fail the first Firestore write after Cloudinary upload succeeds
    adapter._setNextWriteError(new Error('Simulated Firestore write timeout'));

    const user = userEvent.setup();
    renderGalleryPage();

    const fileInput = screen.getByLabelText(/select studio photograph files to upload/i);
    const testFile = makeTestImageFile('vocal-booth.webp', 'image/webp', 220000);
    await user.upload(fileInput, testFile);

    // Wait for Metadata Save Failed state with Public ID displayed
    expect(await screen.findByText(/metadata save failed/i)).toBeTruthy();
    expect(screen.getByText('37musicstudio/gallery/retry-test-asset')).toBeTruthy();
    expect(cloudinaryUploadCalls).toBe(1);

    // Click Retry Save Metadata -> must NOT call Cloudinary upload again
    const retryMetaBtn = screen.getByRole('button', {
      name: /retry save metadata for vocal-booth\.webp/i,
    });
    await user.click(retryMetaBtn);

    await waitFor(() => {
      expect(adapter._getItems()).toHaveLength(1);
    });
    expect(cloudinaryUploadCalls).toBe(1);
    expect(adapter._getItems()[0].cloudinaryPublicId).toBe(
      '37musicstudio/gallery/retry-test-asset',
    );
  });

  it('reflects only published photos in public GallerySection in sortOrder ASC and handles empty/error states', async () => {
    const adapter = createInMemoryGalleryRepositoryAdapter([
      {
        id: 'gal-draft-1',
        title: 'Draft Only Photo',
        category: 'Draft',
        altText: 'Draft photo that must not appear on landing page',
        caption: '',
        cloudinaryPublicId: '37musicstudio/gallery/d1',
        cloudinaryAssetId: 'asset-d1',
        secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/d1.webp',
        resourceType: 'image',
        format: 'webp',
        width: 1200,
        height: 900,
        bytes: 180000,
        status: 'draft',
        sortOrder: 500,
        version: 1,
      },
      {
        id: 'gal-arch-1',
        title: 'Archived Photo',
        category: 'Archived',
        altText: 'Archived photo that must not appear on landing page',
        caption: '',
        cloudinaryPublicId: '37musicstudio/gallery/ar1',
        cloudinaryAssetId: 'asset-ar1',
        secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/ar1.webp',
        resourceType: 'image',
        format: 'webp',
        width: 1200,
        height: 900,
        bytes: 180000,
        status: 'archived',
        sortOrder: 100,
        version: 1,
      },
      {
        id: 'gal-pub-second',
        title: 'Second Ordered Public Photo',
        category: 'Mixing',
        altText: 'Mixing desk photo',
        caption: '',
        cloudinaryPublicId: '37musicstudio/gallery/p2',
        cloudinaryAssetId: 'asset-p2',
        secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/p2.webp',
        resourceType: 'image',
        format: 'webp',
        width: 1200,
        height: 900,
        bytes: 200000,
        status: 'published',
        sortOrder: 2000,
        version: 1,
      },
      {
        id: 'gal-pub-first',
        title: 'First Ordered Public Photo',
        category: 'Recording',
        altText: 'Recording room photo',
        caption: '',
        cloudinaryPublicId: '37musicstudio/gallery/p1',
        cloudinaryAssetId: 'asset-p1',
        secureUrl: 'https://res.cloudinary.com/fodgcil9/image/upload/v1/p1.webp',
        resourceType: 'image',
        format: 'webp',
        width: 1200,
        height: 900,
        bytes: 200000,
        status: 'published',
        sortOrder: 1000,
        version: 1,
      },
    ]);
    setGalleryRepositoryAdapter(adapter);

    render(<GallerySection gallery={landingPageContent.gallery} />);

    expect(await screen.findByText('First Ordered Public Photo')).toBeTruthy();
    expect(screen.getByText('Second Ordered Public Photo')).toBeTruthy();
    expect(screen.queryByText('Draft Only Photo')).toBeNull();
    expect(screen.queryByText('Archived Photo')).toBeNull();

    const figures = screen.getAllByRole('figure');
    expect(figures).toHaveLength(2);
    expect(figures[0].textContent).toContain('First Ordered Public Photo');
    expect(figures[1].textContent).toContain('Second Ordered Public Photo');

    // Simulate public query error -> graceful non-technical fallback
    adapter._triggerPublicError(new Error('FirebaseError: permission-denied internal trace'));
    expect(await screen.findByTestId('gallery-error-state')).toBeTruthy();
    expect(screen.queryByText(/internal trace/i)).toBeNull();
  });
});
