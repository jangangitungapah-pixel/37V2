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
import { AdminStatusBadge } from '@/features/admin/design-system';

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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <Dialog.Viewport className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            aria-label="Konfirmasi identitas customer"
            data-customer-scoped="true"
            className="sa-dialog flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl rounded-b-none outline-none sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <AdminStatusBadge tone="orange" icon={AlertTriangle} size="sm" className="uppercase">
                  {isMultiple ? 'Nomor Bersama • Pilih Pelanggan' : 'Konfirmasi Data Pelanggan'}
                </AdminStatusBadge>
                <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                  {isMultiple
                    ? 'Pilih Pelanggan yang Sesuai'
                    : 'Nomor telepon sudah digunakan oleh customer lain.'}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate font-mono text-[11px] text-[#666159] sm:mt-1 sm:text-xs">
                  Nomor HP: <strong className="text-[#151515]">{formattedPhone}</strong>
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup dialog konflik customer"
                onClick={handleClose}
                className="sa-control inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
              >
                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
              </Dialog.Close>
            </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-white px-4 py-3.5 sm:space-y-4 sm:px-6 sm:py-5">
            {!isMultiple && singleProfile ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sa-panel-ivory p-3.5">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Sudah Terdaftar
                    </span>
                    <p className="mt-1 text-base font-bold text-[#151515]">
                      {singleProfile.displayName}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[#666159]">
                      {singleProfile.bookingCount} booking
                      {singleProfile.lastBookingDate
                        ? ` • Terakhir ${formatIndonesianDateMedium(singleProfile.lastBookingDate)}`
                        : ''}
                    </p>
                    {singleProfile.nameAliases?.length > 0 ? (
                      <p className="mt-1.5 text-xs text-[#666159]">
                        Nama lain: {singleProfile.nameAliases.join(', ')}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-[#8BAD12]/35 bg-[#EDF8C2]/45 p-3.5">
                    <span className="block text-[11px] font-medium text-[#243300]">
                      Nama yang Diisi
                    </span>
                    <p className="mt-1 text-base font-bold text-[#151515]">
                      {inputName || '(Belum diisi)'}
                    </p>
                    <p className="mt-1 text-xs text-[#46433D]">
                      Nama ini tetap tercatat pada detail booking baru.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {allowMerge ? (
                    <button
                      type="button"
                      onClick={() => onSelectMerge?.(singleProfile)}
                      className="sa-control sa-btn-lime flex min-h-12 w-full cursor-pointer items-start gap-3 p-3.5 text-left"
                    >
                      <GitMerge className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <span className="block text-xs font-bold">
                          Gabungkan ke {singleProfile.displayName}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug font-normal text-[#243300]">
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
                    className="sa-control sa-btn-secondary flex min-h-12 w-full cursor-pointer items-start gap-3 p-3.5 text-left"
                  >
                    <UserPlus
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#46433D]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-[#151515]">
                        Buat Profil Terpisah
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug font-normal text-[#666159]">
                        Cocok untuk admin band, manager, atau keluarga yang berbagi nomor sama.
                        Riwayat kedua profil tetap terpisah.
                      </span>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="sa-panel-ivory p-3.5 text-xs leading-relaxed text-[#46433D]">
                  Nomor <span className="font-mono font-bold text-[#151515]">{formattedPhone}</span>{' '}
                  dipakai oleh{' '}
                  <strong className="text-[#151515]">{activeProfiles.length} profil aktif</strong>.
                  Pilih profil yang sesuai untuk booking &ldquo;{inputName || '-'}&rdquo;, atau buat
                  profil terpisah.
                </div>

                <div className="space-y-2.5">
                  {activeProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="sa-subcard flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-base font-bold text-[#151515]">
                            {profile.displayName}
                          </span>
                          <AdminStatusBadge tone="lime" size="sm" className="uppercase">
                            {profile.status}
                          </AdminStatusBadge>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[#666159]">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{profile.bookingCount} booking</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {profile.lastBookingDate
                                ? `Terakhir ${formatIndonesianDateMedium(profile.lastBookingDate)}`
                                : 'Belum ada booking'}
                            </span>
                          </span>
                        </div>
                        {profile.nameAliases?.length > 0 ? (
                          <p className="mt-1 text-xs text-[#666159]">
                            Alias: {profile.nameAliases.join(', ')}
                          </p>
                        ) : null}
                      </div>

                      {allowMerge ? (
                        <button
                          type="button"
                          onClick={() => onSelectMerge?.(profile)}
                          className="sa-control sa-btn-lime inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
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
                  className="sa-control sa-btn-secondary flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 px-4 py-2 text-xs font-semibold"
                >
                  <UserPlus className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
                  <span>Buat Profil Terpisah dengan Nomor Sama</span>
                </button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sa-safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-3.5">
            <button
              type="button"
              onClick={handleClose}
              className="sa-control sa-btn-secondary inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold sm:w-auto"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Periksa Kembali</span>
            </button>
          </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
