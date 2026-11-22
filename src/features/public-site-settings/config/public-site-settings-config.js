import {
  OPERATING_END_MINUTE,
  OPERATING_START_MINUTE,
} from '@/features/admin/calendar/config/calendar-config';
import { formatMinuteOfDay } from '@/features/admin/calendar/utils/booking-time';

export const PUBLIC_SITE_SETTINGS_COLLECTION = 'publicSiteSettings';
export const PUBLIC_SITE_SETTINGS_DOC_ID = 'site';
export const PUBLIC_SITE_SETTINGS_SCHEMA_VERSION = 1;

export const CANONICAL_OPERATING_HOURS_LABEL = `${formatMinuteOfDay(OPERATING_START_MINUTE)} – ${formatMinuteOfDay(OPERATING_END_MINUTE)} WIB`;

export const PUBLIC_SITE_SETTINGS_LIMITS = Object.freeze({
  studioNameMax: 100,
  taglineMax: 160,
  whatsappMax: 20,
  emailMax: 120,
  addressMax: 300,
  cityMax: 80,
  mapsUrlMax: 500,
  operatingHoursMax: 80,
  seoTitleMax: 120,
  seoDescriptionMax: 260,
  maxServices: 6,
  maxRooms: 4,
  maxSocialLinks: 6,
  maxTestimonials: 12,
});

export const PUBLIC_SITE_SETTINGS_ALLOWED_KEYS = Object.freeze([
  'schemaVersion',
  'studioName',
  'tagline',
  'publicWhatsappNumber',
  'publicEmail',
  'publicAddress',
  'city',
  'mapsUrl',
  'operatingHours',
  'publishedServices',
  'publishedRooms',
  'socialLinks',
  'verifiedTestimonials',
  'seoTitle',
  'seoDescription',
  'isPublished',
  'updatedAt',
]);

export const DEFAULT_PUBLISHED_SERVICES = Object.freeze([
  {
    id: 'rehearsal',
    isVisible: true,
    label: 'Rehearsal',
    summary:
      'Dedicated studio rehearsal sessions for bands and ensembles with full backline readiness.',
    highlights: ['Group rehearsal floor', '30-minute slot scheduling', 'Room A & Room B options'],
    publicPriceLabel: '',
  },
  {
    id: 'recording',
    isVisible: true,
    label: 'Recording',
    summary: 'Focused studio tracking sessions for vocals, instruments, and full-band live takes.',
    highlights: [
      'Live & booth tracking',
      'Dedicated control room session',
      'Flexible session lengths',
    ],
    publicPriceLabel: '',
  },
  {
    id: 'mix-master',
    isVisible: true,
    label: 'Mix & Master',
    summary:
      'Post-production mixing and final mastering inquiries for singles, EPs, and multi-track stems.',
    highlights: [
      'Post-production workflow',
      'Project brief & target deadline',
      'Direct coordination via WhatsApp',
    ],
    publicPriceLabel: '',
  },
]);

export const DEFAULT_PUBLISHED_ROOMS = Object.freeze([
  {
    id: 'room-a',
    name: 'Room A — Live Room',
    summary: 'Primary rehearsal and live tracking floor at 37 Music Studio.',
    tags: ['Live Rehearsal Floor', 'Band Sessions', '10:00 – 23:00 WIB'],
  },
  {
    id: 'room-b',
    name: 'Room B — Control + Booth',
    summary: 'Recording control room and vocal/instrument tracking suite.',
    tags: ['Control + Booth', 'Tracking & Production', '10:00 – 23:00 WIB'],
  },
]);

export const DEFAULT_PUBLIC_SOCIAL_LINKS = Object.freeze([
  { id: 'instagram', label: 'Instagram', url: '' },
  { id: 'tiktok', label: 'TikTok', url: '' },
  { id: 'youtube', label: 'YouTube', url: '' },
  { id: 'music', label: 'Audio Reels', url: '' },
]);

export const DEFAULT_PUBLIC_SITE_SETTINGS = Object.freeze({
  schemaVersion: PUBLIC_SITE_SETTINGS_SCHEMA_VERSION,
  studioName: '37 Music Studio',
  tagline: 'Rehearsal, Recording, Mixing & Mastering',
  publicWhatsappNumber: '',
  publicEmail: '',
  publicAddress: '',
  city: '',
  mapsUrl: '',
  operatingHours: CANONICAL_OPERATING_HOURS_LABEL,
  publishedServices: DEFAULT_PUBLISHED_SERVICES,
  publishedRooms: DEFAULT_PUBLISHED_ROOMS,
  socialLinks: DEFAULT_PUBLIC_SOCIAL_LINKS,
  verifiedTestimonials: [],
  seoTitle: '37 Music Studio — Rehearsal, Recording, Mixing & Mastering',
  seoDescription:
    'Book rehearsal and recording sessions or send a mixing & mastering inquiry at 37 Music Studio. Check live room availability online.',
  isPublished: true,
  updatedAt: null,
});
