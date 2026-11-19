import { Dialog } from '@base-ui/react/dialog';
import {
  AlertTriangle,
  CalendarClock,
  GitMerge,
  RotateCcw,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';

import { IDENTITY_MATCH_STATUS } from '../utils/customer-identity';
import { formatPhoneDisplay } from '../utils/phone-number';

export function CustomerIdentityConflictDialog({
  open,
  onOpenChange,
  matchStatus,
  inputName = '',
  phoneNormalized = '',
  activeProfiles = [],
  onSelectMerge,
  onSelectSeparate,
  onReviewAgain,
  allowMerge = true,
}) {
  const isMultiple =
    matchStatus === IDENTITY_MATCH_STATUS.MULTIPLE_MATCHES || activeProfiles.length > 1;
  const singleProfile = activeProfiles[0] || null;
  const formattedPhone = formatPhoneDisplay(phoneNormalized);

  const handleClose = () => {
    onReviewAgain?.();
    onOpenChange?.(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label="Konfirmasi identitas customer"
          data-customer-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
        >
          {/* Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <span className="border-studio-ivory bg-studio-orange text-studio-white inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-widest uppercase">
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>
                  {isMultiple ? 'NOMOR BERSAMA • PILIH PELANGGAN' : 'KONFIRMASI DATA PELANGGAN'}
                </span>
              </span>
              <Dialog.Title className="font-display mt-2 text-2xl leading-none font-black tracking-tight text-white uppercase sm:text-3xl">
                {isMultiple
                  ? 'Pilih Pelanggan yang Sesuai'
                  : 'Nomor telepon sudah digunakan oleh customer lain.'}
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 font-mono text-xs text-neutral-300">
                Nomor HP: <strong className="text-studio-lime">{formattedPhone}</strong>
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog konflik customer"
              onClick={handleClose}
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white transition-colors"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {!isMultiple && singleProfile ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="border-studio-ink bg-studio-white border-2 p-3.5">
                    <span className="text-studio-muted-ink block font-mono text-[10px] font-extrabold uppercase">
                      Sudah Terdaftar
                    </span>
                    <p className="font-display text-studio-ink mt-1 text-xl leading-tight font-black uppercase">
                      {singleProfile.displayName}
                    </p>
                    <p className="text-studio-muted-ink mt-1 font-mono text-[11px] font-bold">
                      {singleProfile.bookingCount} booking
                      {singleProfile.lastBookingDate
                        ? ` • Terakhir ${formatIndonesianDateMedium(singleProfile.lastBookingDate)}`
                        : ''}
                    </p>
                    {singleProfile.nameAliases?.length > 0 ? (
                      <p className="text-studio-subtle-ink mt-1.5 text-[11px] font-medium">
                        Nama lain: {singleProfile.nameAliases.join(', ')}
                      </p>
                    ) : null}
                  </div>

                  <div className="border-studio-ink bg-studio-lime/25 border-2 p-3.5">
                    <span className="text-studio-muted-ink block font-mono text-[10px] font-extrabold uppercase">
                      Nama yang Diisi
                    </span>
                    <p className="font-display text-studio-ink mt-1 text-xl leading-tight font-black uppercase">
                      {inputName || '(Belum diisi)'}
                    </p>
                    <p className="text-studio-muted-ink mt-1 text-[11px] font-semibold">
                      Nama ini tetap tercatat pada detail booking baru.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {allowMerge ? (
                    <button
                      type="button"
                      onClick={() => onSelectMerge?.(singleProfile)}
                      className="brutal-btn bg-studio-lime text-studio-ink flex min-h-12 w-full cursor-pointer items-start gap-3 p-3.5 text-left"
                    >
                      <GitMerge className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <span className="block font-mono text-xs font-extrabold uppercase">
                          Gabungkan ke {singleProfile.displayName}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug font-semibold">
                          Booking masuk ke riwayat {singleProfile.displayName}, nama &ldquo;
                          {inputName}&rdquo; ditambahkan ke alias, dan nama utama profil tidak
                          berubah.
                        </span>
                      </div>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onSelectSeparate?.()}
                    className="brutal-btn bg-studio-white text-studio-ink flex min-h-12 w-full cursor-pointer items-start gap-3 p-3.5 text-left"
                  >
                    <UserPlus className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <span className="block font-mono text-xs font-extrabold uppercase">
                        Buat Profil Terpisah
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug font-medium text-neutral-700">
                        Cocok untuk admin band, manager, atau keluarga yang berbagi nomor sama.
                        Riwayat kedua profil tetap terpisah.
                      </span>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="border-studio-ink bg-studio-white border-2 p-3 text-xs leading-relaxed font-semibold">
                  Nomor <span className="font-mono font-extrabold">{formattedPhone}</span> dipakai
                  oleh <strong>{activeProfiles.length} profil aktif</strong>. Pilih profil yang
                  sesuai untuk booking &ldquo;{inputName || '-'}&rdquo;, atau buat profil terpisah.
                </div>

                <div className="space-y-2.5">
                  {activeProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="border-studio-ink bg-studio-white flex flex-col gap-3 border-2 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-studio-ink text-lg leading-none font-black uppercase">
                            {profile.displayName}
                          </span>
                          <span className="border-studio-ink bg-studio-lime text-studio-ink border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                            {profile.status}
                          </span>
                        </div>
                        <div className="text-studio-muted-ink mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-bold">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" aria-hidden="true" />
                            <span>{profile.bookingCount} booking</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" aria-hidden="true" />
                            <span>
                              {profile.lastBookingDate
                                ? `Terakhir ${formatIndonesianDateMedium(profile.lastBookingDate)}`
                                : 'Belum ada booking'}
                            </span>
                          </span>
                        </div>
                        {profile.nameAliases?.length > 0 ? (
                          <p className="text-studio-subtle-ink mt-1 text-[11px] font-medium">
                            Alias: {profile.nameAliases.join(', ')}
                          </p>
                        ) : null}
                      </div>

                      {allowMerge ? (
                        <button
                          type="button"
                          onClick={() => onSelectMerge?.(profile)}
                          className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-2 font-mono text-[11px] font-extrabold uppercase"
                        >
                          <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Pilih Profil Ini</span>
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectSeparate?.()}
                  className="brutal-btn bg-studio-white text-studio-ink flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs font-extrabold uppercase"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Buat Profil Terpisah dengan Nomor Sama</span>
                </button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-studio-ink bg-studio-white flex shrink-0 items-center justify-end gap-2 border-t-2 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={handleClose}
              className="brutal-btn bg-studio-ivory text-studio-ink inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 font-mono text-xs font-extrabold uppercase"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Periksa Kembali</span>
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
