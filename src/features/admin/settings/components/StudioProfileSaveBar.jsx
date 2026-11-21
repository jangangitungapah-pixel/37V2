import { Loader2, RotateCcw, Save } from 'lucide-react';

import { AdminButton, AdminSurface } from '@/features/admin/design-system';

export function StudioProfileSaveBar({ isDirty, isSaving, onDiscard }) {
  return (
    <AdminSurface
      variant={isDirty ? 'card' : 'subcard'}
      className={
        isDirty ? 'sticky bottom-3 z-20 border-[#151515]/25 p-3.5 shadow-lg sm:p-4' : 'p-3.5 sm:p-4'
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#151515] sm:text-sm">
            {isDirty
              ? 'Ada perubahan profil studio yang belum disimpan'
              : 'Semua perubahan profil studio sudah sinkron'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#666159]">
            {isDirty
              ? 'Klik Simpan Profil untuk menulis pembaruan ke Firestore.'
              : 'Ubah salah satu kolom di atas untuk mengaktifkan penyimpanan.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <AdminButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={onDiscard}
            disabled={!isDirty || isSaving}
            className="flex-1 sm:flex-none"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Batalkan Perubahan</span>
          </AdminButton>

          <AdminButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={!isDirty || isSaving}
            className="flex-1 sm:flex-none"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C8F13A]" aria-hidden="true" />
            ) : (
              <Save className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
            )}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Profil Studio'}</span>
          </AdminButton>
        </div>
      </div>
    </AdminSurface>
  );
}
