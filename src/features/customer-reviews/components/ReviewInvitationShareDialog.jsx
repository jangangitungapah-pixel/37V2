import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Check, Copy, ExternalLink, Link2, MessageSquare, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  formatIndonesianDateFull,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';

import {
  buildReviewInvitationWhatsAppMessage,
  buildReviewInvitationWhatsAppUrl,
} from '../services/review-invitation-service';

export function ReviewInvitationShareDialog({ open, onOpenChange, invitationResult }) {
  const [copied, setCopied] = useState(false);

  if (!invitationResult) {
    return null;
  }

  const { booking, invitation, invitationUrl, normalizedPhone } = invitationResult;
  const customerName = booking?.customerName || 'Pelanggan';
  const serviceLabel =
    invitation?.serviceLabelSnapshot || booking?.serviceTypeName || 'Studio Session';
  const sessionDateLabel = invitation?.sessionDate
    ? formatIndonesianDateFull(invitation.sessionDate)
    : '-';
  const expiresLabel = invitation?.expiresAt
    ? formatIndonesianTimestamp(invitation.expiresAt)
    : '30 hari dari sekarang';

  const whatsappPreview = buildReviewInvitationWhatsAppMessage({
    customerName,
    reviewUrl: invitationUrl,
  });
  const whatsappLink = buildReviewInvitationWhatsAppUrl({
    phone: normalizedPhone || booking?.phoneNormalized || booking?.phone,
    customerName,
    reviewUrl: invitationUrl,
  });

  const handleCopyUrl = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invitationUrl);
      } else {
        throw new Error('Clipboard unavailable');
      }
      setCopied(true);
      toast.success('Tautan undangan ulasan berhasil disalin ke clipboard.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Tidak dapat menyalin otomatis. Salin tautan secara manual dari kotak URL.');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[70]"
        />
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            data-testid="review-invitation-share-dialog"
            aria-label="Bagikan Tautan Undangan Ulasan"
            className="sa-dialog flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[26px] rounded-b-none border border-[#151515]/12 bg-white p-0 text-[#151515] shadow-2xl outline-none sm:rounded-[22px]"
          >
            {/* Sticky Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-6 sm:py-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8BAD12]/40 bg-[#EDF8C2] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#243300] uppercase">
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  <span>Undangan Ulasan Dibuat</span>
                </span>
                <Dialog.Title className="mt-2 text-lg font-bold tracking-tight">
                  Bagikan Link Ulasan via WhatsApp
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-[#666159]">
                  Token mentah hanya tampil sekali di sesi ini dan tidak disimpan di database.
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup dialog bagikan undangan"
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#151515]/10 bg-[#FAF8F3] text-[#46433D] hover:bg-white hover:text-[#151515]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Scrollable Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <dl className="grid grid-cols-1 gap-2.5 rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3.5 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-[10.5px] font-medium text-[#666159]">Customer</dt>
                  <dd className="mt-0.5 font-bold text-[#151515]">{customerName}</dd>
                </div>
                <div>
                  <dt className="text-[10.5px] font-medium text-[#666159]">
                    Layanan &amp; Tanggal
                  </dt>
                  <dd className="mt-0.5 font-semibold text-[#151515]">
                    {serviceLabel} • {sessionDateLabel}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10.5px] font-medium text-[#666159]">Berlaku Hingga</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-[#151515]">{expiresLabel}</dd>
                </div>
              </dl>

              <div>
                <label
                  htmlFor="generated-review-invitation-url"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Tautan Undangan Unik (Sekali Pakai)
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="generated-review-invitation-url"
                    type="text"
                    readOnly
                    value={invitationUrl}
                    onFocus={(e) => e.target.select()}
                    className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#151515]/20 bg-[#FAF8F3] px-3 py-2 font-mono text-xs text-[#151515] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="sa-control sa-btn-secondary inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#151515]">Pratinjau Pesan WhatsApp</p>
                <pre className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-[#151515]/12 bg-[#F8F6EF] p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap text-[#46433D]">
                  {whatsappPreview}
                </pre>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-[#FEF4DD] px-3 py-2.5 text-xs leading-relaxed text-[#8A4B08]">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Pesan <strong>tidak dikirim otomatis</strong>. Klik <strong>Open WhatsApp</strong>{' '}
                  lalu tekan tombol <strong>Send / Kirim</strong> secara manual di aplikasi WhatsApp
                  Anda.
                </span>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="sa-safe-bottom flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
              <Dialog.Close
                className={`sa-control sa-btn-secondary inline-flex min-h-9.5 cursor-pointer items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold ${
                  whatsappLink.isValid ? 'flex-1 sm:flex-initial' : 'w-auto'
                }`}
              >
                Tutup
              </Dialog.Close>

              {whatsappLink.isValid ? (
                <a
                  href={whatsappLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="review-invitation-open-whatsapp"
                  className="sa-control sa-btn-lime inline-flex min-h-9.5 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-[#151515] sm:flex-initial"
                >
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Open WhatsApp</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="text-xs font-medium text-[#B92B0C]">
                  Nomor WhatsApp pelanggan tidak valid untuk Click-to-Chat.
                </span>
              )}
            </div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
