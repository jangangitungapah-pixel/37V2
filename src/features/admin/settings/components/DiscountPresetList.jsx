import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';

import { formatRupiah } from '../pricing/utils/calculate-pricing-settings';
import {
  SettingsItemActions,
  SettingsSectionCard,
  SettingsStatusToggle,
} from './SettingsSectionCard';

export function DiscountPresetList({
  discounts = [],
  sessionTypes = [],
  onAdd,
  onEdit,
  onToggleActive,
  onRequestDelete,
}) {
  const sessionMap = new Map((sessionTypes || []).map((item) => [item.id, item.name]));
  const activeCount = discounts.filter((item) => item.isActive !== false).length;

  return (
    <SettingsSectionCard
      sectionId="section-discount-presets-heading"
      order="04"
      title="Discount Presets"
      description="Preset diskon otomatis untuk session reguler (non-paket). Ketika membuat booking reguler, Calendar memilih 1 preset aktif yang memenuhi minimum durasi dengan nominal terbesar."
      countLabel={`${activeCount}/${discounts.length} Active`}
      actionLabel="Add Discount"
      onAction={onAdd}
      headerNote="Diskon reguler tidak ditumpuk (no stacking), dibatasi maksimal subtotal sesi, dan tidak diterapkan ganda ke booking Paket Studio."
    >
      {discounts.length === 0 ? (
        <div className="border-studio-ink bg-studio-ivory border border-dashed p-5 text-center">
          <p className="font-mono text-xs font-extrabold uppercase">
            Belum ada Discount Preset aktif
          </p>
          <p className="text-studio-muted-ink mt-1 text-xs">
            Tambahkan preset diskon jika Anda ingin potongan otomatis untuk durasi sesi reguler
            tertentu (misal Rehearsal Promo 3 Jam).
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="border-studio-ink hidden overflow-x-auto border-2 md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-studio-ink bg-studio-ink text-studio-ivory border-b-2 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                <tr>
                  <th className="px-3.5 py-2.5">Discount Name</th>
                  <th className="px-3.5 py-2.5">Session Type</th>
                  <th className="px-3.5 py-2.5">Min. Duration</th>
                  <th className="px-3.5 py-2.5 text-right">Discount Amount</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-300">
                {discounts.map((disc) => {
                  const sessionName = sessionMap.get(disc.sessionTypeId) || disc.sessionTypeId;
                  return (
                    <tr
                      key={disc.id}
                      className={
                        disc.isActive ? 'bg-studio-white' : 'bg-studio-ivory/60 opacity-80'
                      }
                    >
                      <td className="px-3.5 py-3 align-top">
                        <span className="font-display text-studio-ink text-lg leading-none font-black uppercase">
                          {disc.name}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 align-top font-mono">
                        <span className="border-studio-ink bg-studio-ivory inline-block border px-1.5 py-0.5 text-[10px] font-extrabold uppercase">
                          {sessionName}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 align-top font-mono font-bold">
                        Min. {formatDurationMinutes(disc.minimumDurationMinutes)}
                      </td>
                      <td className="px-3.5 py-3 text-right align-top font-mono font-extrabold whitespace-nowrap text-emerald-800">
                        {formatRupiah(disc.discountAmount)}
                      </td>
                      <td className="px-3.5 py-3 align-top">
                        <SettingsStatusToggle
                          isActive={disc.isActive}
                          label={disc.name}
                          onToggle={() => onToggleActive(disc)}
                        />
                      </td>
                      <td className="px-3.5 py-3 align-top">
                        <div className="flex justify-end">
                          <SettingsItemActions
                            itemName={disc.name}
                            onEdit={() => onEdit(disc)}
                            onDelete={() => onRequestDelete(disc)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {discounts.map((disc) => {
              const sessionName = sessionMap.get(disc.sessionTypeId) || disc.sessionTypeId;
              return (
                <article
                  key={disc.id}
                  className={`border-studio-ink border-2 p-3.5 ${
                    disc.isActive ? 'bg-studio-ivory' : 'bg-neutral-100 opacity-85'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="border-studio-ink bg-studio-white border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                          {sessionName}
                        </span>
                        <span className="font-mono text-[10px] font-bold">
                          Min. {formatDurationMinutes(disc.minimumDurationMinutes)}
                        </span>
                      </div>
                      <h4 className="font-display text-studio-ink mt-1.5 text-xl leading-none font-black uppercase">
                        {disc.name}
                      </h4>
                    </div>

                    <span className="border-studio-ink bg-studio-white border px-2 py-1 font-mono text-xs font-extrabold whitespace-nowrap text-emerald-800">
                      -{formatRupiah(disc.discountAmount)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-300 pt-2.5">
                    <SettingsStatusToggle
                      isActive={disc.isActive}
                      label={disc.name}
                      onToggle={() => onToggleActive(disc)}
                    />
                    <SettingsItemActions
                      itemName={disc.name}
                      onEdit={() => onEdit(disc)}
                      onDelete={() => onRequestDelete(disc)}
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
