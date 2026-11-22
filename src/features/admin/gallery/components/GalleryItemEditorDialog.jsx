import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Loader2, Save, X } from 'lucide-react';

import { AdminButton } from '@/features/admin/design-system';

import { GALLERY_FIELD_LIMITS, GALLERY_STATUSES } from '../config/gallery-config';

function PhotoEditorForm({ item, onSave, onCancel }) {
  const initialDescription = item.caption?.trim() || item.altText?.trim() || '';
  const [title, setTitle] = useState(item.title || '');
  const [description, setDescription] = useState(initialDescription);
  const [showInPublicGallery, setShowInPublicGallery] = useState(
    item.status === GALLERY_STATUSES.PUBLISHED,
  );
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isArchived = item.status === GALLERY_STATUSES.ARCHIVED;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const cleanTitle = title.trim();
    const cleanDesc = description.trim();

    if (cleanTitle.length < GALLERY_FIELD_LIMITS.titleMin) {
      setError(`Judul Foto minimal ${GALLERY_FIELD_LIMITS.titleMin} karakter.`);
      return;
    }

    // Populate internal altText from description or title so accessibility is always satisfied
    const resolvedAltText = cleanDesc.length >= 3 ? cleanDesc.slice(0, 220) : cleanTitle;

    setIsSaving(true);
    try {
      await onSave?.({
        title: cleanTitle,
        category: item.category || 'Recording',
        altText: resolvedAltText,
        caption: cleanDesc,
        showInPublicGallery: isArchived ? false : showInPublicGallery,
      });
    } catch (err) {
      setError(err?.message || 'Gagal menyimpan perubahan foto.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="photo-edit-title" className="block text-xs font-semibold text-[#151515]">
          Judul Foto <span className="text-[#FF4B22]">*</span>
        </label>
        <input
          id="photo-edit-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={GALLERY_FIELD_LIMITS.titleMax}
          placeholder="Contoh: Sesi Latihan Room A"
          className="sa-control mt-1.5 min-h-10.5 w-full border-[#151515]/15 bg-white px-3.5 py-2 text-sm text-[#151515] focus:border-[#151515] focus:outline-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="photo-edit-description"
            className="block text-xs font-semibold text-[#151515]"
          >
            Deskripsi
          </label>
          <span className="font-mono text-[11px] text-[#756F65]">
            {description.length} / {GALLERY_FIELD_LIMITS.captionMax}
          </span>
        </div>
        <textarea
          id="photo-edit-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={GALLERY_FIELD_LIMITS.captionMax}
          placeholder="Tulis keterangan singkat mengenai foto ini..."
          className="sa-control mt-1.5 w-full resize-y border-[#151515]/15 bg-white px-3.5 py-2 text-sm text-[#151515] focus:border-[#151515] focus:outline-none"
        />
      </div>

      {!isArchived ? (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#151515]/10 bg-[#F8F6EF] p-3.5">
          <div>
            <p className="text-xs font-bold text-[#151515]">Tampilkan di Galeri Website</p>
            <p className="text-[11px] text-[#666159]">
              Aktifkan agar foto ini muncul pada bagian galeri publik.
            </p>
          </div>
          <input
            type="checkbox"
            checked={showInPublicGallery}
            onChange={(e) => setShowInPublicGallery(e.target.checked)}
            className="h-4 w-4 accent-[#151515]"
          />
        </label>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#151515]/10 pt-3.5">
        <AdminButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          <span>Batal</span>
        </AdminButton>
        <AdminButton type="submit" variant="primary" size="sm" disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C8F13A]" aria-hidden="true" />
          ) : (
            <Save className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
          )}
          <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
        </AdminButton>
      </div>
    </form>
  );
}

export function GalleryItemEditorDialog({ open, item, onOpenChange, onSave }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup className="sa-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 sm:rounded-2xl sm:p-6">
            {item ? (
              <div>
                <div className="flex items-start justify-between gap-3 border-b border-[#151515]/10 pb-3">
                  <div>
                    <Dialog.Title className="text-lg font-bold text-[#151515]">
                      Edit Foto
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-[#666159]">
                      Perbarui judul, deskripsi, dan status tampil foto di galeri website.
                    </Dialog.Description>
                  </div>

                  <Dialog.Close
                    aria-label="Tutup form edit foto"
                    className="sa-control sa-btn-secondary inline-flex h-8.5 w-8.5 shrink-0 cursor-pointer items-center justify-center rounded-full"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                <div className="mt-4">
                  <PhotoEditorForm
                    key={`${item.id}-${item.version}`}
                    item={item}
                    onSave={onSave}
                    onCancel={() => onOpenChange?.(false)}
                  />
                </div>
              </div>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
