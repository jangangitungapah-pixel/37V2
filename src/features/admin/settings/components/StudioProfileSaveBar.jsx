import { Loader2, RotateCcw, Save } from 'lucide-react';

import { AdminButton, AdminSurface } from '@/features/admin/design-system';

export function StudioProfileSaveBar({ isDirty, isSaving, onDiscard }) {
  return (
    <AdminSurface
      variant={isDirty ? 'card' : 'subcard'}
      className={
        isDirty
          ? 'sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 rounded-[20px] border-[#151515]/15 bg-white/94 p-3.5 shadow-[0_16px_40px_-10px_rgba(21,21,21,0.18)] ring-1 ring-[#151515]/8 backdrop-blur-xl sm:p-4 lg:bottom-3'
          : 'bg-white/94 p-3.5 backdrop-blur-xl sm:p-4'
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#151515] sm:text-sm">
            {isDirty
              ? 'Ada perubahan profil studio yang belum disimpan'
              : 'Semua perubahan profil studio sudah sinkron'}
          </p>
          <p className="mt-0.5 hidden text-[11px] text-[#666159] sm:block">
            {isDirty
              ? 'Klik Simpan Profil untuk menulis pembaruan ke Firestore.'
              : 'Ubah salah satu kolom di atas untuk mengaktifkan penyimpanan.'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 sm:shrink-0">
          <AdminButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={onDiscard}
            disabled={!isDirty || isSaving}
            className="min-h-10 flex-1 sm:flex-initial"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Batalkan Perubahan</span>
          </AdminButton>

          <AdminButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={!isDirty || isSaving}
            className="min-h-10 flex-1 sm:flex-initial"
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
