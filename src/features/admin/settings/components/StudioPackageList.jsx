import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';

import {
  calculatePackageFinalPrice,
  formatRupiah,
} from '../pricing/utils/calculate-pricing-settings';
import {
  SettingsItemActions,
  SettingsSectionCard,
  SettingsStatusToggle,
} from './SettingsSectionCard';

export function StudioPackageList({
  packages = [],
  sessionTypes = [],
  readOnly = false,
  onAdd,
  onEdit,
  onToggleActive,
  onRequestDelete,
}) {
  const sessionMap = new Map((sessionTypes || []).map((item) => [item.id, item.name]));
  const activeCount = packages.filter((item) => item.isActive !== false).length;

  return (
    <SettingsSectionCard
      sectionId="section-studio-packages-heading"
      order="03"
      title="Studio Packages"
      description="Paket layanan studio bundling durasi dan diskon paket, dilengkapi estimasi internal komisi Staff penjaga studio dan fee Operator Recording."
      countLabel={`${activeCount}/${packages.length} Active`}
      actionLabel="Add Package"
      onAction={onAdd}
      readOnly={readOnly}
      headerNote="Staff Commission dan Recording Operator Commission hanya menjadi snapshot internal booking—tidak pernah ditambahkan ke tagihan customer."
    >
      {packages.length === 0 ? (
        <div className="border-studio-ink bg-studio-ivory border border-dashed p-5 text-center font-mono text-xs">
          Belum ada paket studio. Klik &quot;Add Package&quot; untuk menambahkan paket baru.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="border-studio-ink hidden overflow-x-auto border-2 lg:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-studio-ink bg-studio-ink text-studio-ivory border-b-2 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                <tr>
                  <th className="px-3.5 py-2.5">Package</th>
                  <th className="px-3.5 py-2.5">Session &amp; Duration</th>
                  <th className="px-3.5 py-2.5 text-right">Customer Price</th>
                  <th className="px-3.5 py-2.5 text-right">Internal Fees</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-300">
                {packages.map((pkg) => {
                  const sessionName = sessionMap.get(pkg.sessionTypeId) || pkg.sessionTypeId;
                  const pricePreview = calculatePackageFinalPrice(
                    pkg.basePrice,
                    pkg.discountAmount,
                  );
                  return (
                    <tr
                      key={pkg.id}
                      className={pkg.isActive ? 'bg-studio-white' : 'bg-studio-ivory/60 opacity-80'}
                    >
                      <td className="px-3.5 py-3 align-top">
                        <span className="font-display text-studio-ink block text-lg leading-none font-black uppercase">
                          {pkg.name}
                        </span>
                        {pkg.detail ? (
                          <span className="text-studio-muted-ink mt-1 block text-xs font-medium">
                            {pkg.detail}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3.5 py-3 align-top font-mono">
                        <span className="border-studio-ink bg-studio-ivory inline-block border px-1.5 py-0.5 text-[10px] font-extrabold uppercase">
                          {sessionName}
                        </span>
                        <span className="text-studio-ink mt-1 block font-bold">
                          {formatDurationMinutes(pkg.durationMinutes)}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right align-top font-mono whitespace-nowrap">
                        <span className="text-studio-muted-ink block text-[10px]">
                          Subtotal: {formatRupiah(pricePreview.basePrice)}
                        </span>
                        <span className="block text-[10px] text-emerald-800">
                          Diskon: -{formatRupiah(pricePreview.discountAmount)}
                        </span>
                        <span className="text-studio-ink mt-0.5 block text-sm font-extrabold">
                          {formatRupiah(pricePreview.finalPrice)}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right align-top font-mono whitespace-nowrap">
                        <span className="block text-[11px] font-bold">
                          Staff: {formatRupiah(pkg.staffCommissionAmount)}
                        </span>
                        <span className="text-studio-muted-ink block text-[11px] font-semibold">
                          Operator: {formatRupiah(pkg.recordingOperatorCommissionAmount)}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 align-top">
                        <SettingsStatusToggle
                          isActive={pkg.isActive}
                          label={pkg.name}
                          disabled={readOnly}
                          onToggle={() => onToggleActive(pkg)}
                        />
                      </td>
                      <td className="px-3.5 py-3 align-top">
                        <div className="flex justify-end">
                          <SettingsItemActions
                            itemName={pkg.name}
                            readOnly={readOnly}
                            onEdit={() => onEdit(pkg)}
                            onDelete={() => onRequestDelete(pkg)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / Tablet Stacked Cards */}
          <div className="space-y-3 lg:hidden">
            {packages.map((pkg) => {
              const sessionName = sessionMap.get(pkg.sessionTypeId) || pkg.sessionTypeId;
              const pricePreview = calculatePackageFinalPrice(pkg.basePrice, pkg.discountAmount);
              return (
                <article
                  key={pkg.id}
                  className={`border-studio-ink border-2 p-3.5 ${
                    pkg.isActive ? 'bg-studio-ivory' : 'bg-neutral-100 opacity-85'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="border-studio-ink bg-studio-white border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                          {sessionName}
                        </span>
                        <span className="font-mono text-[10px] font-bold">
                          {formatDurationMinutes(pkg.durationMinutes)}
                        </span>
                      </div>
                      <h4 className="font-display text-studio-ink mt-1.5 text-xl leading-none font-black uppercase">
                        {pkg.name}
                      </h4>
                    </div>

                    <div className="border-studio-ink bg-studio-white border px-2.5 py-1 text-right font-mono">
                      <span className="text-studio-muted-ink block text-[9px] uppercase">
                        Harga Akhir
                      </span>
                      <span className="text-xs font-extrabold">
                        {formatRupiah(pricePreview.finalPrice)}
                      </span>
                    </div>
                  </div>

                  {pkg.detail ? (
                    <p className="text-studio-muted-ink mt-2 text-xs font-medium">{pkg.detail}</p>
                  ) : null}

                  <dl className="border-studio-ink bg-studio-white mt-3 grid grid-cols-2 gap-2 border p-2.5 font-mono text-[11px]">
                    <div>
                      <dt className="text-studio-muted-ink text-[9px] uppercase">Harga Paket</dt>
                      <dd className="font-bold">{formatRupiah(pricePreview.basePrice)}</dd>
                    </div>
                    <div>
                      <dt className="text-studio-muted-ink text-[9px] uppercase">Diskon Paket</dt>
                      <dd className="font-bold text-emerald-800">
                        -{formatRupiah(pricePreview.discountAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-studio-muted-ink text-[9px] uppercase">Staff Fee</dt>
                      <dd className="font-bold">{formatRupiah(pkg.staffCommissionAmount)}</dd>
                    </div>
                    <div>
                      <dt className="text-studio-muted-ink text-[9px] uppercase">Operator Fee</dt>
                      <dd className="font-bold">
                        {formatRupiah(pkg.recordingOperatorCommissionAmount)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-300 pt-2.5">
                    <SettingsStatusToggle
                      isActive={pkg.isActive}
                      label={pkg.name}
                      disabled={readOnly}
                      onToggle={() => onToggleActive(pkg)}
                    />
                    <SettingsItemActions
                      itemName={pkg.name}
                      readOnly={readOnly}
                      onEdit={() => onEdit(pkg)}
                      onDelete={() => onRequestDelete(pkg)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </SettingsSectionCard>
  );
}
