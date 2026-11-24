import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, KeyRound, Loader2, ShieldAlert, Trash2, X } from 'lucide-react';

import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';

import { FACTORY_RESET_CONFIRMATION_PHRASE } from '../config/factory-reset-config';
import { reauthenticateOwnerForFactoryReset } from '../services/factory-reset-auth-service';
import { formatResetErrorForDisplay } from '../utils/factory-reset-manifest';
import { isConfirmationPhraseValid } from '../utils/factory-reset-validation';

export function FactoryResetConfirmDialog({
  open,
  onOpenChange,
  preflight = null,
  actor = null,
  reauthenticate,
  isExecuting = false,
  onExecuteReset,
}) {
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [reauthError, setReauthError] = useState('');
  const [verifiedReauthAt, setVerifiedReauthAt] = useState(null);

  const [phraseInput, setPhraseInput] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && (isReauthenticating || isSubmitting || isExecuting)) {
      return;
    }
    if (!nextOpen) {
      setStep(1);
      setPassword('');
      setReauthError('');
      setVerifiedReauthAt(null);
      setPhraseInput('');
      setAcknowledged(false);
      setSubmitError('');
    }
    onOpenChange(nextOpen);
  };

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (isReauthenticating) return;

    setReauthError('');
    setIsReauthenticating(true);
    const currentPassword = password;
    setPassword('');

    try {
      const verifiedTimestamp = await reauthenticateOwnerForFactoryReset({
        actor,
        password: currentPassword,
        reauthenticate,
      });
      setVerifiedReauthAt(verifiedTimestamp);
      setStep(3);
    } catch (err) {
      setReauthError(err?.message || 'Gagal memverifikasi password akun Owner.');
    } finally {
      setIsReauthenticating(false);
    }
  };

  const phraseMatches = isConfirmationPhraseValid(phraseInput);
  const canExecuteFinal = Boolean(
    preflight?.isComplete === true &&
    verifiedReauthAt &&
    phraseMatches &&
    acknowledged &&
    !isSubmitting &&
    !isExecuting,
  );

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!canExecuteFinal) return;

    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onExecuteReset?.({
        confirmationPhrase: phraseInput,
        acknowledged,
        reauthenticatedAtOverride: verifiedReauthAt,
      });
      handleOpenChange(false);
    } catch (err) {
      setSubmitError(formatResetErrorForDisplay(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />

        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            data-calendar-scoped="true"
            className="sa-dialog flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl rounded-b-none outline-none sm:rounded-2xl"
          >
            {/* Sticky Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-red-100 bg-red-50/80 px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-700">
                  <ShieldAlert className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <Dialog.Title className="text-base font-bold tracking-tight text-[#151515]">
                    Konfirmasi Factory Reset
                  </Dialog.Title>
                  <p className="font-mono text-[10.5px] font-semibold text-red-800 uppercase">
                    Tahap {step} dari 3 • Tindakan Permanen
                  </p>
                </div>
              </div>

              <Dialog.Close
                aria-label="Tutup dialog Factory Reset"
                disabled={isReauthenticating || isSubmitting}
                className="sa-control inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515] disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {step === 1 ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                  <Dialog.Description className="text-xs leading-relaxed text-[#46433D] sm:text-sm">
                    Tinjau ringkasan sebelum melanjutkan ke verifikasi akun Owner.
                  </Dialog.Description>

                  <div className="rounded-xl border border-red-200 bg-red-50/75 p-3.5 text-xs leading-relaxed font-medium text-red-900">
                    Factory Reset akan menghapus seluruh data operasional yang tercantum secara
                    permanen. Data yang sudah dihapus tidak dapat dipulihkan melalui aplikasi.
                  </div>

                  <dl className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3">
                      <dt className="font-mono text-[10px] font-semibold text-[#756F65] uppercase">
                        Target Dihapus
                      </dt>
                      <dd className="mt-1 font-bold text-red-700">
                        {preflight?.totalDeleteOperations ?? '-'} dokumen operasional
                      </dd>
                    </div>
                    <div className="rounded-xl border border-[#8BAD12]/35 bg-[#F4FBE0] p-3">
                      <dt className="font-mono text-[10px] font-semibold text-[#243300] uppercase">
                        Target Dipertahankan
                      </dt>
                      <dd className="mt-1 font-bold text-[#151515]">
                        Akun Admin, Config, Galeri, Templates
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="sa-safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5 sm:px-5">
                  <AdminButton
                    variant="secondary"
                    onClick={() => handleOpenChange(false)}
                    className="min-h-11 w-full sm:w-auto"
                  >
                    Batal
                  </AdminButton>
                  <AdminButton
                    variant="danger"
                    onClick={() => setStep(2)}
                    className="min-h-11 w-full sm:w-auto"
                  >
                    Lanjut: Verifikasi Password
                  </AdminButton>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <form onSubmit={handleVerifyPassword} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                  <Dialog.Description className="text-xs leading-relaxed text-[#46433D] sm:text-sm">
                    Masukkan ulang password akun Owner (<strong>{actor?.user?.email}</strong>) untuk
                    memvalidasi sesi Firebase Authentication sebelum tindakan destruktif.
                  </Dialog.Description>

                  <div>
                    <label
                      htmlFor="factory-reset-reauth-password"
                      className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#151515]"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                      <span>Password Akun Owner Saat Ini</span>
                    </label>
                    <input
                      id="factory-reset-reauth-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isReauthenticating}
                      className="min-h-11 w-full rounded-xl border border-[#151515]/20 bg-white px-3.5 py-2.5 text-sm text-[#151515] outline-none focus:border-[#151515]"
                      placeholder="Masukkan password Anda..."
                      required
                    />
                  </div>

                  {reauthError ? (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
                    >
                      {reauthError}
                    </p>
                  ) : null}
                </div>

                <div className="sa-safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-5">
                  <AdminButton
                    variant="secondary"
                    onClick={() => setStep(1)}
                    disabled={isReauthenticating}
                    className="min-h-11 w-full sm:w-auto"
                  >
                    Kembali
                  </AdminButton>
                  <AdminButton
                    type="submit"
                    variant="primary"
                    disabled={isReauthenticating || password.length === 0}
                    className="min-h-11 w-full sm:w-auto"
                  >
                    {isReauthenticating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>Memverifikasi...</span>
                      </>
                    ) : (
                      <span>Verifikasi Password</span>
                    )}
                  </AdminButton>
                </div>
              </form>
            ) : null}

            {step === 3 ? (
              <form onSubmit={handleFinalSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <AdminStatusBadge tone="lime" dot size="sm">
                      Re-autentikasi Berhasil
                    </AdminStatusBadge>
                  </div>

                  <Dialog.Description className="text-xs leading-relaxed text-[#46433D] sm:text-sm">
                    Ketik frasa konfirmasi berikut secara manual tanpa salin-tempel:
                  </Dialog.Description>

                  <div className="rounded-xl border border-[#151515]/15 bg-[#FAF8F3] px-3.5 py-2 text-center font-mono text-xs font-bold tracking-wider text-[#151515]">
                    {FACTORY_RESET_CONFIRMATION_PHRASE}
                  </div>

                  <div>
                    <label
                      htmlFor="factory-reset-confirm-phrase"
                      className="mb-1.5 block text-xs font-semibold text-[#151515]"
                    >
                      Frasa Konfirmasi Manual
                    </label>
                    <input
                      id="factory-reset-confirm-phrase"
                      type="text"
                      autoComplete="off"
                      value={phraseInput}
                      onChange={(e) => setPhraseInput(e.target.value)}
                      onPaste={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      disabled={isSubmitting}
                      className="min-h-11 w-full rounded-xl border border-[#151515]/20 bg-white px-3.5 py-2.5 font-mono text-xs font-semibold text-[#151515] outline-none focus:border-red-600"
                      placeholder="Ketik RESET 37 MUSIC STUDIO"
                    />
                  </div>

                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/50 p-3 text-xs leading-relaxed text-[#151515]">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      disabled={isSubmitting}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
                    />
                    <span>
                      Saya memahami bahwa data operasional yang tercantum akan dihapus permanen.
                    </span>
                  </label>

                  {submitError ? (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{submitError}</span>
                    </p>
                  ) : null}
                </div>

                <div className="sa-safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-5">
                  <AdminButton
                    variant="secondary"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSubmitting}
                    className="min-h-11 w-full sm:w-auto"
                  >
                    Batal
                  </AdminButton>
                  <AdminButton
                    type="submit"
                    variant="danger"
                    disabled={!canExecuteFinal}
                    className="min-h-11 w-full sm:w-auto"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Memulai Reset...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span>DELETE ALL OPERATIONAL DATA</span>
                      </>
                    )}
                  </AdminButton>
                </div>
              </form>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
