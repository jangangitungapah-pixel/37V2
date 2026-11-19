import { useState } from 'react';
import { AlertTriangle, CheckCheck, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';

import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';

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
      <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border px-3 py-1.5 font-mono text-[10px]">
        <span className="text-studio-muted-ink font-semibold">
          {resolvedCount} sesi lama pada periode ini sudah ditandai selesai diperiksa.
        </span>
      </div>
    );
  }

  return (
    <section
      aria-label="Sesi perlu pemeriksaan catatan komisi"
      className="cal-card border-studio-ink overflow-hidden bg-amber-50"
    >
      {/* Compact Collapsible Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="text-studio-orange h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-mono text-xs font-extrabold tracking-wider text-[#9a3412] uppercase">
              Needs Review ({items.length})
            </h2>
            <p className="text-studio-muted-ink truncate text-[11px] font-medium">
              Sesi lama belum memiliki catatan komisi • Klik Lihat untuk cek detail atau tandai
              selesai
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="cal-control border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-8.5 shrink-0 cursor-pointer items-center gap-1 px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase"
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
        <div className="border-t border-amber-300 p-3 sm:p-4">
          <p className="text-studio-muted-ink mb-2.5 text-xs font-medium">
            Sesi di bawah ini sudah selesai tetapi belum memiliki catatan komisi yang valid. Angka
            tidak dihitung ulang otomatis dan tidak ikut diposting ke Pembukuan. Tandai selesai bila
            sesi lama ini tidak memerlukan komisi.
          </p>

          <ul className="space-y-2">
            {items.map((item) => {
              const completedText = formatIndonesianTimestamp(item.booking.actualCompletedAt);
              return (
                <li
                  key={item.bookingId}
                  className="border-studio-ink bg-studio-white flex flex-col justify-between gap-2 border p-2.5 sm:flex-row sm:items-center sm:px-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                      <span className="border-studio-ink bg-studio-orange text-studio-white border px-1.5 py-0.5 font-extrabold uppercase">
                        Needs Review
                      </span>
                      <span className="text-studio-ink font-extrabold">{item.bookingId}</span>
                      <span className="text-studio-muted-ink">• Selesai: {completedText}</span>
                    </div>

                    <p className="text-studio-ink truncate text-sm font-extrabold">
                      {item.booking.customerName}
                      {item.booking.bandName ? ` (${item.booking.bandName})` : ''} —{' '}
                      <span className="font-semibold">
                        {item.serviceInfo.serviceTypeName} • {item.serviceInfo.serviceOptionName}
                      </span>
                    </p>

                    <p className="font-mono text-[10.5px] font-bold text-[#9a3412]">
                      Alasan: {item.reason}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onResolveBookingItem?.(item)}
                      className="cal-control border-studio-ink bg-studio-lime text-studio-ink hover:bg-studio-white inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase"
                    >
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Tandai Selesai</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectBookingItem?.(item)}
                      className="cal-control border-studio-ink bg-studio-ink text-studio-white hover:bg-studio-lime hover:text-studio-ink inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase"
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
