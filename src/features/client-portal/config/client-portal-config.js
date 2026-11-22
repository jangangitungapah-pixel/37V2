export const CLIENT_ROLE = 'client';

export const CLIENT_ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
});

export const CLIENT_PROFILE_SOURCE = Object.freeze({
  LINKED_CUSTOMER: 'linked_customer',
  ISOLATED_CLIENT_PROFILE: 'isolated_client_profile',
});

export const CLIENT_PORTAL_SCHEMA_VERSION = 1;

export const CLIENT_PORTAL_ROUTES = Object.freeze({
  LOGIN: '/portal/login',
  HOME: '/portal',
});

export const CLIENT_SUSPENDED_MESSAGE =
  'Akses akun Anda saat ini belum tersedia. Silakan hubungi tim 37 Music Studio.';

export const CLIENT_ADMIN_ACCOUNT_NOTICE =
  'Akun ini terdaftar sebagai akun internal 37 Music Studio dan tidak otomatis masuk ke Client Portal.';
