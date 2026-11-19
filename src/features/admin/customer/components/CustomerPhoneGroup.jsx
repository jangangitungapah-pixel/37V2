import { GitMerge, Phone, Users } from 'lucide-react';

import { CUSTOMER_STATUS } from '../utils/customer-identity';
import { CustomerProfileCard } from './CustomerProfileCard';

export function CustomerPhoneGroup({ group, onSelectProfile, onOpenMergeGroup }) {
  const activeProfilesInGroup = group.profiles.filter((p) => p.status === CUSTOMER_STATUS.ACTIVE);
  const canMergeGroup = group.isSharedNumber && activeProfilesInGroup.length >= 2;

  if (!group.isSharedNumber && group.profiles.length === 1) {
    const singleProfile = group.profiles[0];
    return (
      <section
        aria-label={`Nomor ${group.phoneDisplay}`}
        className="brutal-card bg-studio-white overflow-hidden"
      >
        <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border-b-2 px-3.5 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Phone className="text-studio-ink h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="text-studio-ink truncate font-mono text-xs font-extrabold">
              {group.phoneDisplay}
            </span>
          </div>
          <span className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
            1 Profil
          </span>
        </div>

        <CustomerProfileCard
          profile={singleProfile}
          isGroupedShared
          onSelectProfile={onSelectProfile}
        />
      </section>
    );
  }

  return (
    <section
      aria-label={`Shared number ${group.phoneDisplay} (${group.profiles.length} profil)`}
      className="brutal-card-lg border-studio-ink bg-studio-white overflow-hidden"
    >
      {/* Shared Number Header */}
      <div className="border-studio-ink bg-studio-ink text-studio-ivory flex flex-col gap-2.5 border-b-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-studio-ivory bg-studio-orange text-studio-white inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase">
              <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>SHARED NUMBER • {group.profiles.length} PROFIL</span>
            </span>
            <span className="font-mono text-xs font-extrabold text-white">
              {group.phoneDisplay}
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-neutral-300">
            Riwayat booking masing-masing profil tetap terpisah meskipun menggunakan nomor telepon
            yang sama.
          </p>
        </div>

        {canMergeGroup ? (
          <button
            type="button"
            onClick={() => onOpenMergeGroup?.(activeProfilesInGroup, activeProfilesInGroup[0])}
            className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-1.5 font-mono text-[11px] font-extrabold uppercase"
          >
            <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Merge History</span>
          </button>
        ) : null}
      </div>

      {/* Separated Profiles List */}
      <div className="divide-studio-ink divide-y-2">
        {group.profiles.map((profile) => (
          <CustomerProfileCard
            key={profile.id}
            profile={profile}
            isGroupedShared
            onSelectProfile={onSelectProfile}
            onOpenMerge={
              canMergeGroup
                ? (clickedProfile) => onOpenMergeGroup?.(activeProfilesInGroup, clickedProfile)
                : null
            }
          />
        ))}
      </div>
    </section>
  );
}
