import { Fragment } from 'react';
import { CalendarClock, ChevronRight, GitMerge, History, Phone, Tag, Users } from 'lucide-react';

import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { CUSTOMER_STATUS } from '../utils/customer-identity';

export function CustomerDirectoryTable({
  phoneGroups = [],
  bandNamesByCustomerId = new Map(),
  onSelectProfile,
  onOpenMergeGroup,
}) {
  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Tabel daftar customer studio"
      className="overflow-hidden"
    >
      {/* Top Info & Status Legend Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/80 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm">
            Daftar Pelanggan
          </span>

          <div className="hidden flex-wrap items-center gap-2.5 text-[11px] font-medium text-[#666159] sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full bg-[#C8F13A] ring-1 ring-[#658800]/40"
                aria-hidden="true"
              />
              <span>Aktif</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#FF4B22]" aria-hidden="true" />
              <span>Nomor Bersama</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neutral-400" aria-hidden="true" />
              <span>Diarsipkan</span>
            </span>
          </div>
        </div>

        <span className="hidden text-xs text-[#666159] sm:inline">
          Klik nama atau Detail untuk riwayat booking
        </span>
      </div>

      {/* Single-DOM Responsive Table: Genuine <table> on md+, compact stacked rows on < md */}
      <div className="overflow-x-auto">
        <table className="block w-full border-collapse text-left md:table">
          <thead className="hidden border-b border-[#151515]/[0.08] bg-[#FAF8F3] text-[11px] font-semibold tracking-wide text-[#666159] md:table-header-group">
            <tr>
              <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                No. HP / WhatsApp
              </th>
              <th scope="col" className="px-3.5 py-2.5">
                Customer
              </th>
              <th scope="col" className="hidden px-3.5 py-2.5 xl:table-cell">
                Band / Project
              </th>
              <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                Status
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right whitespace-nowrap">
                Booking
              </th>
              <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                Terakhir
              </th>
              <th scope="col" className="px-3.5 py-2.5 text-right whitespace-nowrap">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody className="block divide-y divide-[#151515]/[0.06] md:table-row-group">
            {phoneGroups.map((group) => {
              const activeProfilesInGroup = group.profiles.filter(
                (p) => p.status === CUSTOMER_STATUS.ACTIVE,
              );
              const canMergeGroup = group.isSharedNumber && activeProfilesInGroup.length >= 2;
              const groupKey = group.phoneNormalized || group.profiles[0]?.id;

              return (
                <Fragment key={groupKey}>
                  {group.isSharedNumber ? (
                    <tr className="block border-y border-amber-500/20 bg-[#FEF4DD]/85 first:border-t-0 md:table-row">
                      <td colSpan={7} className="block px-3.5 py-2 md:table-cell">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <AdminStatusBadge
                              tone="orange"
                              icon={Users}
                              size="sm"
                              className="uppercase"
                            >
                              NOMOR BERSAMA • {group.profiles.length} ORANG
                            </AdminStatusBadge>
                            <span className="font-mono text-xs font-semibold text-[#151515]">
                              {group.phoneDisplay}
                            </span>
                            <span className="hidden text-xs text-[#666159] sm:inline">
                              Riwayat booking tetap terpisah per orang
                            </span>
                          </div>

                          {canMergeGroup ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenMergeGroup?.(activeProfilesInGroup, activeProfilesInGroup[0])
                              }
                              aria-label="Merge History"
                              className="sa-control sa-btn-lime inline-flex h-7.5 shrink-0 cursor-pointer items-center justify-center gap-1 px-2.5 text-[11px] font-semibold"
                            >
                              <GitMerge className="h-3 w-3" aria-hidden="true" />
                              <span>Gabung Profil</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}

                  {group.profiles.map((profile) => {
                    const isArchived = profile.status === CUSTOMER_STATUS.ARCHIVED;
                    const hasAliases =
                      Array.isArray(profile.nameAliases) && profile.nameAliases.length > 0;
                    const hasPreviousPhones =
                      Array.isArray(profile.previousPhones) && profile.previousPhones.length > 0;
                    const hasMergedHistory =
                      Array.isArray(profile.historyCustomerIds) &&
                      profile.historyCustomerIds.length > 1;
                    const bands = bandNamesByCustomerId.get(profile.id) || [];

                    const rowBgClass = group.isSharedNumber
                      ? 'border-l-[3px] border-l-[#FF4B22] bg-[#FEF4DD]/30 hover:bg-[#EDF8C2]/25'
                      : 'bg-white hover:bg-[#FAF8F3]/80';

                    return (
                      <tr
                        key={profile.id}
                        className={`group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 px-3 py-2.5 transition-colors md:table-row md:p-0 ${rowBgClass}`}
                      >
                        {/* Col 1: Primary Phone Number */}
                        <td className="col-start-1 row-start-1 min-w-0 md:table-cell md:px-3.5 md:py-3 md:align-middle md:whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Phone
                              className={`h-3.5 w-3.5 shrink-0 ${
                                group.isSharedNumber ? 'text-[#FF4B22]' : 'text-[#8B857B]'
                              }`}
                              aria-hidden="true"
                            />
                            <span className="truncate font-mono text-xs font-semibold text-[#151515]">
                              {group.phoneDisplay}
                            </span>
                          </div>
                          {hasPreviousPhones ? (
                            <div className="mt-0.5 hidden items-center gap-1 font-mono text-[10px] text-[#8B857B] sm:flex">
                              <History className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              <span>{profile.previousPhones.length} nomor lama</span>
                            </div>
                          ) : null}
                        </td>

                        {/* Col 2: Customer Display Name, Aliases & Identity Badges */}
                        <td className="col-span-2 row-start-2 min-w-0 md:table-cell md:px-3.5 md:py-3 md:align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectProfile?.(profile)}
                              className="max-w-full cursor-pointer truncate text-left text-sm font-semibold text-[#151515] transition-colors hover:text-[#FF4B22]"
                            >
                              {profile.displayName}
                            </button>

                            {hasMergedHistory ? (
                              <AdminStatusBadge tone="ink" icon={GitMerge} size="sm">
                                Tergabung
                              </AdminStatusBadge>
                            ) : null}

                            {profile.sameNameDifferentPhone ? (
                              <AdminStatusBadge tone="amber" size="sm">
                                Nama mirip, nomor beda
                              </AdminStatusBadge>
                            ) : null}
                          </div>

                          {hasAliases ? (
                            <div className="mt-0.5 hidden items-center gap-1 text-[11px] text-[#666159] sm:flex">
                              <Tag className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">
                                Nama lain: {profile.nameAliases.join(', ')}
                              </span>
                            </div>
                          ) : null}

                          {bands.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1 xl:hidden">
                              {bands.slice(0, 2).map((band) => (
                                <AdminStatusBadge
                                  key={band}
                                  tone="ivory"
                                  size="sm"
                                  className="max-w-[140px] truncate"
                                >
                                  {band}
                                </AdminStatusBadge>
                              ))}
                              {bands.length > 2 ? (
                                <span className="font-mono text-[10px] text-[#666159]">
                                  +{bands.length - 2}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </td>

                        {/* Col 3: Band / Project (Desktop xl+) */}
                        <td className="hidden xl:table-cell xl:px-3.5 xl:py-3 xl:align-middle">
                          {bands.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {bands.slice(0, 2).map((band) => (
                                <AdminStatusBadge
                                  key={band}
                                  tone="ivory"
                                  size="sm"
                                  className="max-w-[150px] truncate"
                                >
                                  {band}
                                </AdminStatusBadge>
                              ))}
                              {bands.length > 2 ? (
                                <span className="font-mono text-[10px] text-[#666159]">
                                  +{bands.length - 2}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-[#8B857B]">—</span>
                          )}
                        </td>

                        {/* Col 4: Status */}
                        <td className="col-start-2 row-start-1 justify-self-end md:table-cell md:px-3.5 md:py-3 md:align-middle md:whitespace-nowrap">
                          <AdminStatusBadge tone={isArchived ? 'neutral' : 'lime'} size="sm">
                            {isArchived ? 'Arsip' : 'Aktif'}
                          </AdminStatusBadge>
                        </td>

                        {/* Col 5: Total Booking */}
                        <td className="col-start-1 row-start-3 min-w-0 self-center pt-1 md:table-cell md:px-3.5 md:py-3 md:pt-3 md:text-right md:align-middle md:whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 md:block">
                            <span className="font-mono text-xs font-semibold text-[#151515] tabular-nums">
                              {profile.bookingCount} booking
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#666159] md:hidden">
                              <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span>
                                {profile.lastBookingDate
                                  ? formatIndonesianDateMedium(profile.lastBookingDate)
                                  : 'Belum ada'}
                              </span>
                            </span>
                          </div>
                        </td>

                        {/* Col 6: Last Booking Date (md+) */}
                        <td className="hidden md:table-cell md:px-3.5 md:py-3 md:align-middle md:whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#666159]">
                            <CalendarClock
                              className="h-3.5 w-3.5 shrink-0 text-[#8B857B]"
                              aria-hidden="true"
                            />
                            <span>
                              {profile.lastBookingDate
                                ? formatIndonesianDateMedium(profile.lastBookingDate)
                                : 'Belum ada'}
                            </span>
                          </span>
                        </td>

                        {/* Col 7: Compact Row Actions */}
                        <td className="col-start-2 row-start-3 self-center justify-self-end pt-1 md:table-cell md:px-3.5 md:py-3 md:pt-3 md:text-right md:align-middle md:whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {canMergeGroup && !isArchived ? (
                              <button
                                type="button"
                                onClick={() => onOpenMergeGroup?.(activeProfilesInGroup, profile)}
                                className="sa-control sa-btn-secondary inline-flex h-8 cursor-pointer items-center justify-center gap-1 px-2.5 text-xs font-semibold"
                              >
                                <GitMerge className="h-3 w-3 text-[#46433D]" aria-hidden="true" />
                                <span>Gabung</span>
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => onSelectProfile?.(profile)}
                              aria-label={`Buka detail profil ${profile.displayName}`}
                              className="sa-control sa-btn-secondary inline-flex h-8 cursor-pointer items-center justify-center gap-1 px-3 text-xs font-semibold hover:bg-[#C8F13A]"
                            >
                              <span>Detail</span>
                              <ChevronRight
                                className="h-3.5 w-3.5 text-[#666159]"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminSurface>
  );
}
