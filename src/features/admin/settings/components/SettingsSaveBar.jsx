import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Save } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

export function SettingsSaveBar({
  isDirty,
  isPersisted,
  migratedFromV1 = false,
  isSaving,
  isLoading,
  readOnly = false,
  version,
  hasRemoteVersionConflict,
  errorMessage,
  successMessage,
  onSave,
  onReset,
  onReloadRemote,
}) {
  const canSave =
    !readOnly && (isDirty || !isPersisted || migratedFromV1) && !isSaving && !isLoading;

  return (
    <div
      role="region"
      aria-label="Kontrol penyimpanan Price and Fee Settings"
      className="sticky bottom-2 z-10 rounded-2xl border border-[#151515]/12 bg-white/92 p-2.5 shadow-[0_14px_34px_-10px_rgba(21,21,21,0.16)] backdrop-blur-md sm:bottom-3 sm:p-4"
    >
      {hasRemoteVersionConflict ? (
        <div
          role="alert"
          className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-3 text-xs font-medium text-[#8A4B08] sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="inline-flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Konfigurasi di Firestore diperbarui oleh sesi lain. Anda bisa memuat versi terbaru
              agar tidak menimpa perubahan tersebut.
            </span>
          </span>
          <button
            type="button"
            onClick={onReloadRemote}
            className="sa-control sa-btn-secondary min-h-9 shrink-0 cursor-pointer px-3 py-1 text-xs font-semibold"
          >
            Muat Versi Terbaru
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex items-center gap-2 rounded-xl border border-[#8BAD12]/35 bg-[#EDF8C2] p-2.5 text-xs font-semibold text-[#243300]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          {isDirty ? (
            <AdminStatusBadge tone="orange" icon={AlertTriangle}>
              Unsaved Changes
            </AdminStatusBadge>
          ) : migratedFromV1 ? (
            <AdminStatusBadge tone="amber">Migrasi V1 → V2 • Siap Disimpan</AdminStatusBadge>
          ) : !isPersisted ? (
            <AdminStatusBadge tone="amber">Default Presets • Belum Disimpan</AdminStatusBadge>
          ) : (
            <AdminStatusBadge tone="lime" icon={CheckCircle2}>
              Tersimpan • v{Math.max(1, version)}
            </AdminStatusBadge>
          )}

          <p className="hidden text-xs text-[#666159] sm:block">
            {readOnly
              ? 'Mode Baca Saja (Staff/Operator). Perubahan tarif hanya dapat disimpan oleh Owner.'
              : isDirty
                ? 'Ada perubahan yang belum disimpan.'
                : migratedFromV1
                  ? 'Penyesuaian tarif versi baru siap disimpan. Tinjau kembali lalu klik Save Changes.'
                  : !isPersisted
                    ? 'Menampilkan daftar tarif standar. Klik Save Changes untuk menyimpan.'
                    : 'Daftar tarif sudah tersimpan dan aktif di Calendar.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isDirty ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={onReset}
              className="sa-control sa-btn-secondary inline-flex min-h-10.5 flex-1 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Draft</span>
            </button>
          ) : null}

          <button
            type="button"
            disabled={!canSave}
            onClick={onSave}
            className="sa-control sa-btn-orange inline-flex min-h-10.5 flex-1 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
