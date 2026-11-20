import { AlertTriangle, Boxes, PackageMinus, ShieldAlert, Wrench } from 'lucide-react';

import { AdminMetricCard } from '@/features/admin/design-system';

/**
 * Top 4 deduplicated Inventory KPI Metrics (`Active Items`, `Low Stock`, `Maintenance`, `Damaged / Retired`).
 * Uses server-aggregated counts when available so partial pagination never misstates totals.
 */
export function InventoryOverviewMetrics({
  summary,
  loadedActiveCount = 0,
  outOfStockCount = 0,
  hasMoreItems = false,
  onLoadMoreItems,
}) {
  const activeCount = summary?.activeItemsCount ?? loadedActiveCount;
  const archivedCount = summary?.archivedItemsCount ?? 0;
  const lowStockCount = summary?.lowStockCount ?? 0;
  const maintenanceCount = summary?.maintenanceCount ?? 0;
  const damagedRetiredCount = summary?.damagedRetiredCount ?? 0;

  return (
    <div className="mt-4 space-y-3 border-t border-[#151515]/[0.07] pt-4 sm:mt-5 sm:pt-5">
      <dl
        aria-label="Ringkasan Inventory Studio"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4"
      >
        <AdminMetricCard
          label="Active Items"
          value={activeCount}
          hint={
            archivedCount > 0
              ? `Item aktif tercatat (+${archivedCount} diarsipkan)`
              : 'Jumlah record barang aktif studio'
          }
          icon={Boxes}
          tone="neutral"
        />

        <AdminMetricCard
          label="Low Stock"
          value={lowStockCount}
          hint={
            outOfStockCount > 0
              ? `Stok di batas minimum / habis (${outOfStockCount} habis)`
              : 'Consumable di atau di bawah minimum'
          }
          icon={PackageMinus}
          tone={lowStockCount > 0 ? 'orange' : 'neutral'}
        />

        <AdminMetricCard
          label="Maintenance"
          value={maintenanceCount}
          hint="Sedang servis atau jadwal perawatan jatuh tempo"
          icon={Wrench}
          tone={maintenanceCount > 0 ? 'amber' : 'neutral'}
        />

        <AdminMetricCard
          label="Damaged / Retired"
          value={damagedRetiredCount}
          hint="Item dengan unit rusak atau pensiun/hilang"
          icon={ShieldAlert}
          tone={damagedRetiredCount > 0 ? 'orange' : 'neutral'}
        />
      </dl>

      {hasMoreItems ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-2xl border border-amber-500/25 bg-[#FEF4DD] px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4B22]" aria-hidden="true" />
            <p className="text-xs text-[#8A4B08]">
              Menampilkan <strong className="font-semibold">{loadedActiveCount}</strong> dari{' '}
              <strong className="font-semibold">{activeCount}</strong> item aktif (ringkasan angka
              di atas dihitung dari total koleksi).
            </p>
          </div>
          {onLoadMoreItems ? (
            <button
              type="button"
              onClick={onLoadMoreItems}
              className="sa-control sa-btn-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center px-3 py-1 text-xs font-semibold"
            >
              Load More Items
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
