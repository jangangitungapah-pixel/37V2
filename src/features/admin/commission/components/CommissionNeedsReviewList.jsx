import { useState } from 'react';
import { AlertTriangle, CheckCheck, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';

import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

/**
 * Compact, collapsible-by-default Needs Review banner & action list:
 * - Renders as 1 concise summary strip when collapsed so legacy items do not crowd the workspace.
 * - Expands on click to inspect Details or explicitly mark items resolved (`commissionReviewResolutions`).
 */
export function CommissionNeedsReviewList({
  items = [],
  resolvedCount = 0,
  onSelectBookingItem,
  onResolveBookingItem,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if ((!Array.isArray(items) || items.length === 0) && resolvedCount <= 0) {
    return null;
  }

  if (!items || items.length === 0) {
    return (
      <div className="sa-panel-ivory flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs text-[#666159]">
        <span>{resolvedCount} sesi lama pada periode ini sudah ditandai selesai diperiksa.</span>
      </div>
    );
  }

  return (
    <section
      aria-label="Sesi perlu pemeriksaan catatan komisi"
      className="overflow-hidden rounded-2xl border border-amber-500/25 bg-[#FEF4DD]/80 shadow-[0_1px_2px_rgba(21,21,21,0.03)]"
    >
      {/* Compact Collapsible Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-[#B92B0C]">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-[#8A4B08] sm:text-sm">
              Needs Review ({items.length})
            </h2>
            <p className="truncate text-[11px] text-[#8A4B08]/85">
              Sesi lama belum memiliki catatan komisi • Klik Lihat untuk cek detail atau tandai
              selesai
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="sa-control sa-btn-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold"
        >
          <span>{isExpanded ? 'Tutup' : `Lihat (${items.length})`}</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Expandable Detail Cards */}
      {isExpanded ? (
        <div className="border-t border-amber-500/20 bg-white/55 p-4">
          <p className="mb-3 text-xs leading-relaxed text-[#666159]">
            Sesi di bawah ini sudah selesai tetapi belum memiliki catatan komisi yang valid. Angka
            tidak dihitung ulang otomatis dan tidak ikut diposting ke Pembukuan. Tandai selesai bila
            sesi lama ini tidak memerlukan komisi.
          </p>

          <ul className="space-y-2.5">
            {items.map((item) => {
              const completedText = formatIndonesianTimestamp(item.booking.actualCompletedAt);
              return (
                <li
                  key={item.bookingId}
                  className="sa-subcard flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <AdminStatusBadge tone="orange" size="sm">
                        Needs Review
                      </AdminStatusBadge>
                      <span className="font-semibold text-[#151515]">{item.bookingId}</span>
                      <span className="text-[#666159]">• Selesai: {completedText}</span>
                    </div>

                    <p className="truncate text-sm font-semibold text-[#151515]">
                      {item.booking.customerName}
                      {item.booking.bandName ? ` (${item.booking.bandName})` : ''} —{' '}
                      <span className="font-normal text-[#46433D]">
                        {item.serviceInfo.serviceTypeName} • {item.serviceInfo.serviceOptionName}
                      </span>
                    </p>

                    <p className="text-xs font-medium text-[#B92B0C]">Alasan: {item.reason}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onResolveBookingItem?.(item)}
                      className="sa-control sa-btn-lime inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                    >
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Tandai Selesai</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectBookingItem?.(item)}
                      className="sa-control sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold"
                    >
                      <span>Detail</span>
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
