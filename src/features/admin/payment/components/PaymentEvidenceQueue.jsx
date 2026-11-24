import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileCheck2,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

import { getPaymentMethodLabel } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminEmptyState, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { PaymentEvidencePreview } from '@/features/payment-evidence/components/PaymentEvidencePreview';
import { PAYMENT_EVIDENCE_STATUSES } from '@/features/payment-evidence/config/payment-evidence-config';
import {
  getPaymentEvidenceSourceLabel,
  getPaymentEvidenceStatusMeta,
} from '@/features/payment-evidence/utils/payment-evidence-utils';

const EVIDENCE_FILTER_OPTIONS = Object.freeze([
  { id: PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW, label: 'Menunggu Verifikasi' },
  { id: PAYMENT_EVIDENCE_STATUSES.VERIFIED, label: 'Terverifikasi' },
  { id: PAYMENT_EVIDENCE_STATUSES.REJECTED, label: 'Ditolak' },
  { id: PAYMENT_EVIDENCE_STATUSES.ATTACHED, label: 'Lampiran Admin' },
  { id: 'all', label: 'Semua' },
]);

/**
 * Admin Portal Payment Evidence Review Queue (Section 9B).
 * Prioritizes `pending_review` by default, supports status filters + search,
 * displays validated Cloudinary thumbnails, claimed amounts, and current invoice balance.
 */
export function PaymentEvidenceQueue({
  items = [],
  counts = {},
  invoicesById = new Map(),
  reversedTransactionIds = new Set(),
  isLoading = false,
  hasMore = false,
  error = '',
  onRetry,
  onLoadMore,
  onSelectEvidence,
}) {
  const [statusFilter, setStatusFilter] = useState(PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (!q) return true;

      const invoice = invoicesById?.get?.(item.invoiceId);
      const haystack = [
        item.invoiceNumber,
        item.bookingId,
        item.referenceNumber,
        invoice?.customerSnapshot?.name,
        invoice?.customerSnapshot?.bandName,
        invoice?.customerSnapshot?.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, statusFilter, searchQuery, invoicesById]);

  const hasActiveSearch = Boolean(String(searchQuery || '').trim());

  const getTabCount = (id) => {
    if (id === 'all') return counts?.total ?? items.length;
    if (id === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW) return counts?.pendingReview ?? 0;
    if (id === PAYMENT_EVIDENCE_STATUSES.VERIFIED) return counts?.verified ?? 0;
    if (id === PAYMENT_EVIDENCE_STATUSES.REJECTED) return counts?.rejected ?? 0;
    if (id === PAYMENT_EVIDENCE_STATUSES.ATTACHED) return counts?.attached ?? 0;
    return 0;
  };

  return (
    <div data-testid="admin-payment-evidence-queue" className="space-y-4">
      {/* Filter Toolbar */}
      <AdminSurface variant="card" className="space-y-3 p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Filter status bukti pembayaran"
            className="flex flex-wrap items-center gap-1.5"
          >
            {EVIDENCE_FILTER_OPTIONS.map((opt) => {
              const active = statusFilter === opt.id;
              const count = getTabCount(opt.id);
              const isPendingHighlight =
                opt.id === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW && count > 0;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(opt.id)}
                  className={`inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-[#151515] bg-[#151515] text-[#F1EEE4]'
                      : 'border-[#151515]/12 bg-[#F8F6EF] text-[#46433D] hover:border-[#151515]/30 hover:text-[#151515]'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold tabular-nums ${
                      active
                        ? 'bg-[#C8F13A] text-[#151515]'
                        : isPendingHighlight
                          ? 'bg-[#FF4B22] text-white'
                          : 'bg-[#151515]/[0.07] text-[#46433D]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#666159]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cari bukti pembayaran berdasarkan nomor invoice, nama pelanggan, atau referensi"
              placeholder="Cari invoice, pelanggan, ref..."
              className="sa-input min-h-9 w-full pr-8 pl-8.5 text-xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian bukti pembayaran"
                className="absolute top-1/2 right-2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[#666159] hover:bg-[#151515]/[0.06] hover:text-[#151515]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </AdminSurface>

      {/* Queue Body */}
      {error ? (
        <AdminSurface variant="card" className="p-4 sm:p-5">
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3.5 text-xs text-[#B92B0C]"
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </span>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="sa-btn-secondary inline-flex min-h-8 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Coba Lagi</span>
              </button>
            ) : null}
          </div>
        </AdminSurface>
      ) : isLoading && items.length === 0 ? (
        <AdminSurface
          role="status"
          variant="card"
          className="flex items-center gap-2.5 p-5 text-xs font-medium text-[#666159]"
        >
          <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
          <span>Memuat antrean bukti pembayaran dari Firestore...</span>
        </AdminSurface>
      ) : filteredItems.length === 0 ? (
        <AdminSurface variant="card" className="p-5 sm:p-6">
          <AdminEmptyState
            icon={FileCheck2}
            title={
              hasActiveSearch
                ? 'Tidak Ada Bukti Pembayaran yang Cocok'
                : statusFilter === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW
                  ? 'Tidak Ada Bukti Menunggu Verifikasi'
                  : 'Belum Ada Bukti Pembayaran pada Status Ini'
            }
            description={
              hasActiveSearch
                ? 'Coba ubah kata kunci pencarian atau pilih filter status lain.'
                : statusFilter === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW
                  ? 'Semua bukti pembayaran yang dikirim pelanggan dari Client Portal sudah ditinjau.'
                  : 'Bukti pembayaran dari Client Portal maupun lampiran opsional Admin akan muncul di sini.'
            }
            action={
              hasActiveSearch || statusFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="sa-control sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center px-3.5 py-1.5 text-xs font-semibold"
                >
                  Lihat Semua Bukti
                </button>
              ) : null
            }
          />
        </AdminSurface>
      ) : (
        <AdminSurface variant="card" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/80 px-4 py-3">
            <span className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm">
              Antrean Bukti Pembayaran ({filteredItems.length})
            </span>
            <span className="text-[11px] text-[#666159]">
              Diurutkan terbaru lebih dahulu • Klik item untuk verifikasi
            </span>
          </div>

          <ul className="divide-y divide-[#151515]/[0.07]">
            {filteredItems.map((item) => {
              const invoice = invoicesById?.get?.(item.invoiceId) || null;
              const statusMeta = getPaymentEvidenceStatusMeta(item.status, 'id');
              const sourceLabel = getPaymentEvidenceSourceLabel(item.evidenceSource, 'id');
              const isPending = item.status === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW;
              const isReversed = Boolean(
                item.linkedTransactionId && reversedTransactionIds?.has?.(item.linkedTransactionId),
              );

              return (
                <li
                  key={item.id}
                  data-testid={`admin-evidence-row-${item.id}`}
                  className={`flex flex-col gap-3 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5 ${
                    isPending ? 'bg-[#FEF4DD]/30 hover:bg-[#FEF4DD]/55' : 'bg-white hover:bg-[#FAF8F3]'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="shrink-0">
                      <PaymentEvidencePreview
                        evidence={item.evidence}
                        size="sm"
                        locale="id"
                        alt={`Thumbnail bukti ${item.invoiceNumber}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#151515]">
                          {item.invoiceNumber}
                        </span>
                        <AdminStatusBadge tone={statusMeta.tone} size="sm" dot={isPending}>
                          {statusMeta.label}
                        </AdminStatusBadge>
                        <AdminStatusBadge tone="ivory" size="sm">
                          {sourceLabel}
                        </AdminStatusBadge>
                        {isReversed ? (
                          <AdminStatusBadge tone="neutral" size="sm">
                            Transaksi Dibatalkan
                          </AdminStatusBadge>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-semibold text-[#151515]">
                          {invoice?.customerSnapshot?.name || 'Pelanggan Studio'}
                        </span>
                        {invoice?.customerSnapshot?.bandName ? (
                          <span className="text-[#666159]">
                            • {invoice.customerSnapshot.bandName}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#666159]">
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#151515] tabular-nums">
                          Klaim: {formatRupiah(item.claimedAmount)}
                        </span>
                        <span>• {getPaymentMethodLabel(item.paymentMethod)}</span>
                        {item.claimedPaidAt ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" aria-hidden="true" />
                            <span>Bayar: {formatIndonesianDateMedium(item.claimedPaidAt)}</span>
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          <span>Dikirim: {formatIndonesianTimestamp(item.submittedAt)}</span>
                        </span>
                      </div>

                      {item.status === PAYMENT_EVIDENCE_STATUSES.VERIFIED &&
                      item.verifiedAmount != null ? (
                        <p className="font-mono text-[11px] font-semibold text-[#0F6246]">
                          Terverifikasi: {formatRupiah(item.verifiedAmount)}
                        </p>
                      ) : null}

                      {item.status === PAYMENT_EVIDENCE_STATUSES.REJECTED && item.rejectionReason ? (
                        <p className="line-clamp-1 text-[11px] text-[#B92B0C]">
                          Alasan ditolak: {item.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#151515]/[0.06] pt-2.5 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                    {invoice ? (
                      <div className="text-left sm:text-right">
                        <p className="text-[10.5px] text-[#666159]">Sisa Tagihan Invoice</p>
                        <p
                          className={`font-mono text-xs font-bold tabular-nums ${
                            invoice.balanceDue > 0 ? 'text-[#FF4B22]' : 'text-[#0F6246]'
                          }`}
                        >
                          {formatRupiah(invoice.balanceDue)}
                        </p>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onSelectEvidence?.(item, invoice)}
                      aria-label={`${isPending ? 'Tinjau' : 'Lihat detail'} bukti pembayaran ${item.invoiceNumber}`}
                      className={`sa-control inline-flex min-h-8.5 cursor-pointer items-center gap-1 px-3 py-1 text-xs font-semibold ${
                        isPending ? 'sa-btn-lime' : 'sa-btn-secondary'
                      }`}
                    >
                      <span>{isPending ? 'Tinjau & Verifikasi' : 'Lihat Detail'}</span>
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </AdminSurface>
      )}

      {hasMore ? (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center justify-center px-4 py-2 text-xs font-semibold"
          >
            Muat Lebih Banyak Bukti Pembayaran
          </button>
        </div>
      ) : null}
    </div>
  );
}
