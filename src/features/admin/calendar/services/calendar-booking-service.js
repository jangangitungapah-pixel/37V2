import {
  normalizeCustomerRecord,
  normalizePhoneIndexRecord,
} from '@/features/admin/customer/schemas/customer-schema';
import {
  appendUniqueNameAlias,
  CUSTOMER_RESOLUTION_MODE,
  CUSTOMER_STATUS,
  IDENTITY_MATCH_STATUS,
  normalizeCustomerName,
  resolveCustomerIdentityCandidates,
} from '@/features/admin/customer/utils/customer-identity';
import {
  formatPhoneDisplay,
  getPhoneNumberHash,
} from '@/features/admin/customer/utils/phone-number';
import {
  buildInvoiceDocumentFromBooking,
  normalizeInvoiceRecord,
  normalizePaymentTransactionRecord,
} from '@/features/admin/payment/schemas/payment-schema';
import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';
import {
  buildInitialPaymentId,
  buildInvoiceId,
} from '@/features/admin/payment/utils/invoice-number';
import {
  PAYMENT_SOURCE,
  SUPPORTED_PAYMENT_METHODS,
  TRANSACTION_TYPE,
} from '@/features/admin/payment/utils/invoice-status';
import {
  DEFAULT_PRICING_SETTINGS,
  DELIVERY_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';

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
  customerResolution = null,
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim() || generateOperationId('bkg');
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');

  const validation = validateBookingFormPayload(formValues, [], '', pricingSettings);
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
  if (payload.deliveryMode !== DELIVERY_MODES.STUDIO) {
    throw createBookingServiceError(
      'booking/wfa-not-allowed',
      'Layanan WFA (Mixing / Mastering) tidak boleh membuat booking atau mengunci slot ruangan studio.',
    );
  }

  if (!payload.phoneNormalized) {
    throw createBookingServiceError(
      'booking/invalid-phone',
      'Nomor HP / WhatsApp tidak valid untuk pencatatan profil customer.',
    );
  }

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

  const phoneHash = await getPhoneNumberHash(payload.phoneNormalized);
  // Pre-generate a stable Customer ID before starting the transaction so retries remain idempotent
  const preGeneratedCustomerId =
    String(customerResolution?.customerId || '').trim() || generateOperationId('cust');
  const deterministicInvoiceId = buildInvoiceId(cleanBookingId);
  const deterministicInitialPaymentId = buildInitialPaymentId(cleanBookingId);

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST (Booking, Event, PhoneIndex, Invoice, Initial Payment, and Slots)
    const [
      existingBooking,
      existingEvent,
      existingPhoneIndex,
      existingInvoice,
      existingInitialPayment,
      ...slotSnapshots
    ] = await Promise.all([
      tx.getBooking(cleanBookingId),
      tx.getEvent(cleanEventId),
      tx.getPhoneIndex(phoneHash),
      tx.getInvoice(deterministicInvoiceId),
      tx.getPaymentTransaction(deterministicInitialPaymentId),
      ...requiredSlots.map((slot) => tx.getSlot(slot.id)),
    ]);

    // Idempotent retry: if this exact bookingId + eventId was already committed, return it
    // without touching customer bookingCount, aliases, phone index, invoice, or initial payment twice
    if (existingBooking && existingEvent) {
      return existingBooking;
    }

    if (existingBooking && existingBooking.createdByUid !== cleanActorUid) {
      throw createBookingServiceError(
        'booking/duplicate-id',
        'ID operasi booking sudah digunakan.',
      );
    }

    if (existingInvoice && existingInvoice.bookingId !== cleanBookingId) {
      throw createBookingServiceError(
        'booking/duplicate-invoice',
        'ID invoice untuk booking ini sudah digunakan oleh transaksi lain.',
      );
    }

    // Read all candidate customer profiles referenced by the phone index + explicit resolution target
    const candidateCustomerIds = Array.from(
      new Set([
        ...(existingPhoneIndex?.activeCustomerIds || []),
        ...(existingPhoneIndex?.historicalCustomerIds || []),
        ...(customerResolution?.customerId ? [customerResolution.customerId] : []),
      ]),
    );
    const loadedCandidates =
      candidateCustomerIds.length > 0
        ? await Promise.all(candidateCustomerIds.map((id) => tx.getCustomer(id)))
        : [];
    const profilesById = new Map(
      loadedCandidates.filter(Boolean).map((profile) => [profile.id, profile]),
    );

    // Check slot locks BEFORE customer resolution errors so slot conflicts always rollback cleanly
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

    // Resolve and validate customer identity against current transactional Phone Index state
    const currentIndexVersion = Number(existingPhoneIndex?.version) || 0;
    if (
      customerResolution &&
      Number.isInteger(Number(customerResolution.expectedPhoneIndexVersion)) &&
      currentIndexVersion !== Number(customerResolution.expectedPhoneIndexVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-customer-identity',
        'Data profil customer untuk nomor HP ini baru saja berubah. Muat ulang pilihan customer lalu coba simpan kembali.',
      );
    }

    const identityResolution = resolveCustomerIdentityCandidates({
      inputName: payload.customerName,
      phoneNormalized: payload.phoneNormalized,
      phoneIndex: existingPhoneIndex,
      profilesById,
    });

    let effectiveMode = customerResolution?.mode || '';
    let resolvedCustomerId = preGeneratedCustomerId;
    let targetExistingProfile = null;

    if (!effectiveMode) {
      if (
        identityResolution.status === IDENTITY_MATCH_STATUS.NO_MATCH ||
        identityResolution.status === IDENTITY_MATCH_STATUS.HISTORICAL_ONLY
      ) {
        effectiveMode = CUSTOMER_RESOLUTION_MODE.CREATE_NEW;
      } else if (
        identityResolution.status === IDENTITY_MATCH_STATUS.EXACT_MATCH &&
        identityResolution.matchedProfile
      ) {
        effectiveMode = CUSTOMER_RESOLUTION_MODE.REUSE_EXISTING;
        resolvedCustomerId = identityResolution.matchedProfile.id;
        targetExistingProfile = identityResolution.matchedProfile;
      } else {
        throw createBookingServiceError(
          'booking/customer-identity-conflict',
          'Nomor telepon sudah digunakan oleh profil customer lain. Pilih gabungkan riwayat atau buat profil terpisah terlebih dahulu.',
          {
            status: identityResolution.status,
            activeProfiles: identityResolution.activeProfiles,
          },
        );
      }
    } else if (
      effectiveMode === CUSTOMER_RESOLUTION_MODE.REUSE_EXISTING ||
      effectiveMode === CUSTOMER_RESOLUTION_MODE.MERGE_INTO_EXISTING
    ) {
      const targetId = String(customerResolution?.customerId || '').trim();
      const targetProfile = profilesById.get(targetId) || null;
      if (!targetProfile || targetProfile.status !== CUSTOMER_STATUS.ACTIVE) {
        throw createBookingServiceError(
          'booking/stale-customer-identity',
          'Profil customer yang dipilih tidak aktif atau sudah berubah. Silakan muat ulang pilihan customer.',
        );
      }
      if (targetProfile.phoneNormalized !== payload.phoneNormalized) {
        throw createBookingServiceError(
          'booking/stale-customer-identity',
          'Nomor telepon pada profil customer yang dipilih sudah tidak cocok. Silakan periksa kembali nomor HP.',
        );
      }
      resolvedCustomerId = targetProfile.id;
      targetExistingProfile = targetProfile;
    } else if (effectiveMode === CUSTOMER_RESOLUTION_MODE.CREATE_NEW) {
      if (identityResolution.activeProfiles.length > 0) {
        throw createBookingServiceError(
          'booking/stale-customer-identity',
          'Nomor telepon baru saja terdaftar pada profil lain. Muat ulang pencarian customer untuk menentukan pilihan profil.',
        );
      }
    } else if (effectiveMode !== CUSTOMER_RESOLUTION_MODE.CREATE_SEPARATE) {
      throw createBookingServiceError(
        'booking/invalid-customer-resolution',
        'Mode resolusi identitas customer tidak valid.',
      );
    }

    // 2. ALL WRITES AFTER ALL READS
    const timestamp = tx.nowValue();

    if (targetExistingProfile) {
      const nextAliases =
        effectiveMode === CUSTOMER_RESOLUTION_MODE.MERGE_INTO_EXISTING
          ? appendUniqueNameAlias(
              targetExistingProfile.displayName,
              targetExistingProfile.nameAliases,
              payload.customerName,
            )
          : targetExistingProfile.nameAliases;

      const firstDate =
        [targetExistingProfile.firstBookingDate, payload.date].filter(Boolean).sort()[0] ||
        payload.date;
      const lastDates = [targetExistingProfile.lastBookingDate, payload.date]
        .filter(Boolean)
        .sort();
      const lastDate = lastDates[lastDates.length - 1] || payload.date;

      tx.updateCustomer(resolvedCustomerId, {
        displayName: targetExistingProfile.displayName,
        normalizedName:
          targetExistingProfile.normalizedName ||
          normalizeCustomerName(targetExistingProfile.displayName),
        phoneDisplay: targetExistingProfile.phoneDisplay,
        phoneNormalized: targetExistingProfile.phoneNormalized,
        nameAliases: nextAliases,
        previousPhones: targetExistingProfile.previousPhones,
        status: CUSTOMER_STATUS.ACTIVE,
        mergedIntoCustomerId: null,
        historyCustomerIds: Array.from(
          new Set([resolvedCustomerId, ...(targetExistingProfile.historyCustomerIds || [])]),
        ),
        bookingCount: (Number(targetExistingProfile.bookingCount) || 0) + 1,
        firstBookingDate: firstDate,
        lastBookingDate: lastDate,
        notes: targetExistingProfile.notes,
        createdAt: targetExistingProfile.createdAt,
        createdByUid: targetExistingProfile.createdByUid,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(targetExistingProfile.version) || 1) + 1,
      });

      // Ensure active index contains resolvedCustomerId
      if (!(existingPhoneIndex?.activeCustomerIds || []).includes(resolvedCustomerId)) {
        tx.setPhoneIndex(phoneHash, {
          phoneNormalized: payload.phoneNormalized,
          activeCustomerIds: Array.from(
            new Set([...(existingPhoneIndex?.activeCustomerIds || []), resolvedCustomerId]),
          ),
          historicalCustomerIds: (existingPhoneIndex?.historicalCustomerIds || []).filter(
            (id) => id !== resolvedCustomerId,
          ),
          version: currentIndexVersion + 1,
          updatedAt: timestamp,
          updatedByUid: cleanActorUid,
        });
      }
    } else {
      // Create new Customer Profile (either fresh number or intentional Create Separate on shared number)
      tx.setCustomer(resolvedCustomerId, {
        displayName: payload.customerName,
        normalizedName: normalizeCustomerName(payload.customerName),
        phoneDisplay: formatPhoneDisplay(payload.phoneNormalized),
        phoneNormalized: payload.phoneNormalized,
        nameAliases: [],
        previousPhones: [],
        status: CUSTOMER_STATUS.ACTIVE,
        mergedIntoCustomerId: null,
        historyCustomerIds: [resolvedCustomerId],
        bookingCount: 1,
        firstBookingDate: payload.date,
        lastBookingDate: payload.date,
        notes: '',
        createdAt: timestamp,
        createdByUid: cleanActorUid,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: 1,
      });

      tx.setPhoneIndex(phoneHash, {
        phoneNormalized: payload.phoneNormalized,
        activeCustomerIds: Array.from(
          new Set([...(existingPhoneIndex?.activeCustomerIds || []), resolvedCustomerId]),
        ),
        historicalCustomerIds: (existingPhoneIndex?.historicalCustomerIds || []).filter(
          (id) => id !== resolvedCustomerId,
        ),
        version: currentIndexVersion + 1,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
      });
    }

    const bookingDoc = {
      customerId: resolvedCustomerId,
      customerName: payload.customerName,
      phone: payload.phone,
      phoneNormalized: payload.phoneNormalized,
      bandName: payload.bandName,
      studioId: payload.studioId,
      serviceTypeId: payload.serviceTypeId,
      serviceTypeName: payload.serviceTypeName,
      serviceOptionId: payload.serviceOptionId,
      serviceOptionName: payload.serviceOptionName,
      deliveryMode: payload.deliveryMode,
      pricingMode: payload.pricingMode,
      pricingSettingsVersion: payload.pricingSettingsVersion,
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
      automaticDiscount: payload.automaticDiscount ?? null,
      commissionSnapshot: payload.commissionSnapshot,
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

    // 3. Automatic Invoice & Optional Initial Payment Transaction (Phase 8 — atomic with booking)
    const initialPaidInt = Math.max(0, Math.round(Number(payload.initialPaidAmount) || 0));
    const hasInitialPayment = initialPaidInt > 0;
    const { invoiceId, invoiceNumber, invoiceDoc } = buildInvoiceDocumentFromBooking({
      bookingId: cleanBookingId,
      booking: bookingDoc,
      customerId: resolvedCustomerId,
      actorUid: cleanActorUid,
      timestamp,
      invoiceDate: timestamp,
      dueDate: null,
      initialPaymentTransactionId: hasInitialPayment ? deterministicInitialPaymentId : null,
      initialPaidAmount: initialPaidInt,
    });

    if (!existingInvoice) {
      tx.setInvoice(invoiceId, invoiceDoc);
    }

    if (hasInitialPayment && !existingInitialPayment) {
      const normalizedPaymentMethod = SUPPORTED_PAYMENT_METHODS.includes(payload.paymentMethod)
        ? payload.paymentMethod
        : 'cash';

      tx.setPaymentTransaction(deterministicInitialPaymentId, {
        invoiceId,
        invoiceNumber,
        bookingId: cleanBookingId,
        customerId: resolvedCustomerId,
        transactionType: TRANSACTION_TYPE.PAYMENT,
        amount: initialPaidInt,
        currency: 'IDR',
        paymentMethod: normalizedPaymentMethod,
        receivedAt: timestamp,
        referenceNumber: '',
        notes:
          initialPaidInt >= invoiceDoc.financialSnapshot.totalAmount
            ? 'Pembayaran lunas saat pembuatan booking'
            : 'Pembayaran DP awal saat pembuatan booking',
        source: PAYMENT_SOURCE.BOOKING_INITIAL_PAYMENT,
        reversalOfTransactionId: null,
        recordedByUid: cleanActorUid,
        createdAt: timestamp,
      });
    }

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
  pricingSettings = DEFAULT_PRICING_SETTINGS,
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

    const historicalOptionId =
      existingBooking.serviceOptionId ||
      existingBooking.packageId ||
      existingBooking.recordingTypeId ||
      '';

    const validation = validateBookingFormPayload(
      mergedFormValues,
      [],
      cleanBookingId,
      pricingSettings,
      {
        allowedHistoricalServiceIds: [
          existingBooking.serviceId,
          existingBooking.serviceTypeId,
        ].filter(Boolean),
        allowedHistoricalOptionIds: [historicalOptionId].filter(Boolean),
        skipManualQuoteValidation: !formValues?.applyUpdatedPricing,
        paymentTotalOverride: formValues?.applyUpdatedPricing
          ? undefined
          : existingBooking.totalAmount,
      },
    );
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

    const existingEffectiveOptionId =
      existingBooking.serviceOptionId ||
      existingBooking.packageId ||
      existingBooking.recordingTypeId ||
      '';
    const nextEffectiveOptionId =
      payload.serviceOptionId || payload.packageId || payload.recordingTypeId || '';

    const isServiceScopeChanged =
      existingBooking.serviceId !== payload.serviceId ||
      existingBooking.packageId !== payload.packageId ||
      existingBooking.recordingTypeId !== payload.recordingTypeId ||
      (Boolean(existingBooking.serviceOptionId) &&
        existingEffectiveOptionId !== nextEffectiveOptionId) ||
      existingBooking.durationMinutes !== payload.durationMinutes;

    const shouldApplyNewSnapshot =
      isServiceScopeChanged && Boolean(formValues?.applyUpdatedPricing);

    const nextVersion = (Number(existingBooking.version) || 1) + 1;

    // Preserve immutable initial payment snapshot fields AND historical price/commission/option snapshots
    // unless service/subcategory/duration changed and user explicitly confirmed applying current pricing.
    const preservedV2ServiceFields = shouldApplyNewSnapshot
      ? {
          serviceTypeId: payload.serviceTypeId,
          serviceTypeName: payload.serviceTypeName,
          serviceOptionId: payload.serviceOptionId,
          serviceOptionName: payload.serviceOptionName,
          deliveryMode: payload.deliveryMode,
          pricingMode: payload.pricingMode,
          pricingSettingsVersion: payload.pricingSettingsVersion,
        }
      : existingBooking.serviceTypeId
        ? {
            serviceTypeId: existingBooking.serviceTypeId,
            serviceTypeName: existingBooking.serviceTypeName,
            serviceOptionId: existingBooking.serviceOptionId,
            serviceOptionName: existingBooking.serviceOptionName,
            deliveryMode: existingBooking.deliveryMode,
            pricingMode: existingBooking.pricingMode,
            pricingSettingsVersion: existingBooking.pricingSettingsVersion,
          }
        : {};

    const preservedCustomerLinkFields = {};
    if (existingBooking.customerId) {
      preservedCustomerLinkFields.customerId = existingBooking.customerId;
    }
    if (existingBooking.phoneNormalized) {
      preservedCustomerLinkFields.phoneNormalized = existingBooking.phoneNormalized;
    }

    const updatedFields = {
      ...preservedCustomerLinkFields,
      customerName: payload.customerName,
      phone: payload.phone,
      bandName: payload.bandName,
      studioId: payload.studioId,
      ...preservedV2ServiceFields,
      serviceId: shouldApplyNewSnapshot ? payload.serviceId : existingBooking.serviceId,
      serviceLabel: shouldApplyNewSnapshot ? payload.serviceLabel : existingBooking.serviceLabel,
      packageId: shouldApplyNewSnapshot ? payload.packageId : existingBooking.packageId,
      packageLabel: shouldApplyNewSnapshot ? payload.packageLabel : existingBooking.packageLabel,
      recordingTypeId: shouldApplyNewSnapshot
        ? payload.recordingTypeId
        : existingBooking.recordingTypeId,
      recordingTypeLabel: shouldApplyNewSnapshot
        ? payload.recordingTypeLabel
        : existingBooking.recordingTypeLabel,
      date: payload.date,
      startMinute: payload.startMinute,
      durationMinutes: payload.durationMinutes,
      endMinute: payload.endMinute,
      timeZone: STUDIO_TIME_ZONE,
      unitRate: shouldApplyNewSnapshot ? payload.unitRate : existingBooking.unitRate,
      subtotal: shouldApplyNewSnapshot ? payload.subtotal : existingBooking.subtotal,
      discountAmount: shouldApplyNewSnapshot
        ? payload.discountAmount
        : existingBooking.discountAmount,
      totalAmount: shouldApplyNewSnapshot ? payload.totalAmount : existingBooking.totalAmount,
      automaticDiscount: shouldApplyNewSnapshot
        ? (payload.automaticDiscount ?? null)
        : (existingBooking.automaticDiscount ?? null),
      commissionSnapshot: shouldApplyNewSnapshot
        ? payload.commissionSnapshot
        : (existingBooking.commissionSnapshot ?? null),
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
export function createInMemoryBookingRepositoryAdapter(
  initialBookings = [],
  initialCustomers = [],
  initialPhoneIndex = [],
  initialInvoices = [],
  initialPaymentTransactions = [],
) {
  const bookings = new Map();
  const slots = new Map();
  const events = new Map();
  const customers = new Map();
  const phoneIndex = new Map();
  const invoices = new Map();
  const paymentTransactions = new Map();
  const rangeSubscribers = new Set();
  const eventSubscribers = new Map();
  const customerSubscribers = new Set();
  const invoiceSubscribers = new Set();
  const invoiceDocSubscribers = new Map();
  const invoiceRangeSubscribers = new Set();
  const transactionSubscribers = new Set();
  const invoiceTransactionSubscribers = new Map();
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

  function notifyCustomerSubscribers() {
    const sorted = Array.from(customers.values()).sort(
      (a, b) => getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt),
    );
    for (const sub of customerSubscribers) {
      const limited = sorted.slice(0, sub.maxLimit);
      sub.onData?.({
        customers: limited.map((c) => ({ ...c })),
        hasMore: sorted.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }
  }

  function notifyInvoiceSubscribers() {
    const sorted = Array.from(invoices.values()).sort((a, b) => {
      const diff = getTimestampMillis(b.invoiceDate) - getTimestampMillis(a.invoiceDate);
      if (diff !== 0) return diff;
      return String(b.invoiceNumber || '').localeCompare(String(a.invoiceNumber || ''));
    });

    for (const sub of invoiceSubscribers) {
      const limited = sorted.slice(0, sub.maxLimit);
      sub.onData?.({
        invoices: limited.map((inv) => normalizeInvoiceRecord(inv.id, inv)),
        hasMore: sorted.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    for (const [invoiceId, listeners] of invoiceDocSubscribers.entries()) {
      const target = invoices.get(invoiceId);
      const normalized = target ? normalizeInvoiceRecord(invoiceId, target) : null;
      for (const cb of listeners) {
        cb(normalized);
      }
    }

    for (const sub of invoiceRangeSubscribers) {
      const matching = Array.from(invoices.values())
        .filter((inv) => {
          const d = inv.bookingSnapshot?.bookingDate || '';
          return d >= sub.startDate && d <= sub.endDate;
        })
        .sort((a, b) =>
          String(a.bookingSnapshot?.bookingDate || '').localeCompare(
            String(b.bookingSnapshot?.bookingDate || ''),
          ),
        );
      const limited = matching.slice(0, sub.maxLimit);
      sub.onData?.({
        invoices: limited.map((inv) => normalizeInvoiceRecord(inv.id, inv)),
        isTruncated: matching.length > sub.maxLimit,
      });
    }
  }

  function notifyTransactionSubscribers() {
    const sorted = Array.from(paymentTransactions.values()).sort((a, b) => {
      const diff =
        getTimestampMillis(b.receivedAt || b.createdAt) -
        getTimestampMillis(a.receivedAt || a.createdAt);
      if (diff !== 0) return diff;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    for (const sub of transactionSubscribers) {
      const limited = sorted.slice(0, sub.maxLimit);
      sub.onData?.({
        transactions: limited.map((tx) => normalizePaymentTransactionRecord(tx.id, tx)),
        hasMore: sorted.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    for (const [invoiceId, listeners] of invoiceTransactionSubscribers.entries()) {
      const matching = sorted
        .filter((tx) => tx.invoiceId === invoiceId)
        .map((tx) => normalizePaymentTransactionRecord(tx.id, tx));
      for (const cb of listeners) {
        cb(matching);
      }
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

  // Seed initial customers & phone index if provided
  for (const seedCust of initialCustomers) {
    const normCust = normalizeCustomerRecord(seedCust.id || generateOperationId('cust'), seedCust);
    customers.set(normCust.id, normCust);
  }
  for (const seedIdx of initialPhoneIndex) {
    const normIdx = normalizePhoneIndexRecord(seedIdx.phoneHash || seedIdx.id, seedIdx);
    if (normIdx.phoneHash) {
      phoneIndex.set(normIdx.phoneHash, normIdx);
    }
  }
  for (const seedInv of initialInvoices) {
    const normInv = normalizeInvoiceRecord(
      seedInv.id || buildInvoiceId(seedInv.bookingId),
      seedInv,
    );
    if (normInv.id) {
      invoices.set(normInv.id, normInv);
    }
  }
  for (const seedTx of initialPaymentTransactions) {
    const normTx = normalizePaymentTransactionRecord(
      seedTx.id || generateOperationId('pay'),
      seedTx,
    );
    if (normTx.id) {
      paymentTransactions.set(normTx.id, normTx);
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

  function enqueueTransaction(work) {
    const runNext = transactionQueue.then(work);
    transactionQueue = runNext.catch(() => {});
    return runNext;
  }

  return {
    _sharedStore: {
      bookings,
      slots,
      events,
      customers,
      phoneIndex,
      invoices,
      paymentTransactions,
      customerSubscribers,
      invoiceSubscribers,
      invoiceDocSubscribers,
      invoiceRangeSubscribers,
      transactionSubscribers,
      invoiceTransactionSubscribers,
      enqueueTransaction,
      notifyBookings: notifyRangeSubscribers,
      notifyCustomers: notifyCustomerSubscribers,
      notifyInvoices: notifyInvoiceSubscribers,
      notifyTransactions: notifyTransactionSubscribers,
    },

    _inspectState() {
      return {
        bookings: new Map(bookings),
        slots: new Map(slots),
        events: new Map(events),
        customers: new Map(customers),
        phoneIndex: new Map(phoneIndex),
        invoices: new Map(invoices),
        paymentTransactions: new Map(paymentTransactions),
      };
    },

    runAtomicTransaction(transactionWork) {
      return enqueueTransaction(async () => {
        // Work on staged copies so any thrown error leaves the store untouched (atomic rollback)
        const stagedBookings = new Map(bookings);
        const stagedSlots = new Map(slots);
        const stagedEvents = new Map(events);
        const stagedCustomers = new Map(customers);
        const stagedPhoneIndex = new Map(phoneIndex);
        const stagedInvoices = new Map(invoices);
        const stagedPaymentTransactions = new Map(paymentTransactions);
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
          async getCustomer(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedCustomers.get(id);
            return item ? normalizeCustomerRecord(id, item) : null;
          },
          async getPhoneIndex(hash) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedPhoneIndex.get(hash);
            return item ? normalizePhoneIndexRecord(hash, item) : null;
          },
          async getInvoice(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedInvoices.get(id);
            return item ? normalizeInvoiceRecord(id, item) : null;
          },
          async getPaymentTransaction(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedPaymentTransactions.get(id);
            return item ? normalizePaymentTransactionRecord(id, item) : null;
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
          setCustomer(id, data) {
            writeStarted = true;
            stagedCustomers.set(id, normalizeCustomerRecord(id, data));
          },
          updateCustomer(id, data) {
            writeStarted = true;
            const prev = stagedCustomers.get(id) || {};
            stagedCustomers.set(id, normalizeCustomerRecord(id, { ...prev, ...data }));
          },
          setPhoneIndex(hash, data) {
            writeStarted = true;
            stagedPhoneIndex.set(hash, normalizePhoneIndexRecord(hash, data));
          },
          setInvoice(id, data) {
            writeStarted = true;
            stagedInvoices.set(id, normalizeInvoiceRecord(id, data));
          },
          updateInvoice(id, data) {
            writeStarted = true;
            const prev = stagedInvoices.get(id) || {};
            stagedInvoices.set(id, normalizeInvoiceRecord(id, { ...prev, ...data }));
          },
          setPaymentTransaction(id, data) {
            writeStarted = true;
            stagedPaymentTransactions.set(id, normalizePaymentTransactionRecord(id, data));
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
        customers.clear();
        for (const [k, v] of stagedCustomers) customers.set(k, v);
        phoneIndex.clear();
        for (const [k, v] of stagedPhoneIndex) phoneIndex.set(k, v);
        invoices.clear();
        for (const [k, v] of stagedInvoices) invoices.set(k, v);
        paymentTransactions.clear();
        for (const [k, v] of stagedPaymentTransactions) paymentTransactions.set(k, v);

        notifyRangeSubscribers();
        notifyCustomerSubscribers();
        notifyInvoiceSubscribers();
        notifyTransactionSubscribers();
        for (const bId of touchedBookingIds) {
          notifyEventSubscribers(bId);
        }

        return result;
      });
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
