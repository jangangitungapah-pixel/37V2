import { CalendarClock, ChevronRight, GitMerge, History, Tag } from 'lucide-react';

import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';

import { CUSTOMER_STATUS } from '../utils/customer-identity';

export function CustomerProfileCard({
  profile,
  isGroupedShared = false,
  onSelectProfile,
  onOpenMerge = null,
}) {
  const isArchived = profile.status === CUSTOMER_STATUS.ARCHIVED;
  const hasAliases = Array.isArray(profile.nameAliases) && profile.nameAliases.length > 0;
  const hasPreviousPhones =
    Array.isArray(profile.previousPhones) && profile.previousPhones.length > 0;
  const hasMergedHistory =
    Array.isArray(profile.historyCustomerIds) && profile.historyCustomerIds.length > 1;

  return (
    <article
      className={`border-studio-ink bg-studio-white transition-colors ${
        isGroupedShared ? 'border-t-2 first:border-t-0' : 'brutal-card hover:bg-studio-ivory/40'
      }`}
    >
      <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <button
          type="button"
          onClick={() => onSelectProfile?.(profile)}
          aria-label={`Buka detail profil ${profile.displayName}`}
          className="group min-w-0 flex-1 cursor-pointer text-left"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-display text-studio-ink group-hover:text-studio-orange truncate text-xl leading-none font-black uppercase transition-colors sm:text-2xl">
              {profile.displayName}
            </h3>

            <span
              className={`border-studio-ink border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${
                isArchived ? 'bg-neutral-200 text-neutral-700' : 'bg-studio-lime text-studio-ink'
              }`}
            >
              {isArchived ? 'Archived' : 'Active'}
            </span>

            {hasMergedHistory ? (
              <span className="border-studio-ink bg-studio-ink text-studio-lime inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                <GitMerge className="h-2.5 w-2.5" aria-hidden="true" />
                <span>Merged History</span>
              </span>
            ) : null}

            {profile.sameNameDifferentPhone ? (
              <span className="border-studio-ink text-studio-ink border bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">
                Nama mirip, nomor berbeda
              </span>
            ) : null}
          </div>

          <div className="text-studio-muted-ink mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-bold">
            <span className="text-studio-ink font-extrabold">{profile.bookingCount} booking</span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                {profile.lastBookingDate
                  ? `Terakhir ${formatIndonesianDateMedium(profile.lastBookingDate)}`
                  : 'Belum ada booking'}
              </span>
            </span>
            {hasPreviousPhones ? (
              <span className="inline-flex items-center gap-1 text-neutral-600">
                <History className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{profile.previousPhones.length} nomor lama</span>
              </span>
            ) : null}
          </div>

          {hasAliases ? (
            <div className="text-studio-subtle-ink mt-1.5 flex flex-wrap items-center gap-1 text-[11px] font-medium">
              <Tag className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">Alias: {profile.nameAliases.join(', ')}</span>
            </div>
          ) : null}
        </button>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isGroupedShared && onOpenMerge && !isArchived ? (
            <button
              type="button"
              onClick={() => onOpenMerge(profile)}
              className="border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-lime inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase transition-colors"
            >
              <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Merge</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onSelectProfile?.(profile)}
            className="border-studio-ink bg-studio-ink text-studio-lime hover:bg-studio-orange hover:text-studio-white inline-flex min-h-11 cursor-pointer items-center justify-center gap-1 border-2 px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase transition-colors"
          >
            <span>Detail</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
