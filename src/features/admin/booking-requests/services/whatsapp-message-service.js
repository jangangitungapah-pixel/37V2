import { normalizePhoneNumber } from '@/features/admin/customer/utils/phone-number';

import { BOOKING_REQUEST_COMMUNICATION_TYPES } from '../config/booking-request-config';
import {
  ALLOWLISTED_TEMPLATE_VARIABLES,
  DEFAULT_WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_CATEGORIES,
} from '../config/default-whatsapp-templates';
import {
  createBookingRequestRepositoryError,
  getBookingRequestRepositoryAdapter,
} from '../repositories/booking-request-repository';
import { getWhatsAppTemplateRepositoryAdapter } from '../repositories/whatsapp-template-repository';
import { generateActivityId } from './booking-request-service';

const ALLOWLIST_SET = new Set(ALLOWLISTED_TEMPLATE_VARIABLES);
const VALID_CATEGORIES = new Set(Object.values(WHATSAPP_TEMPLATE_CATEGORIES));
const EXTRACT_VARS_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

/**
 * Constructs a WhatsApp Click-to-Chat URL (`https://wa.me/<digits>?text=<encoded>`)
 * from a customer phone number using existing `normalizePhoneNumber()`.
 * Rejects invalid numbers strictly before building any link.
 */
export function buildWhatsAppClickToChatUrl({ phone, message = '' } = {}) {
  const normalizedPhone = normalizePhoneNumber(phone, { assumeIndonesiaLocalMobile: true });
  if (!normalizedPhone) {
    return {
      isValid: false,
      normalizedPhone: '',
      waDigits: '',
      url: '',
      error: 'Nomor WhatsApp pelanggan tidak valid atau terlalu pendek.',
    };
  }

  const waDigits = normalizedPhone.replace(/\D/g, '');
  if (waDigits.length < 8 || waDigits.length > 15) {
    return {
      isValid: false,
      normalizedPhone,
      waDigits: '',
      url: '',
      error: 'Nomor WhatsApp harus terdiri dari 8–15 digit angka internasional.',
    };
  }

  const encodedMessage = encodeURIComponent(String(message || ''));
  return {
    isValid: true,
    normalizedPhone,
    waDigits,
    url: `https://wa.me/${waDigits}?text=${encodedMessage}`,
    error: '',
  };
}

function assertOwnerActor(actorUid, actorRole) {
  const cleanRole = String(actorRole || '')
    .trim()
    .toLowerCase();
  if (!actorUid || cleanRole !== 'owner') {
    throw createBookingRequestRepositoryError(
      'booking-request/template-forbidden',
      'Akses ditolak: hanya akun Owner yang aktif yang dapat mengelola template WhatsApp.',
    );
  }
}

export async function saveWhatsAppTemplate({ actorUid, actorRole, templateInput, adapter = null }) {
  assertOwnerActor(actorUid, actorRole);

  const label = String(templateInput?.label || '').trim();
  const body = String(templateInput?.body || '').trim();
  const description = String(templateInput?.description || '').trim();
  const category = VALID_CATEGORIES.has(templateInput?.category)
    ? templateInput.category
    : WHATSAPP_TEMPLATE_CATEGORIES.FOLLOW_UP;

  if (label.length < 2 || label.length > 80) {
    throw createBookingRequestRepositoryError(
      'booking-request/template-invalid',
      'Nama template wajib 2–80 karakter.',
    );
  }
  if (body.length < 5 || body.length > 1500) {
    throw createBookingRequestRepositoryError(
      'booking-request/template-invalid',
      'Isi pesan template wajib 5–1500 karakter.',
    );
  }

  const extractedVars = [];
  const unknownVars = [];
  for (const match of body.matchAll(EXTRACT_VARS_PATTERN)) {
    const varName = match[1];
    if (!ALLOWLIST_SET.has(varName)) {
      unknownVars.push(varName);
    } else if (!extractedVars.includes(varName)) {
      extractedVars.push(varName);
    }
  }

  if (unknownVars.length > 0) {
    throw createBookingRequestRepositoryError(
      'booking-request/template-invalid',
      `Variabel tidak dikenal pada template: ${unknownVars.map((v) => `{${v}}`).join(', ')}.`,
    );
  }

  const cleanId =
    String(templateInput?.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_') || `tpl_${Date.now().toString(36)}`;

  const builtIn = DEFAULT_WHATSAPP_TEMPLATES.find((t) => t.id === cleanId) || null;
  const resolvedAdapter = adapter || getWhatsAppTemplateRepositoryAdapter();

  return resolvedAdapter.saveTemplate({
    templateId: cleanId,
    actorUid,
    templateDoc: {
      label,
      category,
      description,
      body,
      allowedVariables: extractedVars,
      requiredVariables: extractedVars,
      requiresConfirmedBooking:
        builtIn?.id === 'booking_confirmed' || Boolean(templateInput?.requiresConfirmedBooking),
      isActive: templateInput?.isActive !== false,
      isBuiltIn: Boolean(builtIn),
      sortOrder:
        builtIn?.sortOrder ??
        (Number.isFinite(Number(templateInput?.sortOrder)) ? Number(templateInput.sortOrder) : 50),
    },
  });
}

export async function toggleWhatsAppTemplateActive({
  actorUid,
  actorRole,
  template,
  isActive,
  adapter = null,
}) {
  assertOwnerActor(actorUid, actorRole);
  const resolvedAdapter = adapter || getWhatsAppTemplateRepositoryAdapter();

  return resolvedAdapter.saveTemplate({
    templateId: template.id,
    actorUid,
    templateDoc: {
      label: template.label,
      category: template.category,
      description: template.description || '',
      body: template.body,
      allowedVariables: template.allowedVariables || [],
      requiredVariables: template.requiredVariables || [],
      requiresConfirmedBooking: Boolean(template.requiresConfirmedBooking),
      isActive: Boolean(isActive),
      isBuiltIn: Boolean(template.isBuiltIn),
      sortOrder: template.sortOrder ?? 50,
    },
  });
}

export async function restoreDefaultWhatsAppTemplate({
  actorUid,
  actorRole,
  templateId,
  adapter = null,
}) {
  assertOwnerActor(actorUid, actorRole);
  const builtIn = DEFAULT_WHATSAPP_TEMPLATES.find((t) => t.id === templateId);
  if (!builtIn) {
    throw createBookingRequestRepositoryError(
      'booking-request/template-not-builtin',
      'Hanya template bawaan sistem yang dapat dikembalikan ke versi default.',
    );
  }

  const resolvedAdapter = adapter || getWhatsAppTemplateRepositoryAdapter();
  return resolvedAdapter.saveTemplate({
    templateId: builtIn.id,
    actorUid,
    templateDoc: builtIn,
  });
}

export async function recordWhatsAppPrepared({
  request,
  templateId,
  templateLabel,
  messageBody,
  actorUid,
  adapter = null,
}) {
  if (!actorUid || !request?.id) {
    throw createBookingRequestRepositoryError(
      'booking-request/unauthenticated',
      'Data request atau sesi staff tidak valid.',
    );
  }

  const cleanBody = String(messageBody || '').trim();
  if (!cleanBody || cleanBody.length > 1800) {
    throw createBookingRequestRepositoryError(
      'booking-request/communication-invalid',
      'Isi pesan WhatsApp wajib diisi dan maksimal 1800 karakter.',
    );
  }

  const resolvedAdapter = adapter || getBookingRequestRepositoryAdapter();
  const commId = generateActivityId('comm');

  return resolvedAdapter.recordCommunicationTransaction({
    requestId: request.id,
    expectedVersion: request.version,
    actorUid,
    communicationId: commId,
    communicationDoc: {
      templateId: String(templateId || ''),
      templateLabel: String(templateLabel || 'Custom Message'),
      messageBodySnapshot: cleanBody,
      eventType: BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_PREPARED,
      preparedAt: true,
      preparedByUid: actorUid,
      manuallyMarkedSentAt: null,
      manuallyMarkedSentByUid: '',
    },
    parentCommunicationPatch: {
      lastCommunicationType: BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_PREPARED,
      lastCommunicationStatus: 'prepared_in_whatsapp',
    },
  });
}

export async function recordWhatsAppMarkedSent({
  request,
  templateId,
  templateLabel,
  messageBody,
  actorUid,
  adapter = null,
}) {
  if (!actorUid || !request?.id) {
    throw createBookingRequestRepositoryError(
      'booking-request/unauthenticated',
      'Data request atau sesi staff tidak valid.',
    );
  }

  const cleanBody = String(messageBody || '').trim();
  if (!cleanBody || cleanBody.length > 1800) {
    throw createBookingRequestRepositoryError(
      'booking-request/communication-invalid',
      'Isi pesan WhatsApp tidak valid.',
    );
  }

  const resolvedAdapter = adapter || getBookingRequestRepositoryAdapter();
  const commId = generateActivityId('comm');

  return resolvedAdapter.recordCommunicationTransaction({
    requestId: request.id,
    expectedVersion: request.version,
    actorUid,
    communicationId: commId,
    communicationDoc: {
      templateId: String(templateId || ''),
      templateLabel: String(templateLabel || 'Custom Message'),
      messageBodySnapshot: cleanBody,
      eventType: BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_MARKED_SENT,
      preparedAt: null,
      preparedByUid: '',
      manuallyMarkedSentAt: true,
      manuallyMarkedSentByUid: actorUid,
    },
    parentCommunicationPatch: {
      lastCommunicationType: BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_MARKED_SENT,
      lastCommunicationStatus: 'manually_marked_sent',
    },
  });
}

export async function recordStaffCommunicationNote({ request, note, actorUid, adapter = null }) {
  if (!actorUid || !request?.id) {
    throw createBookingRequestRepositoryError(
      'booking-request/unauthenticated',
      'Data request atau sesi staff tidak valid.',
    );
  }

  const cleanNote = String(note || '').trim();
  if (cleanNote.length < 3 || cleanNote.length > 800) {
    throw createBookingRequestRepositoryError(
      'booking-request/note-invalid',
      'Catatan staff wajib 3–800 karakter.',
    );
  }

  const resolvedAdapter = adapter || getBookingRequestRepositoryAdapter();
  const commId = generateActivityId('comm');

  return resolvedAdapter.recordCommunicationTransaction({
    requestId: request.id,
    expectedVersion: request.version,
    actorUid,
    communicationId: commId,
    communicationDoc: {
      templateId: '',
      templateLabel: 'Catatan Internal Staff',
      messageBodySnapshot: cleanNote,
      eventType: BOOKING_REQUEST_COMMUNICATION_TYPES.STAFF_NOTE_ADDED,
      preparedAt: null,
      preparedByUid: actorUid,
      manuallyMarkedSentAt: null,
      manuallyMarkedSentByUid: '',
    },
    parentCommunicationPatch: {
      lastCommunicationType: BOOKING_REQUEST_COMMUNICATION_TYPES.STAFF_NOTE_ADDED,
      lastCommunicationStatus: 'staff_note_logged',
    },
  });
}
