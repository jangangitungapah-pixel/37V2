import {
  BOOKING_EVENT_TYPES,
  BOOKING_SESSION_STATUS,
  CALENDAR_BOOKINGS_QUERY_LIMIT,
  STUDIO_TIME_ZONE,
} from '../config/calendar-config';
import {
  generateOperationId,
  getBookingRepositoryAdapter,
  normalizeBookingEventRecord,
  normalizeBookingRecord,
} from '../repositories/calendar-booking-repository';
import { validateBookingFormPayload } from '../schemas/booking-schema';
import {
  buildBookingSlotRecords,
  formatMinuteOfDay,
  formatMinuteRange,
  isBookingNoShowEligible,
} from '../utils/booking-time';

export function createBookingServiceError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

/**
 * Maps internal or Firestore errors into safe, clear Indonesian operational messages.
 */
export function mapBookingErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'Akses ditolak oleh Firestore. Pastikan akun Anda aktif sebagai Owner atau Staff.';
  }

  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'Koneksi jaringan tidak tersedia. Periksa koneksi internet Anda lalu coba kembali.';
  }

  if (code === 'booking/slot-conflict') {
    return (
      error.message ||
      'Slot jadwal yang dipilih sudah digunakan oleh booking lain pada ruangan dan waktu tersebut.'
    );
  }

  if (code === 'booking/stale-update') {
    return (
      error.message ||
      'Data booking telah diperbarui di sesi lain. Silakan tutup dan buka kembali detail booking.'
    );
  }

  if (code === 'booking/not-found') {
    return 'Data booking tidak ditemukan di database.';
  }

  if (
    code.startsWith('booking/') &&
    typeof error?.message === 'string' &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return 'Gagal memproses transaksi booking. Silakan periksa kembali data jadwal dan coba lagi.';
}

/**
 * Validates that the caller is an authenticated active staff/owner before starting a transaction.
 */
function assertAuthenticatedStaffActor(actorUid) {
  const cleanUid = String(actorUid || '').trim();
  if (!cleanUid) {
    throw createBookingServiceError(
      'booking/missing-actor',
      'Sesi pengguna tidak valid. Silakan login kembali sebagai Staff atau Owner.',
    );
  }
  return cleanUid;
}

/**
 * Creates a new booking atomically using a Firestore transaction:
 * 1. Validates input & operating hours
 * 2. Reads booking document & event document for idempotency on retry
 * 3. Reads all required 30-minute `bookingSlots/{date__studioId__slotStartMinute}` documents
 * 4. Rejects if any slot is already locked by another booking
 * 5. Writes `bookings/{bookingId}`, all `bookingSlots/{slotId}`, and `bookingEvents/{eventId}`
 */
export async function createBooking({
  bookingId = generateOperationId('bkg'),
  eventId = generateOperationId('evt'),
  actorUid,
  formValues,
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim() || generateOperationId('bkg');
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');

  const validation = validateBookingFormPayload(formValues, [], '');
  if (!validation.isValid) {
    const firstErrorMessage =
      Object.values(validation.errors)[0] || 'Data form booking belum lengkap atau tidak valid.';
    throw createBookingServiceError(
      'booking/validation-error',
      firstErrorMessage,
      validation.errors,
    );
  }

  const payload = validation.payload;
  const requiredSlots = buildBookingSlotRecords({
    bookingId: cleanBookingId,
    date: payload.date,
    studioId: payload.studioId,
    startMinute: payload.startMinute,
    durationMinutes: payload.durationMinutes,
  });

  if (requiredSlots.length === 0) {
    throw createBookingServiceError(
      'booking/invalid-duration',
      'Rentang waktu booking tidak menghasilkan slot 30 menit yang valid.',
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const existingBooking = await tx.getBooking(cleanBookingId);
    const existingEvent = await tx.getEvent(cleanEventId);

    const slotSnapshots = await Promise.all(requiredSlots.map((slot) => tx.getSlot(slot.id)));

    // Idempotent retry: if this exact bookingId + eventId was already committed, return it
    if (existingBooking && existingEvent) {
      return existingBooking;
    }

    if (existingBooking && existingBooking.createdByUid !== cleanActorUid) {
      throw createBookingServiceError(
        'booking/duplicate-id',
        'ID operasi booking sudah digunakan.',
      );
    }

    // Check slot locks
    for (let i = 0; i < requiredSlots.length; i++) {
      const targetSlot = requiredSlots[i];
      const existingSlotLock = slotSnapshots[i];

      if (existingSlotLock && existingSlotLock.bookingId !== cleanBookingId) {
        const slotEnd = targetSlot.slotStartMinute + 30;
        throw createBookingServiceError(
          'booking/slot-conflict',
          `Jadwal bentrok pada slot ${formatMinuteOfDay(targetSlot.slotStartMinute)}–${formatMinuteOfDay(slotEnd)} WIB. Pilih jam atau ruangan lain.`,
          {
            slotId: targetSlot.id,
            slotStartMinute: targetSlot.slotStartMinute,
            conflictingBookingId: existingSlotLock.bookingId,
          },
        );
      }
    }

    // 2. ALL WRITES AFTER READS
    const timestamp = tx.nowValue();

    const bookingDoc = {
      customerName: payload.customerName,
      phone: payload.phone,
      bandName: payload.bandName,
      studioId: payload.studioId,
      serviceId: payload.serviceId,
      serviceLabel: payload.serviceLabel,
      packageId: payload.packageId,
      packageLabel: payload.packageLabel,
      recordingTypeId: payload.recordingTypeId,
      recordingTypeLabel: payload.recordingTypeLabel,
      date: payload.date,
      startMinute: payload.startMinute,
      durationMinutes: payload.durationMinutes,
      endMinute: payload.endMinute,
      timeZone: STUDIO_TIME_ZONE,
      unitRate: payload.unitRate,
      subtotal: payload.subtotal,
      discountAmount: payload.discountAmount,
      totalAmount: payload.totalAmount,
      initialPaymentStatus: payload.initialPaymentStatus,
      initialPaidAmount: payload.initialPaidAmount,
      paymentMethod: payload.paymentMethod,
      sessionStatus: BOOKING_SESSION_STATUS.UPCOMING,
      checkedInAt: null,
      checkedInByUid: '',
      actualStartedAt: null,
      actualCompletedAt: null,
      notes: payload.notes,
      createdAt: timestamp,
      createdByUid: cleanActorUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: 1,
    };

    tx.setBooking(cleanBookingId, bookingDoc);

    for (const slot of requiredSlots) {
      tx.setSlot(slot.id, {
        bookingId: cleanBookingId,
        date: slot.date,
        studioId: slot.studioId,
        slotStartMinute: slot.slotStartMinute,
        createdAt: timestamp,
      });
    }

    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType: BOOKING_EVENT_TYPES.CREATED,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: null,
      newValue: {
        date: payload.date,
        studioId: payload.studioId,
        startMinute: payload.startMinute,
        endMinute: payload.endMinute,
        durationMinutes: payload.durationMinutes,
        serviceLabel: payload.serviceLabel,
        sessionStatus: BOOKING_SESSION_STATUS.UPCOMING,
      },
      note: `Booking dibuat untuk ${payload.customerName} (${formatMinuteRange(payload.startMinute, payload.endMinute)})`,
    });

    return normalizeBookingRecord(cleanBookingId, bookingDoc);
  });
}

/**
 * Updates or reschedules an existing booking atomically:
 * - Reads existing booking and verifies `expectedVersion` (prevents stale overwrites)
 * - Reads all old slot locks and all target slot locks before writing
 * - Verifies target slots are not locked by another booking
 * - Releases old slot locks no longer used and creates new slot locks
 * - Preserves the immutable initial payment snapshot (`initialPaymentStatus`, `initialPaidAmount`, `paymentMethod`)
 * - Records `booking_rescheduled` (if schedule changed) or `booking_edited` in `bookingEvents`
 */
export async function updateOrRescheduleBooking({
  bookingId,
  expectedVersion,
  eventId = generateOperationId('evt'),
  actorUid,
  formValues,
  mode = 'edit',
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');

  if (!cleanBookingId) {
    throw createBookingServiceError('booking/not-found', 'ID booking wajib disertakan.');
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. READ EXISTING BOOKING & EVENT FIRST
    const existingBooking = await tx.getBooking(cleanBookingId);
    const existingEvent = await tx.getEvent(cleanEventId);

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    // Idempotent retry check
    if (existingEvent) {
      return existingBooking;
    }

    if (
      existingBooking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED ||
      existingBooking.sessionStatus === BOOKING_SESSION_STATUS.NO_SHOW
    ) {
      throw createBookingServiceError(
        'booking/cancelled-immutable',
        'Booking yang sudah dibatalkan atau No Show tidak dapat diubah jadwalnya.',
      );
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data booking sudah berubah sejak form dibuka. Muat ulang detail booking sebelum menyimpan.',
      );
    }

    // Validate form values while preserving the existing initial payment snapshot
    const mergedFormValues = {
      ...formValues,
      initialPaymentStatus: existingBooking.initialPaymentStatus,
      dpAmount: existingBooking.initialPaidAmount,
      paymentMethod: existingBooking.paymentMethod || 'cash',
    };

    const validation = validateBookingFormPayload(mergedFormValues, [], cleanBookingId);
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0] || 'Data perubahan booking tidak valid.';
      throw createBookingServiceError(
        'booking/validation-error',
        firstErrorMessage,
        validation.errors,
      );
    }

    const payload = validation.payload;

    const oldSlots = buildBookingSlotRecords({
      bookingId: cleanBookingId,
      date: existingBooking.date,
      studioId: existingBooking.studioId,
      startMinute: existingBooking.startMinute,
      durationMinutes: existingBooking.durationMinutes,
    });

    const newSlots = buildBookingSlotRecords({
      bookingId: cleanBookingId,
      date: payload.date,
      studioId: payload.studioId,
      startMinute: payload.startMinute,
      durationMinutes: payload.durationMinutes,
    });

    // Read union of old and new slot IDs before any writes
    const allSlotIds = Array.from(
      new Set([...oldSlots.map((s) => s.id), ...newSlots.map((s) => s.id)]),
    );
    const slotMap = new Map();
    const readSlots = await Promise.all(allSlotIds.map((id) => tx.getSlot(id)));
    allSlotIds.forEach((id, idx) => {
      slotMap.set(id, readSlots[idx]);
    });

    // Verify old slots are not hijacked by another booking
    for (const oldSlot of oldSlots) {
      const currentLock = slotMap.get(oldSlot.id);
      if (currentLock && currentLock.bookingId !== cleanBookingId) {
        throw createBookingServiceError(
          'booking/slot-ownership-mismatch',
          'Kepemilikan slot lama sudah tidak sesuai. Silakan muat ulang kalender.',
        );
      }
    }

    // Verify all new slots are either free or already owned by this booking
    for (const newSlot of newSlots) {
      const currentLock = slotMap.get(newSlot.id);
      if (currentLock && currentLock.bookingId !== cleanBookingId) {
        const slotEnd = newSlot.slotStartMinute + 30;
        throw createBookingServiceError(
          'booking/slot-conflict',
          `Jadwal tujuan bentrok pada slot ${formatMinuteOfDay(newSlot.slotStartMinute)}–${formatMinuteOfDay(slotEnd)} WIB. Jadwal awal tetap dipertahankan.`,
          {
            slotId: newSlot.id,
            slotStartMinute: newSlot.slotStartMinute,
            conflictingBookingId: currentLock.bookingId,
          },
        );
      }
    }

    // 2. ALL WRITES AFTER READS
    const timestamp = tx.nowValue();
    const newSlotIdSet = new Set(newSlots.map((s) => s.id));
    const oldSlotIdSet = new Set(oldSlots.map((s) => s.id));

    // Delete old slots that are no longer needed
    for (const oldSlot of oldSlots) {
      if (!newSlotIdSet.has(oldSlot.id) && slotMap.get(oldSlot.id)) {
        tx.deleteSlot(oldSlot.id);
      }
    }

    // Create/update new slots
    for (const newSlot of newSlots) {
      if (!oldSlotIdSet.has(newSlot.id) || !slotMap.get(newSlot.id)) {
        tx.setSlot(newSlot.id, {
          bookingId: cleanBookingId,
          date: newSlot.date,
          studioId: newSlot.studioId,
          slotStartMinute: newSlot.slotStartMinute,
          createdAt: timestamp,
        });
      }
    }

    const scheduleChanged =
      existingBooking.date !== payload.date ||
      existingBooking.studioId !== payload.studioId ||
      existingBooking.startMinute !== payload.startMinute ||
      existingBooking.durationMinutes !== payload.durationMinutes;

    const nextVersion = (Number(existingBooking.version) || 1) + 1;

    // Preserve immutable initial payment snapshot fields from existingBooking
    const updatedFields = {
      customerName: payload.customerName,
      phone: payload.phone,
      bandName: payload.bandName,
      studioId: payload.studioId,
      serviceId: payload.serviceId,
      serviceLabel: payload.serviceLabel,
      packageId: payload.packageId,
      packageLabel: payload.packageLabel,
      recordingTypeId: payload.recordingTypeId,
      recordingTypeLabel: payload.recordingTypeLabel,
      date: payload.date,
      startMinute: payload.startMinute,
      durationMinutes: payload.durationMinutes,
      endMinute: payload.endMinute,
      timeZone: STUDIO_TIME_ZONE,
      unitRate: payload.unitRate,
      subtotal: payload.subtotal,
      discountAmount: payload.discountAmount,
      totalAmount: payload.totalAmount,
      initialPaymentStatus: existingBooking.initialPaymentStatus,
      initialPaidAmount: existingBooking.initialPaidAmount,
      paymentMethod: existingBooking.paymentMethod,
      sessionStatus: existingBooking.sessionStatus,
      checkedInAt: existingBooking.checkedInAt,
      checkedInByUid: existingBooking.checkedInByUid,
      actualStartedAt: existingBooking.actualStartedAt,
      actualCompletedAt: existingBooking.actualCompletedAt,
      notes: payload.notes,
      createdAt: existingBooking.createdAt,
      createdByUid: existingBooking.createdByUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: nextVersion,
    };

    tx.updateBooking(cleanBookingId, updatedFields);

    const eventType =
      mode === 'reschedule' || scheduleChanged
        ? BOOKING_EVENT_TYPES.RESCHEDULED
        : BOOKING_EVENT_TYPES.EDITED;

    const eventNote = scheduleChanged
      ? `Jadwal dipindahkan dari ${existingBooking.date} (${formatMinuteRange(existingBooking.startMinute, existingBooking.endMinute, false)}, ${existingBooking.studioId.toUpperCase()}) ke ${payload.date} (${formatMinuteRange(payload.startMinute, payload.endMinute, false)}, ${payload.studioId.toUpperCase()})`
      : `Detail booking diperbarui untuk ${payload.customerName}`;

    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: {
        customerName: existingBooking.customerName,
        date: existingBooking.date,
        studioId: existingBooking.studioId,
        startMinute: existingBooking.startMinute,
        endMinute: existingBooking.endMinute,
        durationMinutes: existingBooking.durationMinutes,
        serviceLabel: existingBooking.serviceLabel,
      },
      newValue: {
        customerName: payload.customerName,
        date: payload.date,
        studioId: payload.studioId,
        startMinute: payload.startMinute,
        endMinute: payload.endMinute,
        durationMinutes: payload.durationMinutes,
        serviceLabel: payload.serviceLabel,
      },
      note: eventNote,
    });

    return normalizeBookingRecord(cleanBookingId, updatedFields);
  });
}

/**
 * Cancels a booking atomically without deleting the booking record:
 * - Transitions `sessionStatus` to `cancelled`
 * - Releases all `bookingSlots` locks owned by the booking
 * - Appends an immutable `booking_cancelled` event
 */
export async function cancelBooking({
  bookingId,
  expectedVersion,
  eventId = generateOperationId('evt'),
  actorUid,
  reason = '',
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');

  if (!cleanBookingId) {
    throw createBookingServiceError('booking/not-found', 'ID booking wajib disertakan.');
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. READS FIRST
    const existingBooking = await tx.getBooking(cleanBookingId);
    const existingEvent = await tx.getEvent(cleanEventId);

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    if (existingEvent) {
      return existingBooking;
    }

    if (existingBooking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED) {
      return existingBooking;
    }

    if (existingBooking.sessionStatus === BOOKING_SESSION_STATUS.COMPLETED) {
      throw createBookingServiceError(
        'booking/invalid-transition',
        'Sesi yang sudah selesai (Completed) tidak dapat dibatalkan.',
      );
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data booking sudah berubah di sesi lain. Muat ulang sebelum membatalkan.',
      );
    }

    const oldSlots = buildBookingSlotRecords({
      bookingId: cleanBookingId,
      date: existingBooking.date,
      studioId: existingBooking.studioId,
      startMinute: existingBooking.startMinute,
      durationMinutes: existingBooking.durationMinutes,
    });

    const slotLocks = await Promise.all(oldSlots.map((slot) => tx.getSlot(slot.id)));

    // 2. WRITES AFTER READS
    const timestamp = tx.nowValue();

    oldSlots.forEach((slot, idx) => {
      const lock = slotLocks[idx];
      if (lock && lock.bookingId === cleanBookingId) {
        tx.deleteSlot(slot.id);
      }
    });

    const nextVersion = (Number(existingBooking.version) || 1) + 1;
    const updatedFields = {
      ...existingBooking,
      sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: nextVersion,
    };
    delete updatedFields.id;

    tx.updateBooking(cleanBookingId, updatedFields);

    const cleanReason = String(reason || '').trim();
    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType: BOOKING_EVENT_TYPES.CANCELLED,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: {
        sessionStatus: existingBooking.sessionStatus,
        date: existingBooking.date,
        studioId: existingBooking.studioId,
        startMinute: existingBooking.startMinute,
        endMinute: existingBooking.endMinute,
      },
      newValue: {
        sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
      },
      note: cleanReason
        ? `Booking dibatalkan: ${cleanReason}`
        : 'Booking dibatalkan dan slot jadwal telah dilepaskan.',
    });

    return normalizeBookingRecord(cleanBookingId, updatedFields);
  });
}

/**
 * Performs an atomic session lifecycle transition:
 * - `check_in`: records `checkedInAt` & `checkedInByUid` on an `upcoming` booking
 * - `start_session`: transitions `upcoming` -> `in_progress`, recording `actualStartedAt`
 * - `complete_session`: transitions `in_progress` -> `completed`, recording `actualCompletedAt`
 * - `mark_no_show`: transitions `upcoming` -> `no_show` ONLY after 15-min grace period without check-in, releasing slot locks
 * - `cancel_session`: delegates to atomic cancellation
 */
export async function transitionBookingSession({
  bookingId,
  action,
  expectedVersion,
  eventId = generateOperationId('evt'),
  actorUid,
  note = '',
  now = new Date(),
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');

  if (action === 'cancel_session') {
    return cancelBooking({
      bookingId: cleanBookingId,
      expectedVersion,
      eventId: cleanEventId,
      actorUid: cleanActorUid,
      reason: note,
      adapter,
    });
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. READS FIRST
    const existingBooking = await tx.getBooking(cleanBookingId);
    const existingEvent = await tx.getEvent(cleanEventId);

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    if (existingEvent) {
      return existingBooking;
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data booking sudah berubah di sesi lain. Muat ulang detail booking.',
      );
    }

    let oldSlots = [];
    let slotLocks = [];
    if (action === 'mark_no_show') {
      oldSlots = buildBookingSlotRecords({
        bookingId: cleanBookingId,
        date: existingBooking.date,
        studioId: existingBooking.studioId,
        startMinute: existingBooking.startMinute,
        durationMinutes: existingBooking.durationMinutes,
      });
      slotLocks = await Promise.all(oldSlots.map((slot) => tx.getSlot(slot.id)));
    }

    const currentStatus = existingBooking.sessionStatus;
    const timestamp = tx.nowValue();
    const nextVersion = (Number(existingBooking.version) || 1) + 1;
    const cleanNote = String(note || '').trim();

    let updatedFields = {
      ...existingBooking,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: nextVersion,
    };
    delete updatedFields.id;

    let eventType;
    let eventNote;
    let nextStatus = currentStatus;

    if (action === 'check_in') {
      if (currentStatus !== BOOKING_SESSION_STATUS.UPCOMING) {
        throw createBookingServiceError(
          'booking/invalid-transition',
          'Check-in hanya dapat dilakukan pada booking berstatus Upcoming.',
        );
      }
      if (existingBooking.checkedInAt) {
        return existingBooking;
      }

      updatedFields.checkedInAt = timestamp;
      updatedFields.checkedInByUid = cleanActorUid;
      eventType = BOOKING_EVENT_TYPES.CHECKED_IN;
      eventNote = cleanNote || `Customer ${existingBooking.customerName} telah check-in di studio.`;
    } else if (action === 'start_session') {
      if (currentStatus !== BOOKING_SESSION_STATUS.UPCOMING) {
        throw createBookingServiceError(
          'booking/invalid-transition',
          'Sesi hanya dapat dimulai dari status Upcoming.',
        );
      }

      nextStatus = BOOKING_SESSION_STATUS.IN_PROGRESS;
      updatedFields.sessionStatus = nextStatus;
      updatedFields.actualStartedAt = timestamp;
      if (!existingBooking.checkedInAt) {
        updatedFields.checkedInAt = timestamp;
        updatedFields.checkedInByUid = cleanActorUid;
      }
      eventType = BOOKING_EVENT_TYPES.STARTED;
      eventNote = cleanNote || 'Sesi studio dimulai.';
    } else if (action === 'complete_session') {
      if (currentStatus !== BOOKING_SESSION_STATUS.IN_PROGRESS) {
        throw createBookingServiceError(
          'booking/invalid-transition',
          'Sesi hanya dapat diselesaikan setelah status sesi berjalan (In Progress).',
        );
      }

      nextStatus = BOOKING_SESSION_STATUS.COMPLETED;
      updatedFields.sessionStatus = nextStatus;
      updatedFields.actualCompletedAt = timestamp;
      eventType = BOOKING_EVENT_TYPES.COMPLETED;
      eventNote = cleanNote || 'Sesi studio telah selesai.';
    } else if (action === 'mark_no_show') {
      if (currentStatus !== BOOKING_SESSION_STATUS.UPCOMING) {
        throw createBookingServiceError(
          'booking/invalid-transition',
          'No Show hanya dapat diterapkan pada booking berstatus Upcoming.',
        );
      }
      if (existingBooking.checkedInAt) {
        throw createBookingServiceError(
          'booking/no-show-not-eligible',
          'Customer sudah check-in sehingga tidak dapat ditandai No Show.',
        );
      }
      if (!isBookingNoShowEligible(existingBooking, now)) {
        throw createBookingServiceError(
          'booking/no-show-not-eligible',
          'No Show baru dapat dilakukan setelah waktu mulai melewati grace period 15 menit tanpa check-in.',
        );
      }

      // Release slot locks so the studio room can be used
      oldSlots.forEach((slot, idx) => {
        const lock = slotLocks[idx];
        if (lock && lock.bookingId === cleanBookingId) {
          tx.deleteSlot(slot.id);
        }
      });

      nextStatus = BOOKING_SESSION_STATUS.NO_SHOW;
      updatedFields.sessionStatus = nextStatus;
      eventType = BOOKING_EVENT_TYPES.NO_SHOW;
      eventNote = cleanNote
        ? `Customer ditandai No Show: ${cleanNote}`
        : 'Customer tidak hadir melewati grace period 15 menit (No Show).';
    } else {
      throw createBookingServiceError(
        'booking/unknown-action',
        `Aksi lifecycle "${action}" tidak dikenali.`,
      );
    }

    // 2. WRITES AFTER READS
    tx.updateBooking(cleanBookingId, updatedFields);
    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: {
        sessionStatus: currentStatus,
        checkedInAt: Boolean(existingBooking.checkedInAt),
      },
      newValue: {
        sessionStatus: nextStatus,
        checkedInAt: Boolean(updatedFields.checkedInAt),
      },
      note: eventNote,
    });

    return normalizeBookingRecord(cleanBookingId, updatedFields);
  });
}

/**
 * In-memory transactional repository adapter for deterministic automated testing
 * of concurrency, slot locks, atomic rollback, stale updates, and realtime subscriptions.
 */
export function createInMemoryBookingRepositoryAdapter(initialBookings = []) {
  const bookings = new Map();
  const slots = new Map();
  const events = new Map();
  const rangeSubscribers = new Set();
  const eventSubscribers = new Map();
  let transactionQueue = Promise.resolve();

  function notifyRangeSubscribers() {
    for (const sub of rangeSubscribers) {
      const matching = Array.from(bookings.values())
        .filter((b) => b.date >= sub.startDate && b.date <= sub.endDate)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
          return a.studioId.localeCompare(b.studioId);
        });

      const limited = matching.slice(0, sub.maxLimit);
      sub.onData?.({
        bookings: limited.map((b) => ({ ...b })),
        isTruncated: matching.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }
  }

  function notifyEventSubscribers(bookingId) {
    const subs = eventSubscribers.get(bookingId);
    if (!subs) return;
    const matching = Array.from(events.values())
      .filter((e) => e.bookingId === bookingId)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    for (const cb of subs) {
      cb(matching.map((e) => ({ ...e })));
    }
  }

  // Seed initial bookings and their slot locks if provided
  for (const seed of initialBookings) {
    const normalized = normalizeBookingRecord(seed.id || generateOperationId('bkg'), seed);
    bookings.set(normalized.id, normalized);
    if (
      normalized.sessionStatus !== BOOKING_SESSION_STATUS.CANCELLED &&
      normalized.sessionStatus !== BOOKING_SESSION_STATUS.NO_SHOW
    ) {
      const seedSlots = buildBookingSlotRecords({
        bookingId: normalized.id,
        date: normalized.date,
        studioId: normalized.studioId,
        startMinute: normalized.startMinute,
        durationMinutes: normalized.durationMinutes,
      });
      for (const s of seedSlots) {
        slots.set(s.id, {
          id: s.id,
          bookingId: normalized.id,
          date: s.date,
          studioId: s.studioId,
          slotStartMinute: s.slotStartMinute,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        });
      }
    }
  }

  return {
    _inspectState() {
      return {
        bookings: new Map(bookings),
        slots: new Map(slots),
        events: new Map(events),
      };
    },

    runAtomicTransaction(transactionWork) {
      const runNext = transactionQueue.then(async () => {
        // Work on staged copies so any thrown error leaves the store untouched (atomic rollback)
        const stagedBookings = new Map(bookings);
        const stagedSlots = new Map(slots);
        const stagedEvents = new Map(events);
        const touchedBookingIds = new Set();
        let writeStarted = false;

        const txContext = {
          nowValue: () => ({ seconds: Math.floor(Date.now() / 1000) }),
          async getBooking(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedBookings.get(id);
            return item ? { ...item } : null;
          },
          async getSlot(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedSlots.get(id);
            return item ? { ...item } : null;
          },
          async getEvent(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedEvents.get(id);
            return item ? { ...item } : null;
          },
          setBooking(id, data) {
            writeStarted = true;
            touchedBookingIds.add(id);
            stagedBookings.set(id, normalizeBookingRecord(id, data));
          },
          updateBooking(id, data) {
            writeStarted = true;
            touchedBookingIds.add(id);
            const prev = stagedBookings.get(id) || {};
            stagedBookings.set(id, normalizeBookingRecord(id, { ...prev, ...data }));
          },
          setSlot(id, data) {
            writeStarted = true;
            stagedSlots.set(id, { id, ...data });
          },
          deleteSlot(id) {
            writeStarted = true;
            stagedSlots.delete(id);
          },
          setEvent(id, data) {
            writeStarted = true;
            touchedBookingIds.add(data.bookingId);
            stagedEvents.set(id, normalizeBookingEventRecord(id, data));
          },
        };

        const result = await transactionWork(txContext);

        // Commit staged changes atomically
        bookings.clear();
        for (const [k, v] of stagedBookings) bookings.set(k, v);
        slots.clear();
        for (const [k, v] of stagedSlots) slots.set(k, v);
        events.clear();
        for (const [k, v] of stagedEvents) events.set(k, v);

        notifyRangeSubscribers();
        for (const bId of touchedBookingIds) {
          notifyEventSubscribers(bId);
        }

        return result;
      });

      // Keep queue alive even when a transaction rejects
      transactionQueue = runNext.catch(() => {});
      return runNext;
    },

    subscribeBookingsInRange({
      startDate,
      endDate,
      maxLimit = CALENDAR_BOOKINGS_QUERY_LIMIT,
      onData,
    }) {
      const sub = { startDate, endDate, maxLimit, onData };
      rangeSubscribers.add(sub);
      notifyRangeSubscribers();
      return () => {
        rangeSubscribers.delete(sub);
      };
    },

    subscribeBookingEvents({ bookingId, onData }) {
      if (!bookingId) {
        onData?.([]);
        return () => {};
      }
      if (!eventSubscribers.has(bookingId)) {
        eventSubscribers.set(bookingId, new Set());
      }
      const set = eventSubscribers.get(bookingId);
      set.add(onData);
      notifyEventSubscribers(bookingId);
      return () => {
        set.delete(onData);
      };
    },
  };
}
