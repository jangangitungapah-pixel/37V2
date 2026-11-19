import { Fragment } from 'react';
import { CalendarClock, ChevronRight, GitMerge, History, Phone, Tag, Users } from 'lucide-react';

import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';

import { CUSTOMER_STATUS } from '../utils/customer-identity';

export function CustomerDirectoryTable({
  phoneGroups = [],
  bandNamesByCustomerId = new Map(),
  onSelectProfile,
  onOpenMergeGroup,
}) {
  const indexedGroups = phoneGroups.reduce((acc, group) => {
    const startIndex = acc.length > 0 ? acc[acc.length - 1].endIndex : 0;
    const nextEndIndex = startIndex + group.profiles.length;
    acc.push({ group, startIndex, endIndex: nextEndIndex });
    return acc;
  }, []);

  return (
    <section
      aria-label="Tabel daftar customer studio"
      className="cal-card bg-studio-white overflow-hidden"
    >
      {/* Top Info & Status Legend Strip (matches CalendarTimelineGrid rhythm) */}
      <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border-b-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-studio-ink font-mono text-[10px] font-extrabold tracking-wider uppercase">
            CUSTOMER DIRECTORY
          </span>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-[10px] font-bold">
            <span className="inline-flex items-center gap-1">
              <span
                className="bg-studio-lime border-studio-ink h-2.5 w-2.5 border"
                aria-hidden="true"
              />
              <span>Active</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="bg-studio-orange border-studio-ink h-2.5 w-2.5 border"
                aria-hidden="true"
              />
              <span>Shared Number</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="border-studio-ink h-2.5 w-2.5 border bg-neutral-300"
                aria-hidden="true"
              />
              <span>Archived</span>
            </span>
          </div>
        </div>

        <span className="text-studio-muted-ink hidden font-mono text-[9.5px] font-bold uppercase sm:inline">
          Klik nama atau Detail untuk riwayat booking
        </span>
      </div>

      {/* Single-DOM Responsive Table: Genuine <table> on md+, compact stacked rows on < md */}
      <table className="block w-full border-collapse text-left md:table">
        <thead className="border-studio-ink bg-studio-ink text-studio-ivory hidden border-b-2 font-mono text-[10px] font-extrabold tracking-wider uppercase md:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2 whitespace-nowrap">
              No. HP / WhatsApp
            </th>
            <th scope="col" className="px-3 py-2">
              Customer
            </th>
            <th scope="col" className="hidden px-3 py-2 xl:table-cell">
              Band / Project
            </th>
            <th scope="col" className="px-3 py-2 whitespace-nowrap">
              Status
            </th>
            <th scope="col" className="px-3 py-2 text-right whitespace-nowrap">
              Booking
            </th>
            <th scope="col" className="px-3 py-2 whitespace-nowrap">
              Terakhir
            </th>
            <th scope="col" className="px-3 py-2 text-right whitespace-nowrap">
              Aksi
            </th>
          </tr>
        </thead>

        <tbody className="block divide-y divide-neutral-200 md:table-row-group">
          {indexedGroups.map(({ group, startIndex }) => {
            const activeProfilesInGroup = group.profiles.filter(
              (p) => p.status === CUSTOMER_STATUS.ACTIVE,
            );
            const canMergeGroup = group.isSharedNumber && activeProfilesInGroup.length >= 2;
            const groupKey = group.phoneNormalized || group.profiles[0]?.id;

            return (
              <Fragment key={groupKey}>
                {group.isSharedNumber ? (
                  <tr className="border-studio-ink block border-y-2 bg-amber-100/90 first:border-t-0 md:table-row">
                    <td colSpan={7} className="block px-3 py-1.5 md:table-cell md:px-3 md:py-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="border-studio-ink bg-studio-orange text-studio-white inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase">
                            <Users className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                            <span>SHARED NUMBER • {group.profiles.length} PROFIL</span>
                          </span>
                          <span className="text-studio-ink font-mono text-[11px] font-extrabold">
                            {group.phoneDisplay}
                          </span>
                          <span className="hidden text-[11px] font-medium text-neutral-700 sm:inline">
                            Riwayat booking tetap terpisah per profil
                          </span>
                        </div>

                        {canMergeGroup ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenMergeGroup?.(activeProfilesInGroup, activeProfilesInGroup[0])
                            }
                            className="border-studio-ink bg-studio-lime text-studio-ink hover:bg-studio-ink hover:text-studio-lime inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 border px-2 font-mono text-[9.5px] font-extrabold uppercase shadow-[1px_1px_0px_#151515] transition-colors"
                          >
                            <GitMerge className="h-3 w-3" aria-hidden="true" />
                            <span>Merge History</span>
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}

                {group.profiles.map((profile, profileOffset) => {
                  const isEvenRow = (startIndex + profileOffset) % 2 === 1;

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
                    ? 'border-l-4 border-l-studio-orange bg-amber-50/35 hover:bg-studio-lime/20'
                    : isEvenRow
                      ? 'bg-studio-ivory/40 hover:bg-studio-lime/15'
                      : 'bg-studio-white hover:bg-studio-lime/15';

                  return (
                    <tr
                      key={profile.id}
                      className={`group block px-3 py-2.5 transition-colors md:table-row md:p-0 ${rowBgClass}`}
                    >
                      {/* Col 1: Primary Phone Number (Phone-First Identity) */}
                      <td className="block md:table-cell md:px-3 md:py-2 md:align-middle md:whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Phone
                            className={`h-3 w-3 shrink-0 ${
                              group.isSharedNumber ? 'text-studio-orange' : 'text-studio-muted-ink'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="text-studio-ink font-mono text-[11px] font-extrabold">
                            {group.phoneDisplay}
                          </span>
                        </div>
                        {hasPreviousPhones ? (
                          <div className="text-studio-subtle-ink mt-0.5 flex items-center gap-1 font-mono text-[9.5px] font-semibold">
                            <History className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                            <span>{profile.previousPhones.length} nomor lama</span>
                          </div>
                        ) : null}
                      </td>

                      {/* Col 2: Customer Display Name, Aliases & Identity Badges */}
                      <td className="mt-1 block min-w-0 md:mt-0 md:table-cell md:px-3 md:py-2 md:align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectProfile?.(profile)}
                            className="text-studio-ink hover:text-studio-orange max-w-full cursor-pointer truncate text-left text-xs font-extrabold transition-colors sm:text-[13px]"
                          >
                            {profile.displayName}
                          </button>

                          {hasMergedHistory ? (
                            <span className="border-studio-ink bg-studio-ink text-studio-lime inline-flex items-center gap-0.5 border px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold uppercase">
                              <GitMerge className="h-2.5 w-2.5" aria-hidden="true" />
                              <span>Merged</span>
                            </span>
                          ) : null}

                          {profile.sameNameDifferentPhone ? (
                            <span className="border-studio-ink text-studio-ink border bg-amber-100 px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase">
                              Nama mirip, nomor berbeda
                            </span>
                          ) : null}
                        </div>

                        {hasAliases ? (
                          <div className="text-studio-subtle-ink mt-0.5 flex items-center gap-1 text-[10.5px] font-medium">
                            <Tag className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              Alias: {profile.nameAliases.join(', ')}
                            </span>
                          </div>
                        ) : null}

                        {bands.length > 0 ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1 xl:hidden">
                            {bands.slice(0, 2).map((band) => (
                              <span
                                key={band}
                                className="border-studio-ink/40 bg-studio-ivory text-studio-ink max-w-[140px] truncate border px-1.5 py-0 font-mono text-[9px] font-bold"
                              >
                                {band}
                              </span>
                            ))}
                            {bands.length > 2 ? (
                              <span className="text-studio-muted-ink font-mono text-[9px] font-bold">
                                +{bands.length - 2}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </td>

                      {/* Col 3: Band / Project (Desktop xl+) */}
                      <td className="hidden xl:table-cell xl:px-3 xl:py-2 xl:align-middle">
                        {bands.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {bands.slice(0, 2).map((band) => (
                              <span
                                key={band}
                                className="border-studio-ink/40 bg-studio-ivory text-studio-ink max-w-[150px] truncate border px-1.5 py-0.5 font-mono text-[9.5px] font-bold"
                              >
                                {band}
                              </span>
                            ))}
                            {bands.length > 2 ? (
                              <span className="text-studio-muted-ink font-mono text-[9.5px] font-bold">
                                +{bands.length - 2}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Col 4: Status */}
                      <td className="mt-1.5 mr-2 inline-flex items-center md:mt-0 md:mr-0 md:table-cell md:px-3 md:py-2 md:align-middle md:whitespace-nowrap">
                        <span
                          className={`border-studio-ink border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${
                            isArchived
                              ? 'bg-neutral-200 text-neutral-700'
                              : 'bg-studio-lime text-studio-ink'
                          }`}
                        >
                          {isArchived ? 'Archived' : 'Active'}
                        </span>
                      </td>

                      {/* Col 5: Total Booking */}
                      <td className="mt-1.5 mr-3 inline-flex items-center md:mt-0 md:mr-0 md:table-cell md:px-3 md:py-2 md:text-right md:align-middle md:whitespace-nowrap">
                        <span className="text-studio-ink font-mono text-[11px] font-extrabold tabular-nums">
                          {profile.bookingCount} booking
                        </span>
                      </td>

                      {/* Col 6: Last Booking Date */}
                      <td className="mt-1.5 inline-flex items-center md:mt-0 md:table-cell md:px-3 md:py-2 md:align-middle md:whitespace-nowrap">
                        <span className="text-studio-muted-ink inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold">
                          <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>
                            {profile.lastBookingDate
                              ? formatIndonesianDateMedium(profile.lastBookingDate)
                              : 'Belum ada'}
                          </span>
                        </span>
                      </td>

                      {/* Col 7: Compact Row Actions */}
                      <td className="mt-2 flex items-center justify-end border-t border-neutral-200/80 pt-2 md:mt-0 md:table-cell md:border-t-0 md:px-3 md:py-2 md:text-right md:align-middle md:whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {canMergeGroup && !isArchived ? (
                            <button
                              type="button"
                              onClick={() => onOpenMergeGroup?.(activeProfilesInGroup, profile)}
                              className="border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-lime inline-flex h-8 cursor-pointer items-center justify-center gap-1 border px-2 font-mono text-[9.5px] font-extrabold uppercase transition-colors"
                            >
                              <GitMerge className="h-3 w-3" aria-hidden="true" />
                              <span>Merge</span>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => onSelectProfile?.(profile)}
                            aria-label={`Buka detail profil ${profile.displayName}`}
                            className="border-studio-ink bg-studio-ink text-studio-lime hover:bg-studio-orange hover:text-studio-white inline-flex h-8 cursor-pointer items-center justify-center gap-1 border px-2.5 font-mono text-[9.5px] font-extrabold uppercase transition-colors"
                          >
                            <span>Detail</span>
                            <ChevronRight className="h-3 w-3" aria-hidden="true" />
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
    </section>
  );
}
