import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Save } from 'lucide-react';

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
      className="border-studio-ink bg-studio-white sticky bottom-3 z-10 border-2 p-3.5 shadow-[4px_4px_0px_#151515] sm:p-4"
    >
      {hasRemoteVersionConflict ? (
        <div
          role="alert"
          className="border-studio-ink mb-3 flex flex-col gap-2 border bg-amber-100 p-3 text-xs font-bold sm:flex-row sm:items-center sm:justify-between"
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
            className="border-studio-ink bg-studio-white min-h-9 shrink-0 cursor-pointer border px-3 py-1 font-mono text-[11px] font-extrabold uppercase"
          >
            Muat Versi Terbaru
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="border-studio-ink bg-studio-orange text-studio-white mb-3 flex items-start gap-2 border p-3 text-xs font-bold"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="border-studio-ink bg-studio-lime text-studio-ink mb-3 flex items-center gap-2 border p-2.5 text-xs font-extrabold"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <span className="border-studio-ink bg-studio-orange text-studio-white inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-extrabold uppercase">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Unsaved Changes</span>
            </span>
          ) : migratedFromV1 ? (
            <span className="border-studio-ink text-studio-ink inline-flex items-center gap-1.5 border bg-amber-200 px-2.5 py-1 font-mono text-[11px] font-extrabold uppercase">
              <span>Migrasi V1 &rarr; V2 • Siap Disimpan</span>
            </span>
          ) : !isPersisted ? (
            <span className="border-studio-ink text-studio-ink inline-flex items-center gap-1.5 border bg-amber-200 px-2.5 py-1 font-mono text-[11px] font-extrabold uppercase">
              <span>Default Presets • Belum Disimpan</span>
            </span>
          ) : (
            <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-extrabold uppercase">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tersimpan • v{Math.max(1, version)}</span>
            </span>
          )}

          <p className="text-studio-muted-ink font-mono text-[11px] font-semibold">
            {readOnly
              ? 'Mode Baca Saja (Staff/Operator). Perubahan konfigurasi hanya dapat disimpan oleh Owner.'
              : isDirty
                ? 'Perubahan lokal belum tersimpan ke Firestore (settings/pricing).'
                : migratedFromV1
                  ? 'Draft migrasi Catalog V2 dari dokumen V1. Tinjau lalu klik Save Changes untuk menyimpan ke Firestore.'
                  : !isPersisted
                    ? 'Menampilkan default preset Catalog V2. Klik Save Changes untuk menyimpan ke Firestore.'
                    : 'Semua katalog tarif V2 sinkron dengan Cloud Firestore dan Calendar.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isDirty ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={onReset}
              className="brutal-btn bg-studio-ivory text-studio-ink inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-2 font-mono text-xs font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Draft</span>
            </button>
          ) : null}

          <button
            type="button"
            disabled={!canSave}
            onClick={onSave}
            className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 px-5 py-2 font-mono text-xs font-extrabold tracking-wider uppercase disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
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
