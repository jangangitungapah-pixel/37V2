import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Loader2,
  MessageSquare,
  RotateCcw,
  StickyNote,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';
import { usePublicSiteSettings } from '@/features/public-site-settings/hooks/usePublicSiteSettings';

import { BOOKING_REQUEST_STATUS } from '../config/booking-request-config';
import { ALLOWLISTED_TEMPLATE_VARIABLES } from '../config/default-whatsapp-templates';
import { useBookingRequestTemplates } from '../hooks/useBookingRequestTemplates';
import {
  buildWhatsAppClickToChatUrl,
  recordStaffCommunicationNote,
  recordWhatsAppMarkedSent,
  recordWhatsAppPrepared,
} from '../services/whatsapp-message-service';
import {
  buildTemplateVariableMap,
  findUnresolvedPlaceholders,
  renderWhatsAppTemplate,
} from '../utils/whatsapp-template-renderer';

function pickInitialTemplateId(request, enabledTemplates = []) {
  if (!request || enabledTemplates.length === 0) return '';
  if (
    request.status === BOOKING_REQUEST_STATUS.CONFIRMED &&
    request.linkedBookingId &&
    enabledTemplates.some((t) => t.id === 'booking_confirmed')
  ) {
    return 'booking_confirmed';
  }
  if (
    request.requestType === 'post_production_inquiry' &&
    enabledTemplates.some((t) => t.id === 'post_production_received')
  ) {
    return 'post_production_received';
  }

  const templateByStatus = {
    [BOOKING_REQUEST_STATUS.NEW]: 'request_received',
    [BOOKING_REQUEST_STATUS.IN_REVIEW]: 'request_under_review',
    [BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER]: 'needs_more_info',
    [BOOKING_REQUEST_STATUS.ACCEPTED]: 'request_accepted',
    [BOOKING_REQUEST_STATUS.DECLINED]: 'request_declined',
  };
  const preferredTemplateId = templateByStatus[request.status];
  if (preferredTemplateId && enabledTemplates.some((t) => t.id === preferredTemplateId)) {
    return preferredTemplateId;
  }

  return enabledTemplates.find((t) => !t.requiresConfirmedBooking)?.id || enabledTemplates[0].id;
}

export function WhatsAppMessageComposer({
  request,
  actorUid,
  alternativeSlots = [],
  onCommunicationSaved,
}) {
  const { settings: siteSettings } = usePublicSiteSettings();
  const { enabledTemplates } = useBookingRequestTemplates();

  const isBookingConfirmed =
    request?.status === BOOKING_REQUEST_STATUS.CONFIRMED &&
    Boolean(request?.linkedBookingId) &&
    Boolean(request?.confirmedBookingSnapshot);

  const [selectedTemplateId, setSelectedTemplateId] = useState(() =>
    pickInitialTemplateId(request, enabledTemplates),
  );
  const [customBodyOverride, setCustomBodyOverride] = useState(null);
  const [composerState, setComposerState] = useState(() =>
    request?.lastCommunicationStatus === 'manually_marked_sent'
      ? 'sent'
      : request?.lastCommunicationStatus === 'prepared_in_whatsapp'
        ? 'prepared'
        : 'draft',
  );
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [actionError, setActionError] = useState('');
  const [staffNoteText, setStaffNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isNoteComposerOpen, setIsNoteComposerOpen] = useState(false);

  useEffect(() => {
    const savedStatus = request?.lastCommunicationStatus;
    setComposerState(
      savedStatus === 'manually_marked_sent'
        ? 'sent'
        : savedStatus === 'prepared_in_whatsapp'
          ? 'prepared'
          : 'draft',
    );
  }, [request?.id, request?.lastCommunicationStatus]);

  const activeTemplate = useMemo(
    () =>
      enabledTemplates.find((t) => t.id === selectedTemplateId) ||
      enabledTemplates.find((t) => !t.requiresConfirmedBooking || isBookingConfirmed) ||
      enabledTemplates[0] ||
      null,
    [enabledTemplates, selectedTemplateId, isBookingConfirmed],
  );

  const variableMap = useMemo(
    () =>
      buildTemplateVariableMap({
        request,
        studioName: siteSettings?.studioName || '37 Music Studio',
      }),
    [request, siteSettings?.studioName],
  );

  const renderedTemplateResult = useMemo(
    () => renderWhatsAppTemplate(activeTemplate?.body || '', variableMap),
    [activeTemplate?.body, variableMap],
  );

  const activeMessageBody =
    customBodyOverride !== null ? customBodyOverride : renderedTemplateResult.renderedText;

  const unresolvedInEditor = useMemo(
    () => findUnresolvedPlaceholders(activeMessageBody),
    [activeMessageBody],
  );

  const phoneEvaluation = useMemo(
    () =>
      buildWhatsAppClickToChatUrl({
        phone: request?.contactPhone || '',
        message: activeMessageBody,
      }),
    [request?.contactPhone, activeMessageBody],
  );

  const isConfirmedTemplateBlocked = Boolean(
    activeTemplate?.requiresConfirmedBooking && !isBookingConfirmed,
  );
  const hasUnresolvedVars = unresolvedInEditor.length > 0;
  const isMessageTooLong = activeMessageBody.length > 1800;
  const canOpenWhatsApp =
    Boolean(phoneEvaluation.isValid) &&
    Boolean(activeMessageBody.trim()) &&
    !isMessageTooLong &&
    !hasUnresolvedVars &&
    !isConfirmedTemplateBlocked &&
    !isSavingAction;

  const handleTemplateChange = (nextId) => {
    setSelectedTemplateId(nextId);
    setCustomBodyOverride(null);
    setComposerState('draft');
    setActionError('');
  };

  const handleInsertAlternativeSlot = (slot) => {
    const slotText = `${slot.roomLabel} pada ${request.preferredDate} jam ${slot.label.split('•')[1]?.trim() || ''}`;
    const baseText = activeMessageBody;
    const replaced = baseText.includes('[Isi tanggal & jam alternatif WIB]')
      ? baseText.replace('[Isi tanggal & jam alternatif WIB]', slotText)
      : `${baseText}\nAlternatif slot tersedia: ${slotText}`;
    setCustomBodyOverride(replaced);
    setComposerState('draft');
  };

  const handleOpenWhatsApp = async () => {
    if (!canOpenWhatsApp) return;
    setIsSavingAction(true);
    setActionError('');

    try {
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(phoneEvaluation.url, '_blank', 'noopener,noreferrer');
      }

      const result = await recordWhatsAppPrepared({
        request,
        templateId: activeTemplate?.id || 'custom',
        templateLabel: activeTemplate?.label || 'Custom Message',
        messageBody: activeMessageBody,
        actorUid,
      });
      setComposerState('prepared');
      onCommunicationSaved?.(result.request);
      toast.success(
        'WhatsApp dibuka dengan pesan siap kirim. Klik "MARK AS SENT" setelah Anda menekan Send di WhatsApp.',
      );
    } catch (err) {
      const msg = err?.message || 'Gagal mencatat log persiapan pesan WhatsApp.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleMarkAsSent = async () => {
    if (
      !activeMessageBody.trim() ||
      isMessageTooLong ||
      hasUnresolvedVars ||
      isConfirmedTemplateBlocked ||
      isSavingAction
    ) return;
    setIsSavingAction(true);
    setActionError('');

    try {
      const result = await recordWhatsAppMarkedSent({
        request,
        templateId: activeTemplate?.id || 'custom',
        templateLabel: activeTemplate?.label || 'Custom Message',
        messageBody: activeMessageBody,
        actorUid,
      });
      setComposerState('sent');
      onCommunicationSaved?.(result.request);
      toast.success('Pesan dicatat sebagai "Manually marked sent" pada riwayat komunikasi.');
    } catch (err) {
      const msg = err?.message || 'Gagal mencatat status pengiriman manual.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleAddStaffNote = async (event) => {
    event.preventDefault();
    if (isSavingNote || staffNoteText.trim().length < 3) return;
    setIsSavingNote(true);
    setActionError('');
    try {
      const result = await recordStaffCommunicationNote({
        request,
        note: staffNoteText.trim(),
        actorUid,
      });
      setStaffNoteText('');
      setIsNoteComposerOpen(false);
      onCommunicationSaved?.(result.request);
      toast.success('Catatan internal berhasil ditambahkan.');
    } catch (err) {
      const msg = err?.message || 'Gagal menyimpan catatan staff.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setIsSavingNote(false);
    }
  };

  const statusBadgeMeta =
    composerState === 'sent'
      ? { label: 'Manually marked sent', tone: 'emerald' }
      : composerState === 'prepared'
        ? { label: 'Prepared in WhatsApp', tone: 'lime' }
        : { label: 'Draft', tone: 'ivory' };

  return (
    <section
      aria-labelledby="whatsapp-composer-heading"
      className="space-y-3 rounded-2xl border border-[#151515]/10 bg-white p-3.5 sm:space-y-3.5 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.08] pb-2.5 sm:pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquare className="h-4 w-4 shrink-0 text-[#151515]" aria-hidden="true" />
          <div className="min-w-0">
            <h4 id="whatsapp-composer-heading" className="text-sm font-bold text-[#151515]">
              WhatsApp ke Customer
            </h4>
            <p className="text-[10px] text-[#8B857B]">Klik untuk menyiapkan pesan customer</p>
          </div>
        </div>
        <AdminStatusBadge tone={statusBadgeMeta.tone} size="sm" dot>
          {statusBadgeMeta.label}
        </AdminStatusBadge>
      </div>

      {/* Customer Phone Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#151515]/10 bg-[#FAF8F1] px-3 py-2.5 text-xs">
        <span>
          Tujuan WhatsApp:{' '}
          <strong className="font-mono text-[#151515]">
            {request?.contactPhoneDisplay || request?.contactPhone || '-'}
          </strong>
        </span>
        {!phoneEvaluation.isValid ? (
          <span className="font-semibold text-red-700">{phoneEvaluation.error}</span>
        ) : (
          <span className="font-mono text-[11px] text-[#0F6246]">
            wa.me/{phoneEvaluation.waDigits}
          </span>
        )}
      </div>

      {/* Template Selector */}
      <div className="space-y-1.5">
        <label
          htmlFor="whatsapp-template-select"
          className="block text-xs font-semibold text-[#151515]"
        >
          Pilih Template Pesan
        </label>
        <select
          id="whatsapp-template-select"
          aria-label="Pilih Template Pesan Internal"
          value={activeTemplate?.id || ''}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="sa-input min-h-11 w-full rounded-xl px-3 py-2 text-xs font-medium sm:text-sm"
        >
          {enabledTemplates.map((tpl) => {
            const locked = Boolean(tpl.requiresConfirmedBooking && !isBookingConfirmed);
            return (
              <option key={tpl.id} value={tpl.id} disabled={locked}>
                {tpl.label}
                {locked ? ' (Terkunci — butuh booking resmi Confirmed)' : ''}
              </option>
            );
          })}
        </select>
        {activeTemplate?.description ? (
          <p className="text-[11px] text-[#666159]">{activeTemplate.description}</p>
        ) : null}
      </div>

      {/* Alternative Slot Quick Insert Chips */}
      {activeTemplate?.id === 'alternative_slot' && alternativeSlots.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[#46433D]">
            Sisipkan slot kosong alternatif ke pesan:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {alternativeSlots.map((slot, idx) => (
              <button
                key={`${slot.studioId}-${slot.startMinute}-${idx}`}
                type="button"
                onClick={() => handleInsertAlternativeSlot(slot)}
                className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-[#151515]/15 bg-[#EDF8C2]/70 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[#243300] hover:bg-[#C8F13A]"
              >
                + {slot.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Unresolved Variable or Confirmation Lock Warnings */}
      {isConfirmedTemplateBlocked ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-[#FEF4DD] p-3 text-xs text-[#6B3B08]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Template <strong>Booking Confirmed</strong> hanya boleh digunakan setelah request ini
            memiliki booking resmi berstatus Confirmed di Admin Calendar.
          </span>
        </div>
      ) : null}

      {isMessageTooLong ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
          Pesan melebihi batas 1.800 karakter. Ringkas pesan sebelum melanjutkan.
        </div>
      ) : null}

      {hasUnresolvedVars ? (
        <div
          role="alert"
          data-testid="whatsapp-unresolved-vars-warning"
          className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Terdapat variabel template yang belum terisi:</p>
            <p className="mt-0.5 font-mono">{unresolvedInEditor.map((v) => `{${v}}`).join(', ')}</p>
            <p className="mt-0.5">Lengkapi atau hapus token di bawah sebelum membuka WhatsApp.</p>
          </div>
        </div>
      ) : null}

      {/* Editable Message Textarea */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="whatsapp-message-editor"
            className="block text-xs font-semibold text-[#151515]"
          >
            Preview &amp; Edit Pesan WhatsApp
          </label>
          {customBodyOverride !== null ? (
            <button
              type="button"
              onClick={() => setCustomBodyOverride(null)}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#46433D] hover:underline"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Reset ke template</span>
            </button>
          ) : null}
        </div>
        <textarea
          id="whatsapp-message-editor"
          rows={5}
          maxLength={1800}
          aria-describedby="whatsapp-message-helper"
          value={activeMessageBody}
          onChange={(e) => {
            setCustomBodyOverride(e.target.value);
            if (composerState !== 'draft') setComposerState('draft');
          }}
          className="sa-input mt-1.5 w-full rounded-xl p-3 text-xs leading-relaxed sm:text-sm"
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p id="whatsapp-message-helper" className="max-w-xl text-[10.5px] leading-relaxed text-[#666159]">
            Membuka WhatsApp hanya menyiapkan pesan. Pengiriman tetap perlu dikonfirmasi secara manual.
          </p>
          <span className={`shrink-0 font-mono text-[10px] tabular-nums ${isMessageTooLong ? 'font-bold text-red-700' : 'text-[#8B857B]'}`}>
            {activeMessageBody.length}/1800
          </span>
        </div>
        <details className="group mt-1">
          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-[10.5px] font-semibold text-[#666159] hover:text-[#151515]">
            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden="true" />
            Variabel template yang didukung
          </summary>
          <p className="mt-1 rounded-lg bg-[#FAF8F1] p-2 font-mono text-[10px] leading-relaxed text-[#666159]">
            {ALLOWLISTED_TEMPLATE_VARIABLES.map((variable) => `{${variable}}`).join(', ')}
          </p>
        </details>
      </div>

      {actionError ? (
        <p role="alert" className="text-xs font-medium text-red-700">
          {actionError}
        </p>
      ) : null}

      {/* Primary & Secondary WhatsApp Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <AdminButton
          variant="lime"
          size="md"
          disabled={!canOpenWhatsApp}
          onClick={handleOpenWhatsApp}
          className="flex-1 font-mono text-xs tracking-wide uppercase"
        >
          {isSavingAction ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>OPEN WHATSAPP WITH MESSAGE</span>
        </AdminButton>

        <AdminButton
          variant={composerState === 'prepared' ? 'primary' : 'secondary'}
          size="md"
          disabled={
            !activeMessageBody.trim() ||
            isMessageTooLong ||
            hasUnresolvedVars ||
            isConfirmedTemplateBlocked ||
            isSavingAction
          }
          onClick={handleMarkAsSent}
          className="font-mono text-xs tracking-wide uppercase"
        >
          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>MARK AS SENT</span>
        </AdminButton>
      </div>

      {/* Internal notes are intentionally separate from messages sent to customers. */}
      <div className="border-t border-[#151515]/[0.08] pt-2.5">
        <button
          type="button"
          aria-expanded={isNoteComposerOpen}
          aria-controls="request-staff-note-panel"
          onClick={() => setIsNoteComposerOpen((previous) => !previous)}
          className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-2 text-left transition-colors hover:bg-[#FAF8F1]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <StickyNote className="h-4 w-4 shrink-0 text-[#666159]" aria-hidden="true" />
            <span className="text-xs font-semibold text-[#151515]">Catatan internal staff</span>
            <span className="rounded-full border border-[#151515]/10 bg-[#FAF8F1] px-2 py-0.5 text-[9px] font-medium text-[#666159]">
              Privat
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#666159] transition-transform duration-200 ${isNoteComposerOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {isNoteComposerOpen ? (
          <form id="request-staff-note-panel" onSubmit={handleAddStaffNote} className="mt-2 space-y-2 rounded-xl bg-[#FAF8F1] p-3">
            <label htmlFor="request-staff-note-input" className="block text-[11px] font-semibold text-[#46433D]">
              Catatan ini hanya terlihat oleh tim studio dan tidak dikirim ke customer.
            </label>
            <textarea
              id="request-staff-note-input"
              rows={3}
              maxLength={800}
              value={staffNoteText}
              onChange={(event) => setStaffNoteText(event.target.value)}
              placeholder="Catat hasil telepon/WhatsApp atau detail tambahan..."
              className="sa-input w-full rounded-xl bg-white p-3 text-xs leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-[#8B857B] tabular-nums">{staffNoteText.length}/800</span>
              <AdminButton
                type="submit"
                variant="secondary"
                size="sm"
                disabled={isSavingNote || staffNoteText.trim().length < 3}
                className="min-h-10 w-full sm:w-auto"
              >
                {isSavingNote ? 'Menyimpan...' : 'Simpan Catatan'}
              </AdminButton>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
