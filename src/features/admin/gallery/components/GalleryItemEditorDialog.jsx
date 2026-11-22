import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, X } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';

import { AdminButton } from '@/features/admin/design-system';

import {
  GALLERY_CATEGORY_SUGGESTIONS,
  GALLERY_FIELD_LIMITS,
  GALLERY_STATUSES,
} from '../config/gallery-config';
import { galleryMetadataEditorSchema } from '../schemas/gallery-schema';

function GalleryEditorFormBody({ item, onSave, onCancel }) {
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPublished = item.status === GALLERY_STATUSES.PUBLISHED;

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(galleryMetadataEditorSchema),
    mode: 'onBlur',
    defaultValues: {
      title: item.title || '',
      category: item.category || 'Recording',
      altText: item.altText || '',
      caption: item.caption || '',
    },
  });

  const watchedAltText = useWatch({ control, name: 'altText' }) || '';
  const watchedCaption = useWatch({ control, name: 'caption' }) || '';

  const onSubmit = async (values) => {
    setSubmitError('');

    if (isPublished && values.altText.trim().length < GALLERY_FIELD_LIMITS.altTextMinPublished) {
      setSubmitError(
        `Alternative text wajib diisi minimal ${GALLERY_FIELD_LIMITS.altTextMinPublished} karakter karena foto ini sedang berstatus Published.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave?.(values);
    } catch (err) {
      setSubmitError(err?.message || 'Gagal menyimpan metadata foto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {submitError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800"
        >
          {submitError}
        </div>
      ) : null}

      <div>
        <label htmlFor="gallery-edit-title" className="block text-xs font-semibold text-[#151515]">
          Photo Title <span className="text-[#FF4B22]">*</span>
        </label>
        <input
          id="gallery-edit-title"
          type="text"
          maxLength={GALLERY_FIELD_LIMITS.titleMax}
          aria-invalid={Boolean(errors.title)}
          className="sa-control mt-1.5 min-h-10.5 w-full border-[#151515]/15 bg-white px-3.5 py-2 text-sm text-[#151515] focus:border-[#151515] focus:outline-none"
          {...register('title')}
        />
        {errors.title ? (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="gallery-edit-category"
          className="block text-xs font-semibold text-[#151515]"
        >
          Category <span className="text-[#FF4B22]">*</span>
        </label>
        <input
          id="gallery-edit-category"
          type="text"
          maxLength={GALLERY_FIELD_LIMITS.categoryMax}
          aria-invalid={Boolean(errors.category)}
          className="sa-control mt-1.5 min-h-10.5 w-full border-[#151515]/15 bg-white px-3.5 py-2 text-sm text-[#151515] focus:border-[#151515] focus:outline-none"
          {...register('category')}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {GALLERY_CATEGORY_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() =>
                setValue('category', suggestion, { shouldDirty: true, shouldValidate: true })
              }
              className="cursor-pointer rounded-full border border-[#151515]/12 bg-[#F8F6EF] px-2.5 py-0.5 text-[11px] font-medium text-[#46433D] hover:bg-[#EDF8C2] hover:text-[#151515]"
            >
              {suggestion}
            </button>
          ))}
        </div>
        {errors.category ? (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">
            {errors.category.message}
          </p>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="gallery-edit-alt" className="block text-xs font-semibold text-[#151515]">
            Alternative Text (Alt Text){' '}
            <span className="text-[#FF4B22]">* (Required for Publication)</span>
          </label>
          <span className="font-mono text-[11px] text-[#666159]">
            {watchedAltText.length} / {GALLERY_FIELD_LIMITS.altTextMax}
          </span>
        </div>
        <textarea
          id="gallery-edit-alt"
          rows={2}
          maxLength={GALLERY_FIELD_LIMITS.altTextMax}
          placeholder="Deskripsikan isi foto secara jelas untuk aksesibilitas pengunjung..."
          aria-invalid={Boolean(errors.altText)}
          className="sa-control mt-1.5 w-full resize-y border-[#151515]/15 bg-white px-3.5 py-2 text-sm text-[#151515] focus:border-[#151515] focus:outline-none"
          {...register('altText')}
        />
        <p className="mt-1 text-[11px] text-[#666159]">
          Wajib minimal 3 karakter sebelum foto dapat dipublikasikan ke halaman publik.
        </p>
        {errors.altText ? (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">
            {errors.altText.message}
          </p>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="gallery-edit-caption"
            className="block text-xs font-semibold text-[#151515]"
          >
            Caption (Optional)
          </label>
          <span className="font-mono text-[11px] text-[#666159]">
            {watchedCaption.length} / {GALLERY_FIELD_LIMITS.captionMax}
          </span>
        </div>
        <textarea
          id="gallery-edit-caption"
          rows={2}
          maxLength={GALLERY_FIELD_LIMITS.captionMax}
          placeholder="Catatan atau konteks tambahan foto (opsional)..."
          aria-invalid={Boolean(errors.caption)}
          className="sa-control mt-1.5 w-full resize-y border-[#151515]/15 bg-white px-3.5 py-2 text-sm text-[#151515] focus:border-[#151515] focus:outline-none"
          {...register('caption')}
        />
        {errors.caption ? (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">
            {errors.caption.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#151515]/10 pt-3.5">
        <AdminButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <span>Cancel</span>
        </AdminButton>
        <AdminButton type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C8F13A]" aria-hidden="true" />
          ) : (
            <Save className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
          )}
          <span>{isSubmitting ? 'Saving...' : 'Save Metadata'}</span>
        </AdminButton>
      </div>
    </form>
  );
}

export function GalleryItemEditorDialog({ open, item, onOpenChange, onSave }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <Dialog.Popup className="sa-card max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white p-4 sm:p-6">
            {item ? (
              <div>
                <div className="flex items-start justify-between gap-3 border-b border-[#151515]/10 pb-3">
                  <div>
                    <p className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
                      EDIT PHOTOGRAPH METADATA · v{item.version}
                    </p>
                    <Dialog.Title className="mt-0.5 text-lg font-bold text-[#151515]">
                      {item.title}
                    </Dialog.Title>
                  </div>

                  <Dialog.Close
                    aria-label="Close metadata editor"
                    className="sa-control sa-btn-secondary inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                <Dialog.Description className="sr-only">
                  Ubah judul, kategori, teks alternatif, dan caption untuk foto galeri studio.
                </Dialog.Description>

                <div className="mt-4">
                  <GalleryEditorFormBody
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
