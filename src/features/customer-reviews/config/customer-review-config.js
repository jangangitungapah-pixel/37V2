export const CUSTOMER_REVIEWS_COLLECTION = 'customerReviews';
export const REVIEW_INVITATIONS_COLLECTION = 'reviewInvitations';
export const REVIEW_INVITATION_INDEXES_COLLECTION = 'reviewInvitationIndexes';
export const PUBLIC_REVIEW_STATS_COLLECTION = 'publicReviewStats';
export const PUBLIC_REVIEW_STATS_DOC_ID = 'summary';

export const CUSTOMER_REVIEW_SCHEMA_VERSION = 1;
export const CUSTOMER_REVIEW_CONSENT_VERSION = 'customer-review-publication-v1';

export const REVIEW_INVITATION_VALIDITY_DAYS = 30;
export const REVIEW_INVITATION_VALIDITY_MS = REVIEW_INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

export const REVIEW_INVITATION_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUBMITTED: 'submitted',
  REVOKED: 'revoked',
});

export const CUSTOMER_REVIEW_STATUS = Object.freeze({
  PENDING: 'pending',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
});

/**
 * Authoritative Owner moderation transition matrix.
 * Staff accounts cannot perform any transition here.
 */
export const ALLOWED_REVIEW_MODERATION_TRANSITIONS = Object.freeze({
  [CUSTOMER_REVIEW_STATUS.PENDING]: Object.freeze([
    CUSTOMER_REVIEW_STATUS.PUBLISHED,
    CUSTOMER_REVIEW_STATUS.REJECTED,
  ]),
  [CUSTOMER_REVIEW_STATUS.REJECTED]: Object.freeze([
    CUSTOMER_REVIEW_STATUS.PENDING,
    CUSTOMER_REVIEW_STATUS.PUBLISHED,
  ]),
  [CUSTOMER_REVIEW_STATUS.PUBLISHED]: Object.freeze([CUSTOMER_REVIEW_STATUS.ARCHIVED]),
  [CUSTOMER_REVIEW_STATUS.ARCHIVED]: Object.freeze([
    CUSTOMER_REVIEW_STATUS.PUBLISHED,
    CUSTOMER_REVIEW_STATUS.REJECTED,
  ]),
});

export const CUSTOMER_REVIEW_LIMITS = Object.freeze({
  tokenByteLength: 32,
  tokenHexLength: 64,
  displayNameMin: 2,
  displayNameMax: 80,
  ratingMin: 1,
  ratingMax: 5,
  reviewTextMin: 10,
  reviewTextMax: 1500,
  publicReviewsLimit: 9,
  adminReviewsLimit: 200,
  adminInvitationsLimit: 200,
});

export const CUSTOMER_REVIEW_CONSENT_LABEL =
  'Saya menyetujui 37 Music Studio menampilkan nama tampilan dan ulasan ini di website publik 37 Music Studio.';

export const CUSTOMER_REVIEW_MODERATION_NOTICE =
  'Ulasan tidak langsung ditampilkan. Tim 37 Music Studio akan meninjau ulasan sebelum dipublikasikan.';

export const CUSTOMER_REVIEW_SUCCESS_COPY = Object.freeze({
  heading: 'TERIMA KASIH ATAS ULASAN LO!',
  description: 'Ulasan berhasil dikirim dan sedang menunggu peninjauan tim 37 Music Studio.',
});
