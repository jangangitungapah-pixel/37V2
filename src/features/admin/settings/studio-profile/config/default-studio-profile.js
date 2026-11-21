export const STUDIO_PROFILE_COLLECTION = 'settings';
export const STUDIO_PROFILE_DOC_ID = 'studioProfile';
export const STUDIO_PROFILE_SCHEMA_VERSION = 1;

export const STUDIO_PROFILE_LIMITS = Object.freeze({
  studioNameMin: 2,
  studioNameMax: 100,
  taglineMax: 160,
  whatsappMax: 20,
  emailMax: 120,
  addressMax: 300,
  cityMax: 80,
  mapsUrlMax: 500,
});

export const DEFAULT_STUDIO_PROFILE = Object.freeze({
  schemaVersion: STUDIO_PROFILE_SCHEMA_VERSION,
  studioName: '37 Music Studio',
  tagline: 'Recording, Mixing, Mastering & Studio Rental',
  whatsappNumber: '',
  email: '',
  address: '',
  city: 'Jakarta',
  mapsUrl: '',
  version: 0,
  updatedAt: null,
  updatedByUid: '',
});

export const DEFAULT_STUDIO_PROFILE_FORM_VALUES = Object.freeze({
  studioName: DEFAULT_STUDIO_PROFILE.studioName,
  tagline: DEFAULT_STUDIO_PROFILE.tagline,
  whatsappNumber: DEFAULT_STUDIO_PROFILE.whatsappNumber,
  email: DEFAULT_STUDIO_PROFILE.email,
  address: DEFAULT_STUDIO_PROFILE.address,
  city: DEFAULT_STUDIO_PROFILE.city,
  mapsUrl: DEFAULT_STUDIO_PROFILE.mapsUrl,
});
