import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Link2, Loader2, ShieldCheck, X } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  linkLegacyClientAccountToCustomer,
  listOwnerEligibleClientAccounts,
  mapClientIdentityLinkError,
} from '@/features/client-portal/services/client-identity-link-service';

export function ClientIdentityLinkDialog({
  open,
  onOpenChange,
  customer,
  actorUid,
  actorRole,
  onComplete,
}) {
  const requestKey = open && customer?.id ? `${actorUid}:${actorRole}:${customer.id}` : '';
  const [candidateResult, setCandidateResult] = useState({
    key: '',
    accounts: [],
    error: '',
  });
  const [selectedUid, setSelectedUid] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!requestKey) return undefined;

    let cancelled = false;
    listOwnerEligibleClientAccounts({ actorUid, actorRole })
      .then((accounts) => {
        if (cancelled) return;
        setCandidateResult({
          key: requestKey,
          accounts: Array.isArray(accounts) ? accounts : [],
          error: '',
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCandidateResult({
          key: requestKey,
          accounts: [],
          error: 'Daftar akun Client tidak dapat dimuat. Pastikan sesi Owner masih aktif.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, actorUid, actorRole]);

  if (!customer) return null;

  const accounts = candidateResult.key === requestKey ? candidateResult.accounts : [];
  const isLoadingCandidates = Boolean(requestKey && candidateResult.key !== requestKey);
  const candidateError = candidateResult.key === requestKey ? candidateResult.error : '';
  const selectedAccount = accounts.find((account) => account.uid === selectedUid) || null;
  const canSubmit =
    Boolean(selectedAccount) &&
    reviewReason.trim().length >= 10 &&
    reviewReason.trim().length <= 1000 &&
    !isSubmitting &&
    !isLoadingCandidates;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const result = await linkLegacyClientAccountToCustomer({
        actorUid,
        actorRole,
        clientUid: selectedAccount.uid,
        targetCustomerId: customer.id,
        reviewReason: reviewReason.trim(),
      });
      onComplete?.(result);
      onOpenChange?.(false);
    } catch (error) {
      setSubmitError(mapClientIdentityLinkError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[70]"
        />
        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label="Review identity Client"
          className="sa-dialog fixed top-1/2 left-1/2 z-[71] max-h-[min(88dvh,760px)] w-[min(96vw,620px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[#151515]/10 bg-[#FAF8F3] p-4 shadow-2xl outline-none sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#151515]/10 bg-white text-[#151515]">
                <Link2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <AdminStatusBadge tone="ink" size="sm">OWNER REVIEW</AdminStatusBadge>
                  <AdminStatusBadge tone="amber" size="sm">Manual identity decision</AdminStatusBadge>
                </div>
                <Dialog.Title className="text-base font-bold tracking-tight text-[#151515] sm:text-lg">
                  Hubungkan akun Client ke CRM
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-relaxed text-[#666159]">
                  Pilih satu akun Client terisolasi dan tautkan ke Customer CRM yang sedang dibuka.
                  Tidak ada pencocokan otomatis.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              aria-label="Tutup"
              className="sa-control inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#151515]/10 bg-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="mt-4 rounded-2xl border border-[#151515]/10 bg-white/85 p-3.5">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#8B857B] uppercase">
              CRM target yang dipilih
            </p>
            <p className="mt-1 text-sm font-bold text-[#151515]">{customer.displayName}</p>
            <p className="mt-0.5 font-mono text-[11px] text-[#666159]">
              {customer.phoneDisplay || customer.phoneNormalized || 'Nomor tidak tersedia'}
            </p>
            <p className="mt-1 break-all font-mono text-[10px] text-[#8B857B]">{customer.id}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="identity-link-client-account" className="text-xs font-semibold text-[#151515]">
                Akun Client yang akan dihubungkan
              </label>
              {isLoadingCandidates ? (
                <div role="status" className="flex min-h-11 items-center gap-2 rounded-xl border border-[#151515]/10 bg-white px-3 text-xs text-[#666159]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Memuat akun Client terisolasi...
                </div>
              ) : candidateError ? (
                <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800">
                  {candidateError}
                </p>
              ) : accounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#151515]/20 bg-white/70 p-3 text-xs leading-relaxed text-[#666159]">
                  Tidak ada akun Client aktif berprofil terisolasi yang tersedia untuk ditautkan.
                </div>
              ) : (
                <select
                  id="identity-link-client-account"
                  required
                  value={selectedUid}
                  onChange={(event) => {
                    setSelectedUid(event.target.value);
                    setSubmitError('');
                  }}
                  className="sa-input min-h-11 w-full rounded-xl px-3 py-2 text-xs"
                >
                  <option value="">Pilih akun Client secara manual...</option>
                  {accounts.map((account) => (
                    <option key={account.uid} value={account.uid}>
                      {account.displayName || 'Client'} — {account.emailNormalized} — {account.uid}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[10px] leading-relaxed text-[#8B857B]">
                Kandidat berasal dari akun aktif yang masih memakai profil sintetis client_UID.
                Email atau nomor telepon hanya informasi konteks, bukan bukti kepemilikan.
              </p>
            </div>

            {selectedAccount ? (
              <div className="rounded-xl border border-[#151515]/10 bg-[#EDF8C2]/40 p-3">
                <p className="text-[10px] font-semibold tracking-[0.1em] text-[#526A0A] uppercase">
                  Binding asal yang akan diganti
                </p>
                <p className="mt-1 text-xs font-semibold text-[#151515]">
                  {selectedAccount.displayName} · {selectedAccount.emailNormalized}
                </p>
                <p className="mt-0.5 break-all font-mono text-[10px] text-[#666159]">
                  client_{selectedAccount.uid} → {customer.id}
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label htmlFor="identity-link-review-reason" className="text-xs font-semibold text-[#151515]">
                Catatan verifikasi Owner <span className="text-red-600">*</span>
              </label>
              <textarea
                id="identity-link-review-reason"
                required
                minLength={10}
                maxLength={1000}
                rows={4}
                value={reviewReason}
                onChange={(event) => {
                  setReviewReason(event.target.value);
                  setSubmitError('');
                }}
                placeholder="Catat bagaimana identitas diverifikasi, sumber konfirmasi, dan alasan akun ini merupakan pemilik Customer CRM tersebut..."
                className="sa-input w-full resize-y rounded-xl p-3 text-xs leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2 text-[10px] text-[#8B857B]">
                <span>Wajib 10–1000 karakter. Tersimpan permanen di audit trail.</span>
                <span className="shrink-0 font-mono tabular-nums">{reviewReason.length}/1000</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Pastikan identitas telah diverifikasi langsung. Tindakan ini memberi akun akses ke
                data milik Customer CRM tersebut. Akun yang sudah tertaut ke CRM lain tidak dapat
                dipindahkan melalui workflow ini. Riwayat booking dan transaksi keuangan tidak
                diubah.
              </p>
            </div>

            {submitError ? (
              <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800">
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 border-t border-[#151515]/[0.08] pt-3 sm:flex-row sm:justify-end">
              <Dialog.Close
                type="button"
                className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full px-4 text-xs font-semibold"
              >
                Batal
              </Dialog.Close>
              <button
                type="submit"
                disabled={!canSubmit}
                className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isSubmitting ? 'Menyimpan...' : 'Konfirmasi & Hubungkan'}</span>
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
