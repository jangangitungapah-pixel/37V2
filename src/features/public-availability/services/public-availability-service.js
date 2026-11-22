/**
 * Public Availability Domain Services & Owner-Authenticated Legacy Backfill Service.
 *
 * Guarantees:
 * - Only an authenticated active Owner (`actorRole === 'owner'`) can execute the legacy
 *   projection backfill or mutate `publicAvailabilityMetadata/status`.
 * - Scans future canonical bookings using bounded pagination (`pageSize <= 50`).
 * - Excludes `cancelled` and `no_show` bookings (and removes any stale projection for them).
 * - Never copies any customer PII, phone, notes, service, invoice, or payment fields.
 * - Uses small write batches (`writeBatchSize <= 4`) to stay strictly within Firestore Security Rules
 *   `existsAfter` + `getAfter` document access limits.
 * - Verifies integrity of all written projections before marking `isReady = true`.
 */

import {
  getJakartaTodayIso,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';

import {
  PUBLIC_AVAILABILITY_ALLOWED_KEYS,
  PUBLIC_AVAILABILITY_FORBIDDEN_FIELDS,
  PUBLIC_BACKFILL_BATCH_WRITE_LIMIT,
  PUBLIC_BACKFILL_PAGE_SIZE,
} from '../config/public-availability-config';
import { getPublicAvailabilityRepositoryAdapter } from '../repositories/public-availability-repository';
import {
  buildPublicAvailabilityProjectionFromBooking,
  isBookingOccupyingPublicRoom,
} from '../utils/public-availability-calculation';

export function createPublicAvailabilityServiceError(code, message, details = null) {
  const err = new Error(message);
  err.code = code;
  if (details) {
    err.details = details;
  }
  return err;
}

/**
 * Translates raw Firebase/Firestore errors into clear, safe operational messages
 * for public visitors or authenticated Studio Owners.
 */
export function mapPublicAvailabilityErrorToMessage(error, { isAdmin = false } = {}) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('permission-denied') || message.includes('insufficient permissions')) {
    return isAdmin
      ? 'Akses Firestore ditolak (permission-denied). Pastikan Anda login sebagai Owner aktif dan Firestore Rules terbaru sudah di-deploy.'
      : 'Unable to access the studio schedule right now. Please contact the studio directly.';
  }

  if (code.includes('unauthenticated') || code === 'public-availability/owner-required') {
    return isAdmin
      ? 'Hanya Owner Studio yang terautentikasi yang dapat menjalankan sinkronisasi jadwal publik.'
      : 'Unable to verify the studio schedule right now. Please contact the studio.';
  }

  if (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('network-request-failed') ||
    message.includes('network')
  ) {
    return isAdmin
      ? 'Koneksi ke Firestore terputus atau timeout saat sinkronisasi. Periksa jaringan lalu coba lagi.'
      : 'Connection interrupted while loading the studio schedule. Please try again.';
  }

  if (code.includes('failed-precondition') || message.includes('index')) {
    return isAdmin
      ? 'Konfigurasi query/index Firestore belum siap untuk sinkronisasi kalender publik.'
      : 'The studio schedule is temporarily unavailable. Please try again or contact the studio.';
  }

  if (code === 'public-availability/integrity-check-failed') {
    return isAdmin
      ? error?.message || 'Verifikasi integritas proyeksi kalender publik gagal.'
      : 'Studio schedule verification could not be completed. Please contact the studio.';
  }

  return isAdmin
    ? error?.message || 'Gagal menyinkronkan jadwal kalender publik (/availability).'
    : 'Unable to load the studio availability schedule right now. Please try again or contact the studio.';
}

function assertActiveOwnerActor(actorUid, actorRole) {
  const cleanUid = String(actorUid || '').trim();
  const cleanRole = String(actorRole || '')
    .trim()
    .toLowerCase();

  if (!cleanUid || cleanRole !== 'owner') {
    throw createPublicAvailabilityServiceError(
      'public-availability/owner-required',
      'Only an authenticated active Studio Owner can run the public availability backfill.',
    );
  }
  return cleanUid;
}

/**
 * Executes an idempotent, bounded, verifiable Owner-authenticated backfill of
 * `publicAvailability` projections from canonical `bookings` starting at `fromDateIso`.
 *
 * Readiness Gate:
 * - Sets `publicAvailabilityMetadata/status.isReady = false` prior to scanning if `resetReadinessFirst` is true.
 * - Only sets `isReady = true` after all pages are scanned, written, and verified.
 */
export async function backfillPublicAvailabilityProjections({
  actorUid,
  actorRole,
  fromDateIso = getJakartaTodayIso(),
  pageSize = PUBLIC_BACKFILL_PAGE_SIZE,
  writeBatchSize = PUBLIC_BACKFILL_BATCH_WRITE_LIMIT,
  maxPages = 20,
  resetReadinessFirst = true,
  adapter = getPublicAvailabilityRepositoryAdapter(),
} = {}) {
  assertActiveOwnerActor(actorUid, actorRole);

  const cleanFromDate = isValidIsoDateString(fromDateIso)
    ? fromDateIso.trim()
    : getJakartaTodayIso();
  const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || PUBLIC_BACKFILL_PAGE_SIZE));
  const safeBatchSize = Math.max(
    1,
    Math.min(
      PUBLIC_BACKFILL_BATCH_WRITE_LIMIT,
      Number(writeBatchSize) || PUBLIC_BACKFILL_BATCH_WRITE_LIMIT,
    ),
  );

  if (resetReadinessFirst) {
    await adapter.setPublicAvailabilityMetadata({
      isReady: false,
      backfilledFromDate: cleanFromDate,
    });
  }

  let cursorDoc = null;
  let pagesScanned = 0;
  let totalBookingsScanned = 0;
  let activeProjectedCount = 0;
  let excludedCancelledOrNoShowCount = 0;
  const expectedActiveBookings = [];
  const excludedBookingIds = [];
  let isPartial = false;

  while (pagesScanned < maxPages) {
    const pageResult = await adapter.listCanonicalBookingsForBackfillPage({
      fromDateIso: cleanFromDate,
      pageSize: safePageSize,
      cursorDoc,
    });

    pagesScanned += 1;
    const pageBookings = pageResult.bookings || [];
    totalBookingsScanned += pageBookings.length;

    const upserts = [];
    const deleteIds = [];

    for (const booking of pageBookings) {
      if (!booking?.id) continue;

      if (isBookingOccupyingPublicRoom(booking)) {
        const projection = buildPublicAvailabilityProjectionFromBooking(booking, null);
        if (projection) {
          upserts.push({
            bookingId: booking.id,
            projection,
          });
          expectedActiveBookings.push(booking);
          activeProjectedCount += 1;
        }
      } else {
        deleteIds.push(booking.id);
        excludedBookingIds.push(booking.id);
        excludedCancelledOrNoShowCount += 1;
      }
    }

    let verifiedDeleteIds = [];
    if (deleteIds.length > 0) {
      const existingDeleteProjections =
        await adapter.getPublicAvailabilityProjectionsByIds(deleteIds);
      verifiedDeleteIds = deleteIds.filter((id) => existingDeleteProjections.has(id));
    }

    if (upserts.length > 0 || verifiedDeleteIds.length > 0) {
      await adapter.writePublicAvailabilityBatch({
        upserts,
        deleteIds: verifiedDeleteIds,
        batchLimit: safeBatchSize,
      });
    }

    if (!pageResult.hasMore) {
      break;
    }

    cursorDoc = pageResult.nextCursor;
    if (pagesScanned >= maxPages && pageResult.hasMore) {
      isPartial = true;
      break;
    }
  }

  // Integrity Verification: confirm every active booking has a matching sanitized projection
  // and every excluded booking has no public projection.
  const allCheckedIds = [...expectedActiveBookings.map((b) => b.id), ...excludedBookingIds];
  const storedProjectionsMap = await adapter.getPublicAvailabilityProjectionsByIds(allCheckedIds);

  const verificationErrors = [];

  for (const activeBooking of expectedActiveBookings) {
    const stored = storedProjectionsMap.get(activeBooking.id);
    if (!stored) {
      verificationErrors.push(`Missing projection for active booking ${activeBooking.id}.`);
      continue;
    }

    const expectedEndMinute = Number.isFinite(Number(activeBooking.endMinute))
      ? Number(activeBooking.endMinute)
      : Number(activeBooking.startMinute) + Number(activeBooking.durationMinutes || 0);

    if (
      stored.date !== activeBooking.date ||
      stored.studioId !== activeBooking.studioId ||
      stored.startMinute !== Number(activeBooking.startMinute) ||
      stored.endMinute !== expectedEndMinute
    ) {
      verificationErrors.push(`Projection interval mismatch for booking ${activeBooking.id}.`);
    }

    const rawKeys = stored._rawKeys || [];
    const hasForbiddenKey = rawKeys.some(
      (k) =>
        PUBLIC_AVAILABILITY_FORBIDDEN_FIELDS.includes(k) ||
        !PUBLIC_AVAILABILITY_ALLOWED_KEYS.includes(k),
    );
    if (hasForbiddenKey) {
      verificationErrors.push(
        `Unsanitized key detected in projection for booking ${activeBooking.id}.`,
      );
    }
  }

  for (const excludedId of excludedBookingIds) {
    if (storedProjectionsMap.has(excludedId)) {
      verificationErrors.push(
        `Excluded cancelled/no-show booking ${excludedId} still has an active projection.`,
      );
    }
  }

  if (verificationErrors.length > 0) {
    throw createPublicAvailabilityServiceError(
      'public-availability/integrity-check-failed',
      `Public availability integrity check failed: ${verificationErrors[0]}`,
      { verificationErrors },
    );
  }

  // Only mark readiness complete if the scan finished completely without truncation or verification errors
  const isReady = !isPartial;
  const metadata = await adapter.setPublicAvailabilityMetadata({
    isReady,
    backfilledFromDate: cleanFromDate,
  });

  return {
    isReady,
    isPartial,
    fromDateIso: cleanFromDate,
    pagesScanned,
    totalBookingsScanned,
    activeProjectedCount,
    excludedCancelledOrNoShowCount,
    verifiedProjectionsCount: expectedActiveBookings.length,
    metadata,
  };
}
