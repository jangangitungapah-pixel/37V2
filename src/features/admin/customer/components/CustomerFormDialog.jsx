import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, GitMerge, Loader2, PhoneForwarded, UserPlus, X } from 'lucide-react';

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
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label={title}
          data-customer-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
        >
          {/* Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-block border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-widest uppercase">
                {eyebrow}
              </span>
              <Dialog.Title className="font-display mt-1.5 text-2xl leading-none font-black text-white uppercase sm:text-3xl">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-neutral-300">
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
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
          >
            {submitError ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2 border-2 p-3 text-xs font-bold"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            ) : null}

            {/* Duplicate warning on Create */}
            {duplicateCheck && !duplicateCheck.confirmedSeparate ? (
              <div
                role="alert"
                className="border-studio-ink text-studio-ink space-y-2.5 border-2 bg-amber-100 p-3.5 text-xs"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-mono text-[10px] font-extrabold uppercase">
                      Nomor Sudah Terdaftar ({formatPhoneDisplay(duplicateCheck.phoneNormalized)})
                    </p>
                    <p className="mt-1 font-semibold">
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
                    className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase"
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Konfirmasi Buat Profil Terpisah</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateCheck(null)}
                    className="border-studio-ink bg-studio-white text-studio-ink min-h-10 cursor-pointer border px-3 py-1.5 font-mono text-[10px] font-bold uppercase"
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
                className="border-studio-ink bg-studio-orange/15 text-studio-ink space-y-2.5 border-2 p-3.5 text-xs"
              >
                <p className="font-mono text-[10px] font-extrabold text-[#b92b0c] uppercase">
                  Nomor Baru Sudah Digunakan Profil Lain
                </p>
                <p className="font-semibold">
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
                      className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase"
                    >
                      <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Merge ke {conflictTarget.displayName}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPhoneConflict(null)}
                    className="border-studio-ink bg-studio-white text-studio-ink min-h-10 cursor-pointer border px-3 py-1.5 font-mono text-[10px] font-bold uppercase"
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
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  Nama Customer <span className="text-studio-orange">*</span>
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
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                />
                {fieldErrors.displayName ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {fieldErrors.displayName}
                  </p>
                ) : null}
              </div>
            ) : null}

            {mode === 'create' || mode === 'phone' ? (
              <div>
                <label
                  htmlFor="customer-form-phone"
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  {mode === 'phone' ? 'Nomor HP / WhatsApp Baru' : 'Nomor HP / WhatsApp'}{' '}
                  <span className="text-studio-orange">*</span>
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
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-bold"
                />
                {fieldErrors.phone ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {fieldErrors.phone}
                  </p>
                ) : null}
                {mode === 'phone' ? (
                  <p className="text-studio-muted-ink mt-1.5 text-[11px] font-medium">
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
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  Catatan Profil <span className="text-studio-muted-ink">(Opsional)</span>
                </label>
                <textarea
                  id="customer-form-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Manager band / kontak utama studio"
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 w-full border-2 px-3 py-2 text-xs font-medium"
                />
                {fieldErrors.notes ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {fieldErrors.notes}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="border-studio-ink flex items-center justify-end gap-2.5 border-t pt-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleClose}
                className="brutal-btn bg-studio-white text-studio-ink min-h-11 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 cursor-pointer items-center gap-2 px-5 py-2 font-mono text-xs font-extrabold uppercase disabled:opacity-60"
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
