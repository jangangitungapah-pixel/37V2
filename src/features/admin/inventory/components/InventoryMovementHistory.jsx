import { ArrowRight, History, Loader2 } from 'lucide-react';

import { AdminEmptyState, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { getMovementMeta } from '../config/inventory-config';
import {
  formatInventoryTimestamp,
  formatMovementBalanceSummary,
  formatMovementDeltaText,
} from '../utils/inventory-format';

export function InventoryMovementHistory({
  movements = [],
  hasMore = false,
  isLoading = false,
  error = null,
  onLoadMore,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
          <h3 className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm">
            Movement History
          </h3>
        </div>

        <span className="font-mono text-[11px] font-medium text-[#666159]">
          {movements.length} catatan
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]">
          {error}
        </div>
      ) : isLoading && movements.length === 0 ? (
        <div className="sa-panel flex items-center justify-center gap-2 p-6 text-xs text-[#666159]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Memuat riwayat pergerakan barang...</span>
        </div>
      ) : movements.length === 0 ? (
        <AdminEmptyState
          icon={History}
          title="Belum ada riwayat pergerakan"
          description="Catat Stock In atau pergerakan barang untuk mulai menyimpan jejak stok."
          className="py-6"
        />
      ) : (
        <div className="space-y-2">
          {movements.map((mov) => {
            const meta = getMovementMeta(mov.movementType);
            const balanceSummary = formatMovementBalanceSummary(mov);
            return (
              <AdminSurface key={mov.id} variant="subcard" className="p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AdminStatusBadge tone={meta.tone} size="sm">
                      {meta.label}
                    </AdminStatusBadge>
                    <span className="font-mono font-bold text-[#151515]">
                      {formatMovementDeltaText(mov)}
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-[#666159]">
                    {formatInventoryTimestamp(mov.occurredAt || mov.createdAt)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-[#46433D]">
                  <span className="rounded bg-[#FAF8F3] px-1.5 py-0.5 ring-1 ring-[#151515]/8">
                    Before: {balanceSummary.before}
                  </span>
                  <ArrowRight className="h-3 w-3 text-[#8B857B]" aria-hidden="true" />
                  <span className="rounded bg-[#FAF8F3] px-1.5 py-0.5 font-semibold text-[#151515] ring-1 ring-[#151515]/10">
                    After: {balanceSummary.after}
                  </span>
                </div>

                {mov.reason || mov.notes ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-[#46433D]">
                    {mov.reason ? <strong className="text-[#151515]">{mov.reason}</strong> : null}
                    {mov.reason && mov.notes ? ' — ' : ''}
                    {mov.notes}
                  </p>
                ) : null}

                <p className="mt-1 text-[10.5px] text-[#8B857B]">
                  Dicatat oleh: {mov.recordedByNameSnapshot || mov.recordedByUid}
                </p>
              </AdminSurface>
            );
          })}

          {hasMore && onLoadMore ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={onLoadMore}
              className="sa-control sa-btn-secondary min-h-10 w-full cursor-pointer py-2 text-xs font-semibold"
            >
              {isLoading ? 'Memuat...' : 'Load More History'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
