export const LANDING_PAGE_PLACEMENTS_COLLECTION = 'landingPagePlacements';
export const LANDING_PAGE_PLACEMENT_SCHEMA_VERSION = 1;

export const LANDING_PAGE_PLACEMENT_IDS = Object.freeze({
  HERO_FEATURED: 'hero-featured',
  ROOM_A: 'room-a',
  ROOM_B: 'room-b',
  STUDIO_EXTERIOR: 'studio-exterior',
});

export const LANDING_PAGE_PLACEMENT_ID_LIST = Object.freeze([
  LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED,
  LANDING_PAGE_PLACEMENT_IDS.ROOM_A,
  LANDING_PAGE_PLACEMENT_IDS.ROOM_B,
  LANDING_PAGE_PLACEMENT_IDS.STUDIO_EXTERIOR,
]);

export const LANDING_PAGE_PLACEMENT_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
});

export const LANDING_PAGE_PLACEMENT_LIMITS = Object.freeze({
  altTextMin: 3,
  altTextMax: 220,
  stickerMax: 60,
  titleMin: 2,
  titleMax: 100,
  subtitleMax: 160,
  floatingTitleMax: 80,
  floatingSubtitleMax: 120,
  capacityMin: 2,
  capacityMax: 180,
  tagMin: 1,
  tagMax: 60,
  maxTagsCount: 6,
  ctaLabelMin: 2,
  ctaLabelMax: 60,
  exteriorCaptionMax: 180,
});

export const LANDING_PAGE_PLACEMENT_DEFINITIONS = Object.freeze([
  {
    id: LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED,
    label: 'Hero Featured Photo',
    sectionLabel: 'Hero Section',
    description: 'Foto utama dan kartu highlight yang tampil di bagian paling atas halaman publik.',
    aspectClass: 'aspect-[16/11]',
    defaultAltText: 'Suasana ruang utama 37 Music Studio',
    defaultCopy: Object.freeze({
      topSticker: '37 MUSIC STUDIO',
      captionTitle: 'ROOM A — LIVE ROOM',
      captionSubtitle: 'Ruang latihan band & sesi rekaman langsung',
      floatingBadgeTitle: 'Studio Ready',
      floatingBadgeSubtitle: 'Rehearsal • Recording • Mix',
    }),
  },
  {
    id: LANDING_PAGE_PLACEMENT_IDS.ROOM_A,
    label: 'Room A — Live Room',
    sectionLabel: 'Rooms Section (Room A)',
    description: 'Foto dan teks kartu Room A. Aksi tombol tetap terhubung ke paket latihan Room A.',
    aspectClass: 'aspect-[16/10]',
    immutableRoomId: 'room-a',
    immutableDefaultService: 'rehearsal',
    defaultAltText: 'Interior Room A Live Room di 37 Music Studio',
    defaultCopy: Object.freeze({
      sticker: 'ROOM A • LIVE SPACE',
      name: 'Room A — Live Room',
      capacityLabel: 'Ruang latihan grup dan rekaman live ensemble',
      tags: Object.freeze(['Full band rehearsal', 'Live tracking space', 'Backline ready']),
      ctaLabel: 'Book this room',
    }),
  },
  {
    id: LANDING_PAGE_PLACEMENT_IDS.ROOM_B,
    label: 'Room B — Control + Booth',
    sectionLabel: 'Rooms Section (Room B)',
    description: 'Foto dan teks kartu Room B. Aksi tombol tetap terhubung ke sesi rekaman Room B.',
    aspectClass: 'aspect-[16/10]',
    immutableRoomId: 'room-b',
    immutableDefaultService: 'recording',
    defaultAltText: 'Control Room B dan vocal booth di 37 Music Studio',
    defaultCopy: Object.freeze({
      sticker: 'ROOM B • CONTROL + BOOTH',
      name: 'Room B — Control + Booth',
      capacityLabel: 'Ruang kontrol produksi, rekaman vokal, mixing, dan mastering',
      tags: Object.freeze(['Vocal & solo tracking', 'Mixing & mastering', 'Isolated booth']),
      ctaLabel: 'Book this room',
    }),
  },
  {
    id: LANDING_PAGE_PLACEMENT_IDS.STUDIO_EXTERIOR,
    label: 'Studio Exterior / Location Photo',
    sectionLabel: 'Location & Contact Section',
    description: 'Foto tampilan bangunan atau area lokasi studio pada kartu alamat & kontak.',
    aspectClass: 'aspect-[16/9]',
    defaultAltText: 'Tampilan lokasi 37 Music Studio',
    defaultCopy: Object.freeze({
      caption: '',
    }),
  },
]);

export function getLandingPagePlacementDefinition(placementId) {
  return LANDING_PAGE_PLACEMENT_DEFINITIONS.find((def) => def.id === placementId) || null;
}
