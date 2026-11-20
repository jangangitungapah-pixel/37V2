import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, GitMerge, Loader2, PhoneForwarded, UserPlus, X } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  validateCustomerCreateInput,
  validateCustomerEditInput,
  validateCustomerPhoneUpdateInput,
} from '../schemas/customer-schema';
import { lookupCustomerByPhone, mapCustomerErrorToMessage } from '../services/customer-service';
import { IDENTITY_MATCH_STATUS } from '../utils/customer-identity';
import { formatPhoneDisplay } from '../utils/phone-number';

/**
 * Unified Dialog for:
 * - `mode="create"`: Manual Add Customer (with duplicate phone check before creating separate profile)
 * - `mode="edit"`: Edit Display Name & Notes (preserves old name in aliases)
 * - `mode="phone"`: Update Primary Phone Number (with conflict detection -> Merge or Cancel)
 */
export function CustomerFormDialog({
  open,
  mode = 'create',
  customer = null,
  onOpenChange,
  onSubmitCreate,
  onSubmitEdit,
  onSubmitPhoneUpdate,
  onResolvePhoneConflictWithMerge,
}) {
  const [displayName, setDisplayName] = useState(() =>
    mode === 'edit' && customer ? customer.displayName : '',
  );
  const [phone, setPhone] = useState(() =>
    mode === 'phone' && customer ? '' : customer?.phoneDisplay || '',
  );
  const [notes, setNotes] = useState(() =>
    mode === 'edit' && customer ? customer.notes || '' : '',
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Duplicate / conflict preview state before explicit confirmation
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [phoneConflict, setPhoneConflict] = useState(null);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFieldErrors({});
    setSubmitError('');

    if (mode === 'create') {
      const validation = validateCustomerCreateInput({ displayName, phone, notes });
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        return;
      }

      setIsSubmitting(true);
      try {
        // Check duplicate phone first unless user already confirmed creating a separate profile
        if (!duplicateCheck?.confirmedSeparate) {
          const lookup = await lookupCustomerByPhone({
            phone: validation.data.phoneNormalized,
            inputName: validation.data.displayName,
          });
          if (
            lookup.status !== IDENTITY_MATCH_STATUS.NO_MATCH &&
            lookup.status !== IDENTITY_MATCH_STATUS.HISTORICAL_ONLY &&
            lookup.activeProfiles.length > 0
          ) {
            setDuplicateCheck({
              phoneNormalized: validation.data.phoneNormalized,
              activeProfiles: lookup.activeProfiles,
              confirmedSeparate: false,
            });
            setIsSubmitting(false);
            return;
          }
        }

        await onSubmitCreate?.({
          input: { displayName, phone, notes },
          allowSharedPhone: Boolean(duplicateCheck?.confirmedSeparate),
        });
        onOpenChange?.(false);
      } catch (err) {
        setSubmitError(mapCustomerErrorToMessage(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === 'edit' && customer) {
      const validation = validateCustomerEditInput({ displayName, notes });
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmitEdit?.({
          customerId: customer.id,
          expectedVersion: customer.version,
          input: { displayName, notes },
        });
        onOpenChange?.(false);
      } catch (err) {
        setSubmitError(mapCustomerErrorToMessage(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === 'phone' && customer) {
      const validation = validateCustomerPhoneUpdateInput({ phone });
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        return;
      }

      setIsSubmitting(true);
      setPhoneConflict(null);
      try {
        await onSubmitPhoneUpdate?.({
          customerId: customer.id,
          expectedVersion: customer.version,
          newPhone: validation.data.phoneNormalized,
        });
        onOpenChange?.(false);
      } catch (err) {
        if (err?.code === 'customer/phone-conflict' && err?.details?.conflictingProfiles?.length) {
          setPhoneConflict({
            conflictingProfiles: err.details.conflictingProfiles,
            newPhoneNormalized: err.details.newPhoneNormalized,
            newPhoneDisplay: err.details.newPhoneDisplay,
          });
        } else {
          setSubmitError(mapCustomerErrorToMessage(err));
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const title =
    mode === 'edit'
      ? 'Ubah Data Pelanggan'
      : mode === 'phone'
        ? 'Ganti Nomor HP Utama'
        : 'Tambah Pelanggan Baru';

  const eyebrow =
    mode === 'edit' ? 'UBAH PROFIL' : mode === 'phone' ? 'GANTI NOMOR HP' : 'PELANGGAN BARU';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => (!next ? handleClose() : onOpenChange?.(true))}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label={title}
          data-customer-scoped="true"
          className="sa-dialog fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl rounded-b-none outline-none sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <AdminStatusBadge tone="lime" size="sm" className="uppercase">
                {eyebrow}
              </AdminStatusBadge>
              <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                {title}
              </Dialog.Title>
              <Dialog.Description className="sr-only sm:not-sr-only sm:mt-0.5 sm:block sm:text-xs sm:text-[#666159]">
                {mode === 'phone'
                  ? `Nomor lama ${formatPhoneDisplay(customer?.phoneNormalized)} tetap tersimpan di riwayat nomor lama.`
                  : mode === 'edit'
                    ? 'Mengubah nama akan menyimpan nama sebelumnya ke catatan nama lain tanpa mengubah data booking lama.'
                    : 'Tambahkan data pelanggan baru ke daftar studio.'}
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog customer"
              disabled={isSubmitting}
              className="sa-control inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515] disabled:opacity-50 sm:h-9 sm:w-9 sm:rounded-xl"
            >
              <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-white px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:space-y-4 sm:px-6 sm:py-5"
          >
            {submitError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            ) : null}

            {/* Duplicate warning on Create */}
            {duplicateCheck && !duplicateCheck.confirmedSeparate ? (
              <div
                role="alert"
                className="space-y-3 rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-4 text-xs text-[#8A4B08]"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4B22]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-mono text-[11px] font-semibold text-[#151515] uppercase">
                      Nomor Sudah Terdaftar ({formatPhoneDisplay(duplicateCheck.phoneNormalized)})
                    </p>
                    <p className="mt-1">
                      Profil aktif pada nomor ini:{' '}
                      <strong>
                        {duplicateCheck.activeProfiles.map((p) => p.displayName).join(', ')}
                      </strong>
                      . Pastikan Anda memang ingin membuat profil terpisah pada nomor yang sama.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateCheck((prev) => ({ ...prev, confirmedSeparate: true }));
                    }}
                    className="sa-control sa-btn-lime inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Konfirmasi Buat Profil Terpisah</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateCheck(null)}
                    className="sa-control sa-btn-secondary min-h-9.5 cursor-pointer px-3 py-1.5 text-xs font-semibold"
                  >
                    Periksa Ulang
                  </button>
                </div>
              </div>
            ) : null}

            {/* Phone change conflict warning */}
            {phoneConflict ? (
              <div
                role="alert"
                className="space-y-3 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-4 text-xs text-[#B92B0C]"
              >
                <p className="font-semibold uppercase">Nomor Baru Sudah Digunakan Profil Lain</p>
                <p>
                  Nomor <strong>{phoneConflict.newPhoneDisplay}</strong> saat ini digunakan oleh:{' '}
                  <strong>
                    {phoneConflict.conflictingProfiles.map((p) => p.displayName).join(', ')}
                  </strong>
                  . Nomor tidak diubah otomatis agar profil existing tetap aman.
                </p>
                <div className="flex flex-wrap gap-2">
                  {phoneConflict.conflictingProfiles.map((conflictTarget) => (
                    <button
                      key={conflictTarget.id}
                      type="button"
                      onClick={() => {
                        onResolvePhoneConflictWithMerge?.({
                          targetProfile: conflictTarget,
                          sourceProfile: customer,
                        });
                        onOpenChange?.(false);
                      }}
                      className="sa-control sa-btn-lime inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                    >
                      <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Merge ke {conflictTarget.displayName}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPhoneConflict(null)}
                    className="sa-control sa-btn-secondary min-h-9.5 cursor-pointer px-3 py-1.5 text-xs font-semibold"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : null}

            {mode !== 'phone' ? (
              <div>
                <label
                  htmlFor="customer-form-name"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Nama Customer <span className="text-[#FF4B22]">*</span>
                </label>
                <input
                  id="customer-form-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setDuplicateCheck(null);
                  }}
                  placeholder="Contoh: Arief Music"
                  className="sa-input mt-1.5 min-h-10.5 w-full px-3.5 py-2 text-sm font-medium"
                />
                {fieldErrors.displayName ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                    {fieldErrors.displayName}
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode === 'create' || mode === 'phone' ? (
              <div>
                <label
                  htmlFor="customer-form-phone"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  {mode === 'phone' ? 'Nomor HP / WhatsApp Baru' : 'Nomor HP / WhatsApp'}{' '}
                  <span className="text-[#FF4B22]">*</span>
                </label>
                <input
                  id="customer-form-phone"
                  type="tel"
                  inputMode="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setDuplicateCheck(null);
                    setPhoneConflict(null);
                  }}
                  placeholder="Contoh: 081234567890 atau +6281234567890"
                  className="sa-input mt-1.5 min-h-10.5 w-full px-3.5 py-2 font-mono text-sm font-semibold"
                />
                {fieldErrors.phone ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                    {fieldErrors.phone}
                  </p>
                ) : null}
                {mode === 'phone' ? (
                  <p className="mt-1.5 text-[11px] text-[#666159]">
                    Mengganti nomor utama tidak mengubah catatan nomor HP pada booking yang sudah
                    lewat.
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode !== 'phone' ? (
              <div>
                <label
                  htmlFor="customer-form-notes"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Catatan Profil <span className="font-normal text-[#666159]">(Opsional)</span>
                </label>
                <textarea
                  id="customer-form-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Manager band / kontak utama studio"
                  className="sa-input mt-1.5 w-full px-3.5 py-2.5 text-xs"
                />
                {fieldErrors.notes ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                    {fieldErrors.notes}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2.5 border-t border-[#151515]/[0.08] pt-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleClose}
                className="sa-control sa-btn-secondary min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center gap-2 px-5 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : mode === 'phone' ? (
                  <PhoneForwarded className="h-4 w-4" aria-hidden="true" />
                ) : null}
                <span>
                  {duplicateCheck?.confirmedSeparate
                    ? 'Simpan Profil Terpisah'
                    : mode === 'edit'
                      ? 'Simpan Perubahan'
                      : mode === 'phone'
                        ? 'Perbarui Nomor'
                        : 'Tambah Customer'}
                </span>
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
