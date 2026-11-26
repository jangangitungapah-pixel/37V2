import { computeStoredPaymentStatus } from '@/features/admin/payment/utils/invoice-status';

const COLLECTIONS = {
  BOOKINGS: 'bookings',
  REQUESTS: 'publicBookingRequests',
  INVOICES: 'invoices',
  RESERVATIONS: 'clientReservations',
  SETTINGS: 'settings',
};
const STATUS_DOC_ID = 'clientReservationBackfill';
const BATCH_SIZE = 5;

function serviceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function validateClientReservationBackfillActor(actorUid, actorRole) {
  const uid = String(actorUid || '').trim();
  const role = String(actorRole || '').trim().toLowerCase();
  if (!uid || role !== 'owner') {
    throw serviceError('client-reservation-backfill/owner-only', 'Hanya Owner aktif yang boleh menjalankan identity backfill.');
  }
  return uid;
}

function defaultBackfillStatus() {
  return {
    schemaVersion: 1,
    status: 'not_started',
    cursorBookingId: '',
    processedCount: 0,
    projectedCount: 0,
    skippedCount: 0,
    version: 0,
    updatedAt: null,
    updatedByUid: '',
  };
}

export function buildClientReservationProjection(booking, invoice, timestamp) {
  const bookingId = String(booking?.id || '').trim();
  const clientUid = String(booking?.clientUid || '').trim();
  const customerId = String(booking?.customerId || '').trim();
  if (!bookingId || (!clientUid && !customerId)) return null;
  const studioId = String(booking.studioId || '');
  if (!['room-a', 'room-b'].includes(studioId)) return null;
  const startMinute = Number(booking.startMinute);
  const durationMinutes = Number(booking.durationMinutes);
  const endMinute = Number(booking.endMinute);
  if (
    !Number.isInteger(startMinute) ||
    !Number.isInteger(durationMinutes) ||
    !Number.isInteger(endMinute) ||
    endMinute !== startMinute + durationMinutes
  ) return null;

  return {
    schemaVersion: 2,
    bookingId,
    bookingReference: String(booking.bookingReference || booking.bookingCode || bookingId),
    customerId: String(booking.customerId || ''),
    clientUid,
    sourceRequestId: String(booking.sourceRequestId || ''),
    acceptedOfferId: String(booking.acceptedOfferId || ''),
    invoiceId: `inv_${bookingId}`,
    studioId,
    studioName: String(booking.studioName || ''),
    serviceTypeName: String(booking.serviceTypeName || booking.serviceTypeId || booking.serviceLabel || ''),
    serviceOptionName: String(booking.serviceOptionName || booking.packageLabel || ''),
    date: String(booking.date || ''),
    startMinute,
    endMinute,
    durationMinutes,
    timeZone: 'Asia/Jakarta',
    reservationStatus:
      booking.sessionStatus === 'cancelled'
        ? 'cancelled'
        : (booking.reservationStatus || 'confirmed'),
    sessionStatus: String(booking.sessionStatus || 'upcoming'),
    holdExpiresAt: booking.holdExpiresAt || null,
    effectiveTotalAmount: Math.max(
      0,
      Math.round(Number(invoice?.effectiveTotalAmount ?? invoice?.financialSnapshot?.totalAmount ?? invoice?.totalAmount ?? booking.totalAmount) || 0),
    ),
    minimumDepositAmount:
      Number.isInteger(invoice?.minimumDepositAmount)
        ? invoice.minimumDepositAmount
        : Number.isInteger(booking.minimumDepositAmount)
          ? booking.minimumDepositAmount
          : null,
    depositStatus:
      typeof invoice?.depositStatus === 'string'
        ? invoice.depositStatus
        : typeof booking.depositStatus === 'string'
          ? booking.depositStatus
          : null,
    paymentStatus: String(
      invoice?.paymentStatus ||
      computeStoredPaymentStatus(
        invoice?.effectiveTotalAmount ??
          invoice?.financialSnapshot?.totalAmount ??
          invoice?.totalAmount ??
          booking.totalAmount,
        invoice?.amountPaid ?? booking.initialPaidAmount,
      ),
    ),
    createdAt: booking.createdAt || timestamp,
    updatedAt: timestamp,
    version: Number(booking.version) || 1,
  };
}

function areProjectionValuesEqual(left, right) {
  if (left === right) return true;
  if (left == null || right == null) return left === right;
  if (typeof left === 'object' && typeof right === 'object') {
    if (
      Number.isFinite(Number(left.seconds)) &&
      Number.isFinite(Number(right.seconds))
    ) {
      return (
        Number(left.seconds) === Number(right.seconds) &&
        Number(left.nanoseconds || 0) === Number(right.nanoseconds || 0)
      );
    }
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

function isClientReservationProjectionUnchanged(existing, next) {
  if (!existing || !next) return false;
  const nextKeys = new Set(Object.keys(next));
  if (Object.keys(existing).some((key) => !nextKeys.has(key))) return false;
  return Object.keys(next)
    .filter((key) => key !== 'updatedAt')
    .every((key) => areProjectionValuesEqual(existing[key], next[key]));
}

export function createClientReservationBackfillService() {
  return {
    subscribeStatus({ actorUid, actorRole, onData, onError }) {
      validateClientReservationBackfillActor(actorUid, actorRole);
      let unsubscribe = null;
      let cancelled = false;
      (async () => {
        try {
          const [{ doc, onSnapshot }, { getFirebaseDb }] = await Promise.all([
            import('firebase/firestore'),
            import('@/lib/firebase/firestore'),
          ]);
          if (cancelled) return;
          const ref = doc(getFirebaseDb(), COLLECTIONS.SETTINGS, STATUS_DOC_ID);
          unsubscribe = onSnapshot(
            ref,
            (snapshot) => {
              if (cancelled) return;
              onData?.(snapshot.exists() ? snapshot.data() : defaultBackfillStatus());
            },
            (error) => { if (!cancelled) onError?.(error); },
          );
        } catch (error) {
          if (!cancelled) onError?.(error);
        }
      })();
      return () => { cancelled = true; unsubscribe?.(); };
    },

    async runNextBatch({ actorUid, actorRole, restart = false }) {
      const ownerUid = validateClientReservationBackfillActor(actorUid, actorRole);
      const [
        { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAfter },
        { getFirebaseDb },
      ] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const statusRef = doc(db, COLLECTIONS.SETTINGS, STATUS_DOC_ID);
      const statusSnap = await getDoc(statusRef);
      let previous = statusSnap.exists()
        ? { ...defaultBackfillStatus(), ...statusSnap.data() }
        : defaultBackfillStatus();

      if (previous.status === 'completed' && !restart) {
        return {
          isComplete: true,
          newlyProjected: 0,
          projectedCount: previous.projectedCount,
          processedCount: previous.processedCount,
          skippedCount: previous.skippedCount,
        };
      }
      if (previous.status === 'completed' && restart) {
        previous = {
          ...defaultBackfillStatus(),
          version: Number(previous.version) || 0,
        };
      }

      // A single-field ordered scan covers portal-origin bookings and linked CRM walk-ins,
      // including history. No composite index or unbounded query is introduced.
      const constraints = [orderBy('date', 'asc')];
      if (previous.cursorBookingId) {
        const cursorSnapshot = await getDoc(doc(db, COLLECTIONS.BOOKINGS, previous.cursorBookingId));
        if (cursorSnapshot.exists()) constraints.push(startAfter(cursorSnapshot));
      }
      constraints.push(limit(BATCH_SIZE));
      const page = await getDocs(query(collection(db, COLLECTIONS.BOOKINGS), ...constraints));
      const documents = page.docs || [];

      if (documents.length === 0) {
        const completed = {
          ...previous,
          status: 'completed',
          updatedAt: serverTimestamp(),
          updatedByUid: ownerUid,
          version: (Number(previous.version) || 0) + 1,
        };
        await setDoc(statusRef, completed, { merge: true });
        return {
          isComplete: true,
          newlyProjected: 0,
          projectedCount: previous.projectedCount || 0,
          processedCount: previous.processedCount || 0,
          skippedCount: previous.skippedCount || 0,
        };
      }

      let newlyProjected = 0;
      let skipped = 0;
      let processed = 0;
      let lastBookingId = previous.cursorBookingId || '';

      for (const candidate of documents) {
        const bookingId = candidate.id;
        lastBookingId = bookingId;
        processed += 1;

        const outcome = await runTransaction(db, async (transaction) => {
          const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);
          const invoiceRef = doc(db, COLLECTIONS.INVOICES, `inv_${bookingId}`);
          const reservationRef = doc(db, COLLECTIONS.RESERVATIONS, bookingId);

          // Read the canonical booking first. All identity-dependent references below are
          // derived from this transactional snapshot, never from the earlier page query.
          const bookingSnapshot = await transaction.get(bookingRef);
          if (!bookingSnapshot.exists()) return 'skipped';

          const booking = { id: bookingId, ...bookingSnapshot.data() };
          const customerId = String(booking.customerId || '').trim();
          if (!customerId) return 'skipped';

          const candidateRequestId = String(booking.sourceRequestId || '').trim();
          const requestRef = candidateRequestId
            ? doc(db, COLLECTIONS.REQUESTS, candidateRequestId)
            : null;
          const linkRef = doc(db, 'clientCustomerLinks', customerId);
          const [
            requestSnapshot,
            invoiceSnapshot,
            linkSnapshot,
            reservationSnapshot,
          ] = await Promise.all([
            requestRef ? transaction.get(requestRef) : Promise.resolve(null),
            transaction.get(invoiceRef),
            transaction.get(linkRef),
            transaction.get(reservationRef),
          ]);

          const invoice = invoiceSnapshot.exists() ? invoiceSnapshot.data() : null;
          if (
            invoice &&
            (
              (invoice.bookingId && invoice.bookingId !== bookingId) ||
              (invoice.customerId && invoice.customerId !== customerId) ||
              (invoice.clientUid && booking.clientUid && invoice.clientUid !== booking.clientUid)
            )
          ) {
            return 'skipped';
          }

          let resolvedClientUid = '';
          let linkedPortalRequest = null;
          const isPortalOrigin = String(booking.source || '') === 'client_portal';

          if (isPortalOrigin || candidateRequestId) {
            if (!requestSnapshot?.exists()) return 'skipped';
            linkedPortalRequest = requestSnapshot.data() || {};
            const requestUid = String(linkedPortalRequest.clientUid || '').trim();
            if (
              linkedPortalRequest.source !== 'client_portal' ||
              linkedPortalRequest.status !== 'confirmed' ||
              linkedPortalRequest.linkedBookingId !== bookingId ||
              String(linkedPortalRequest.customerId || '') !== customerId ||
              !requestUid
            ) {
              return 'skipped';
            }
            resolvedClientUid = requestUid;
          } else {
            if (!linkSnapshot?.exists()) return 'skipped';
            const link = linkSnapshot.data() || {};
            const linkedUid = String(link.ownerUid || '').trim();
            if (
              link.customerId !== customerId ||
              !linkedUid
            ) {
              return 'skipped';
            }

            const accountSnapshot = await transaction.get(
              doc(db, 'clientAccounts', linkedUid),
            );
            if (!accountSnapshot.exists()) return 'skipped';
            const account = accountSnapshot.data() || {};
            if (
              account.uid !== linkedUid ||
              account.role !== 'client' ||
              account.status !== 'active' ||
              account.customerId !== customerId ||
              account.profileSource !== 'linked_customer'
            ) {
              return 'skipped';
            }
            resolvedClientUid = linkedUid;
          }

          if (
            !resolvedClientUid ||
            (booking.clientUid && booking.clientUid !== resolvedClientUid) ||
            (invoice?.clientUid && invoice.clientUid !== resolvedClientUid)
          ) {
            return 'skipped';
          }

          const nowValue = serverTimestamp();
          const existingReservation = reservationSnapshot?.exists()
            ? reservationSnapshot.data()
            : null;
          const nextSourceRequestId = isPortalOrigin
            ? candidateRequestId
            : String(booking.sourceRequestId || '');
          const nextAcceptedOfferId = isPortalOrigin
            ? String(booking.acceptedOfferId || linkedPortalRequest?.acceptedOfferId || '')
            : String(booking.acceptedOfferId || '');
          const bookingNeedsLink =
            booking.clientUid !== resolvedClientUid ||
            (isPortalOrigin && (
              booking.source !== 'client_portal' ||
              booking.sourceRequestId !== nextSourceRequestId ||
              booking.acceptedOfferId !== nextAcceptedOfferId
            ));
          const nextBooking = {
            ...booking,
            clientUid: resolvedClientUid,
            ...(isPortalOrigin
              ? {
                  source: 'client_portal',
                  sourceRequestId: nextSourceRequestId,
                  acceptedOfferId: nextAcceptedOfferId,
                }
              : {}),
            version: (Number(booking.version) || 1) + (bookingNeedsLink ? 1 : 0),
            updatedAt: bookingNeedsLink ? nowValue : booking.updatedAt,
            updatedByUid: bookingNeedsLink ? ownerUid : booking.updatedByUid,
          };
          const projection = buildClientReservationProjection(nextBooking, invoice, nowValue);
          if (!projection) return 'skipped';
          if (!booking.createdAt && existingReservation?.createdAt) {
            projection.createdAt = existingReservation.createdAt;
          }
          const projectionChanged = !isClientReservationProjectionUnchanged(
            existingReservation,
            projection,
          );

          if (bookingNeedsLink) {
            const patch = {
              clientUid: resolvedClientUid,
              updatedAt: nowValue,
              updatedByUid: ownerUid,
              version: nextBooking.version,
            };
            if (isPortalOrigin) {
              patch.source = 'client_portal';
              patch.sourceRequestId = nextSourceRequestId;
              patch.acceptedOfferId = nextAcceptedOfferId;
            }
            transaction.update(bookingRef, patch);
          }

          if (invoice && !invoice.clientUid) {
            transaction.update(invoiceRef, {
              clientUid: resolvedClientUid,
              updatedAt: nowValue,
              updatedByUid: ownerUid,
              version: (Number(invoice.version) || 1) + 1,
            });
          }

          if (projectionChanged) {
            transaction.set(reservationRef, projection);
          }
          return 'projected';
        });
        if (outcome === 'projected') newlyProjected += 1;
        else skipped += 1;
      }

      const totalProcessed = (Number(previous.processedCount) || 0) + processed;
      const totalProjected = (Number(previous.projectedCount) || 0) + newlyProjected;
      const totalSkipped = (Number(previous.skippedCount) || 0) + skipped;
      const isComplete = documents.length < BATCH_SIZE;
      const nextStatus = {
        schemaVersion: 1,
        status: isComplete ? 'completed' : 'running',
        cursorBookingId: lastBookingId,
        processedCount: totalProcessed,
        projectedCount: totalProjected,
        skippedCount: totalSkipped,
        version: (Number(previous.version) || 0) + 1,
        updatedAt: serverTimestamp(),
        updatedByUid: ownerUid,
      };
      await setDoc(statusRef, nextStatus, { merge: true });

      return {
        isComplete,
        newlyProjected,
        processedCount: totalProcessed,
        projectedCount: totalProjected,
        skippedCount: totalSkipped,
      };
    }
  };
}

let backfillService;
export function getClientReservationBackfillService() {
  if (!backfillService) backfillService = createClientReservationBackfillService();
  return backfillService;
}
