import { Mic2 } from 'lucide-react';

import { formatRupiah } from '../pricing/utils/calculate-pricing-settings';
import {
  SettingsItemActions,
  SettingsSectionCard,
  SettingsStatusToggle,
} from './SettingsSectionCard';

export function SessionTypeList({
  sessionTypes = [],
  onAdd,
  onEdit,
  onToggleActive,
  onRequestDelete,
}) {
  const activeCount = sessionTypes.filter((item) => item.isActive !== false).length;

  return (
    <SettingsSectionCard
      sectionId="section-session-types-heading"
      order="01"
      title="Session Types"
      description="Kategori layanan studio beserta tarif dasar per jam. Hanya session berstatus Active yang muncul sebagai pilihan booking baru di Calendar."
      countLabel={`${activeCount}/${sessionTypes.length} Active`}
      actionLabel="Add Session Type"
      onAction={onAdd}
      headerNote="Session Recording otomatis terhubung ke konfigurasi Recording Options pada Section 02. Session lama yang di-nonaktifkan tetap terbaca pada snapshot booking historis."
    >
      {sessionTypes.length === 0 ? (
        <div className="border-studio-ink bg-studio-ivory border border-dashed p-5 text-center font-mono text-xs">
          Belum ada session type. Tambahkan minimal satu session aktif.
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="border-studio-ink hidden overflow-x-auto border-2 md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-studio-ink bg-studio-ink text-studio-ivory border-b-2 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                <tr>
                  <th className="px-3.5 py-2.5">Session Name</th>
                  <th className="px-3.5 py-2.5">Description</th>
                  <th className="px-3.5 py-2.5 text-right">Hourly Rate</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-300">
                {sessionTypes.map((item) => (
                  <tr
                    key={item.id}
                    className={item.isActive ? 'bg-studio-white' : 'bg-studio-ivory/60 opacity-80'}
                  >
                    <td className="px-3.5 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-studio-ink text-lg leading-none font-black uppercase">
                          {item.name}
                        </span>
                        {item.id === 'recording' ? (
                          <span className="border-studio-ink bg-studio-ivory inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                            <Mic2 className="h-2.5 w-2.5" aria-hidden="true" />
                            <span>Recording Options</span>
                          </span>
                        ) : null}
                      </div>
                      <span className="text-studio-muted-ink mt-1 block font-mono text-[10px]">
                        ID: {item.id}
                      </span>
                    </td>
                    <td className="text-studio-muted-ink px-3.5 py-3 align-top font-medium">
                      {item.description || '-'}
                    </td>
                    <td className="px-3.5 py-3 text-right align-top font-mono font-extrabold whitespace-nowrap">
                      {formatRupiah(item.hourlyRate)}/jam
                    </td>
                    <td className="px-3.5 py-3 align-top">
                      <SettingsStatusToggle
                        isActive={item.isActive}
                        label={item.name}
                        onToggle={() => onToggleActive(item)}
                      />
                    </td>
                    <td className="px-3.5 py-3 align-top">
                      <div className="flex justify-end">
                        <SettingsItemActions
                          itemName={item.name}
                          onEdit={() => onEdit(item)}
                          onDelete={() => onRequestDelete(item)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="space-y-3 md:hidden">
            {sessionTypes.map((item) => (
              <article
                key={item.id}
                className={`border-studio-ink border-2 p-3.5 ${
                  item.isActive ? 'bg-studio-ivory' : 'bg-neutral-100 opacity-85'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-display text-studio-ink text-xl leading-none font-black uppercase">
                      {item.name}
                    </h4>
                    <p className="text-studio-muted-ink mt-1 font-mono text-[10px]">
                      ID: {item.id}
                    </p>
                  </div>
                  <span className="border-studio-ink bg-studio-white border px-2 py-1 font-mono text-xs font-extrabold whitespace-nowrap">
                    {formatRupiah(item.hourlyRate)}/jam
                  </span>
                </div>

                {item.description ? (
                  <p className="text-studio-muted-ink mt-2 text-xs font-medium">
                    {item.description}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-300 pt-2.5">
                  <SettingsStatusToggle
                    isActive={item.isActive}
                    label={item.name}
                    onToggle={() => onToggleActive(item)}
                  />
                  <SettingsItemActions
                    itemName={item.name}
                    onEdit={() => onEdit(item)}
                    onDelete={() => onRequestDelete(item)}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </SettingsSectionCard>
  );
}
