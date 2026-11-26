import { getTodayLocalDateString } from '@/lib/booking-date';

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
  if (!bookingId || !clientUid) return null;
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
    schemaVersion: 1,
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
      Math.round(Number(invoice?.effectiveTotalAmount ?? invoice?.totalAmount ?? booking.totalAmount) || 0),
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
    paymentStatus: String(invoice?.paymentStatus || booking.paymentStatus || 'unpaid'),
    createdAt: booking.createdAt || timestamp,
    updatedAt: timestamp,
    version: Number(booking.version) || 1,
  };
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

    async runNextBatch({ actorUid, actorRole, now = new Date() }) {
      const ownerUid = validateClientReservationBackfillActor(actorUid, actorRole);
      const todayIso = getTodayLocalDateString(now);
      const [
        { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAfter, where },
        { getFirebaseDb },
      ] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const statusRef = doc(db, COLLECTIONS.SETTINGS, STATUS_DOC_ID);
      const statusSnap = await getDoc(statusRef);
      const previous = statusSnap.exists() ? { ...defaultBackfillStatus(), ...statusSnap.data() } : defaultBackfillStatus();

      if (previous.status === 'completed') {
        return {
          isComplete: true,
          newlyProjected: 0,
          projectedCount: previous.projectedCount,
          processedCount: previous.processedCount,
          skippedCount: previous.skippedCount,
        };
      }

      const constraints = [
        where('source', '==', 'client_portal'),
        where('date', '>=', todayIso),
        orderBy('date', 'asc'),
      ];
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
        await setDoc(statusRef, completed);
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
        try {
          const outcome = await runTransaction(db, async (transaction) => {
            const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);
            const candidateData = candidate.data() || {};
            const requestId = String(candidateData.sourceRequestId || '').trim();
            if (!requestId) return 'skipped';

            const requestRef = doc(db, COLLECTIONS.REQUESTS, requestId);
            const invoiceRef = doc(db, COLLECTIONS.INVOICES, `inv_${bookingId}`);
            const [bookingSnapshot, requestSnapshot, invoiceSnapshot] = await Promise.all([
              transaction.get(bookingRef),
              transaction.get(requestRef),
              transaction.get(invoiceRef),
            ]);
            if (!bookingSnapshot.exists() || !requestSnapshot.exists()) return 'skipped';

            const booking = { id: bookingId, ...bookingSnapshot.data() };
            const request = requestSnapshot.data() || {};
            const invoice = invoiceSnapshot.exists() ? invoiceSnapshot.data() : null;
            const requestUid = String(request.clientUid || '').trim();
            if (
              request.source !== 'client_portal' ||
              request.status !== 'confirmed' ||
              request.linkedBookingId !== bookingId ||
              !requestUid ||
              ['cancelled', 'no_show'].includes(booking.sessionStatus) ||
              booking.date < todayIso
            ) return 'skipped';

            if (booking.clientUid && booking.clientUid !== requestUid) return 'skipped';
            if (invoice?.clientUid && invoice.clientUid !== requestUid) return 'skipped';

            const nowValue = serverTimestamp();
            const bookingNeedsLink =
              !booking.clientUid ||
              booking.source !== 'client_portal' ||
              booking.sourceRequestId !== requestId ||
              typeof booking.acceptedOfferId !== 'string';
            const nextBooking = {
              ...booking,
              clientUid: requestUid,
              source: 'client_portal',
              sourceRequestId: requestId,
              acceptedOfferId: String(booking.acceptedOfferId || request.acceptedOfferId || ''),
              version: (Number(booking.version) || 1) + (bookingNeedsLink ? 1 : 0),
              updatedAt: bookingNeedsLink ? nowValue : booking.updatedAt,
              updatedByUid: bookingNeedsLink ? ownerUid : booking.updatedByUid,
            };
            const projection = buildClientReservationProjection(nextBooking, invoice, nowValue);
            if (!projection) return 'skipped';

            if (bookingNeedsLink) {
              const patch = {
                clientUid: requestUid,
                source: 'client_portal',
                sourceRequestId: requestId,
                acceptedOfferId: nextBooking.acceptedOfferId,
                updatedAt: nowValue,
                updatedByUid: ownerUid,
                version: nextBooking.version,
              };
              transaction.update(bookingRef, patch);
            }

            if (invoice && !invoice.clientUid) {
              transaction.update(invoiceRef, {
                clientUid: requestUid,
                updatedAt: nowValue,
                updatedByUid: ownerUid,
                version: (Number(invoice.version) || 1) + 1,
              });
            }

            transaction.set(doc(db, COLLECTIONS.RESERVATIONS, bookingId), projection);
            return 'projected';
          });
          if (outcome === 'projected') newlyProjected += 1;
          else skipped += 1;
        } catch {
          skipped += 1;
        }
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
        projectedCount: totalProjected,
        processedCount: totalProcessed,
        skippedCount: totalSkipped,
      };
    },
  };
}

let backfillService;
export function getClientReservationBackfillService() {
  if (!backfillService) backfillService = createClientReservationBackfillService();
  return backfillService;
}
